import type { Octokit } from "@octokit/rest";

import { checkDefaultBranch } from "./polling/checkDefaultBranch.js";
import { fetchPRActivitySelective } from "./polling/fetchPRActivity.js";
import { fetchWatchedPRs, type WatchedPR } from "./polling/fetchWatchedPRs.js";
import {
  buildSnapshot,
  detectPRChanges,
  type PRSnapshot,
} from "./polling/processSnapshot.js";
import { classifyAndDetectChange } from "./polling/statusTracker.js";
import type {
  CheckRun,
  CheckRunEvent,
  ClassifyPR,
  CommentEvent,
  DiscoverRepos,
  PollCompleteEvent,
  PREvent,
  PRStatusEvent,
  PRUpdatedEvent,
  PullRequest,
  PullRequestComment,
  PullRequestReview,
  PushEvent,
  ReviewEvent,
  StatusChangedEvent,
  WatchOptions,
  WatchThrottle,
} from "./types.js";

const DEFAULT_INTERVAL_MS = 30_000;

/** Polls GitHub for open pull requests and emits events for new PRs, comments, reviews, check runs, merges, and status changes. */
export class PRWatcher {
  private readonly octokit: Octokit;
  private readonly username: string;
  private repos: string[];
  private readonly myPRs: boolean;
  private readonly intervalMs: number;
  private readonly classifyPR: ClassifyPR | undefined;
  private readonly discoverRepos: DiscoverRepos | undefined;
  private readonly stalePRThresholdMs: number | undefined;
  private readonly throttle: WatchThrottle | undefined;

  private readonly newPRCallbacks = new Set<(event: PREvent) => void>();
  private readonly commentCallbacks = new Set<(event: CommentEvent) => void>();
  private readonly reviewCallbacks = new Set<(event: ReviewEvent) => void>();
  private readonly checkRunCallbacks = new Set<
    (event: CheckRunEvent) => void
  >();
  private readonly mergedCallbacks = new Set<(event: PREvent) => void>();
  private readonly closedCallbacks = new Set<(event: PREvent) => void>();
  private readonly updatedCallbacks = new Set<
    (event: PRUpdatedEvent) => void
  >();
  private readonly pollCompleteCallbacks = new Set<
    (event: PollCompleteEvent) => void
  >();
  private readonly statusChangedCallbacks = new Set<
    (event: StatusChangedEvent) => void
  >();
  private readonly errorCallbacks = new Set<(error: Error) => void>();
  private readonly pushCallbacks = new Set<(event: PushEvent) => void>();

  private readonly snapshots = new Map<string, PRSnapshot>();
  private readonly branchShas = new Map<string, string>();
  private readonly defaultBranches = new Map<string, string>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private fetching = false;
  private initialized = false;

  /** @internal */
  constructor(octokit: Octokit, username: string, options: WatchOptions) {
    this.octokit = octokit;
    this.username = username;
    this.repos = [...(options.repos ?? [])];
    this.myPRs = options.myPRs ?? false;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.classifyPR = options.classifyPR;
    this.discoverRepos = options.discoverRepos;
    this.stalePRThresholdMs = options.stalePRThresholdMs;
    this.throttle = options.throttle;
  }

  onNewPR(callback: (event: PREvent) => void): () => void {
    this.newPRCallbacks.add(callback);
    return () => this.newPRCallbacks.delete(callback);
  }

  onComment(callback: (event: CommentEvent) => void): () => void {
    this.commentCallbacks.add(callback);
    return () => this.commentCallbacks.delete(callback);
  }

  onReview(callback: (event: ReviewEvent) => void): () => void {
    this.reviewCallbacks.add(callback);
    return () => this.reviewCallbacks.delete(callback);
  }

  onCheckRun(callback: (event: CheckRunEvent) => void): () => void {
    this.checkRunCallbacks.add(callback);
    return () => this.checkRunCallbacks.delete(callback);
  }

  onMerged(callback: (event: PREvent) => void): () => void {
    this.mergedCallbacks.add(callback);
    return () => this.mergedCallbacks.delete(callback);
  }

  onClosed(callback: (event: PREvent) => void): () => void {
    this.closedCallbacks.add(callback);
    return () => this.closedCallbacks.delete(callback);
  }

  onPRUpdated(callback: (event: PRUpdatedEvent) => void): () => void {
    this.updatedCallbacks.add(callback);
    return () => this.updatedCallbacks.delete(callback);
  }

  onPollComplete(callback: (event: PollCompleteEvent) => void): () => void {
    this.pollCompleteCallbacks.add(callback);
    return () => this.pollCompleteCallbacks.delete(callback);
  }

  onStatusChanged(callback: (event: StatusChangedEvent) => void): () => void {
    this.statusChangedCallbacks.add(callback);
    return () => this.statusChangedCallbacks.delete(callback);
  }

  onError(callback: (error: Error) => void): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  /** Emits when a watched repo's default branch HEAD SHA changes. Lazy: only polls if listeners are registered. */
  onPush(callback: (event: PushEvent) => void): () => void {
    this.pushCallbacks.add(callback);
    return () => this.pushCallbacks.delete(callback);
  }

  async start(): Promise<readonly PRStatusEvent[]> {
    await this.poll();
    this.timer = setInterval(() => {
      void this.poll();
    }, this.intervalMs);
    return [...this.snapshots.values()].map((s) => ({
      pr: s.pr,
      repo: { owner: s.owner, name: s.name },
      status: s.status ?? "",
    }));
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  getWatchedPRs(): readonly PREvent[] {
    return [...this.snapshots.values()].map((s) => ({
      pr: s.pr,
      repo: { owner: s.owner, name: s.name },
    }));
  }

  addRepo(repo: string): void {
    if (!this.repos.includes(repo)) {
      this.repos.push(repo);
    }
  }

  removeRepo(repo: string): void {
    const index = this.repos.indexOf(repo);
    if (index !== -1) {
      this.repos.splice(index, 1);
    }
  }

  private async poll(): Promise<void> {
    if (this.fetching) {
      return;
    }
    this.fetching = true;

    try {
      if (this.discoverRepos) {
        const repos = await this.discoverRepos();
        for (const repo of repos) {
          this.addRepo(repo);
        }
      }

      const prs = await fetchWatchedPRs(
        this.octokit,
        this.username,
        this.repos,
        this.myPRs,
        this.throttle
      );
      await this.processUpdates(prs);
      await this.checkDefaultBranches();
    } catch (error: unknown) {
      this.emitError(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.fetching = false;
    }
  }

  private async processUpdates(
    watchedPRs: readonly WatchedPR[]
  ): Promise<void> {
    const currentKeys = new Set<string>();

    for (const { pr, owner, name } of watchedPRs) {
      const key = prKey(owner, name, pr.number);
      currentKeys.add(key);

      const previous = this.snapshots.get(key);
      if (!previous) {
        await this.handleNewPR(pr, owner, name, key);
        continue;
      }

      await this.handleExistingPR(pr, owner, name, previous, key);
    }

    await this.handleRemovedPRs(currentKeys);

    if (this.stalePRThresholdMs !== undefined) {
      const cutoff = Date.now() - this.stalePRThresholdMs;
      for (const [key, snapshot] of this.snapshots) {
        if (snapshot.lastSeen < cutoff) {
          this.snapshots.delete(key);
        }
      }
    }

    this.initialized = true;

    const prs = [...this.snapshots.values()].map((s) => ({
      pr: s.pr,
      repo: { owner: s.owner, name: s.name },
    }));
    this.emit(this.pollCompleteCallbacks, { prs });
  }

  private async handleNewPR(
    pr: PullRequest,
    owner: string,
    name: string,
    key: string
  ): Promise<void> {
    const { activity } = await fetchPRActivitySelective(
      this.octokit,
      owner,
      name,
      pr.number,
      pr.head.sha,
      pr.updated_at,
      undefined,
      this.throttle
    );
    let status: string | null = null;
    if (this.classifyPR) {
      ({ status } = await classifyAndDetectChange(
        this.classifyPR,
        { pr, repo: { owner, name } },
        activity,
        undefined,
        this.initialized
      ));
    }
    this.snapshots.set(key, buildSnapshot(pr, owner, name, activity, status));
    this.emit(this.newPRCallbacks, { pr, repo: { owner, name } });
  }

  private async handleExistingPR(
    pr: PullRequest,
    owner: string,
    name: string,
    previous: PRSnapshot,
    key: string
  ): Promise<void> {
    const repo = { owner, name };

    if (pr.merged_at !== null && previous.pr.merged_at === null) {
      this.emit(this.mergedCallbacks, { pr, repo });
      this.snapshots.delete(key);
      return;
    }
    if (pr.state === "closed" && previous.pr.state !== "closed") {
      this.emit(this.closedCallbacks, { pr, repo });
      this.snapshots.delete(key);
      return;
    }

    if (this.initialized) {
      const updateEvent = detectPRChanges(pr, previous.pr, repo);
      if (updateEvent) {
        this.emit(this.updatedCallbacks, updateEvent);
      }
    }

    const { activity } = await fetchPRActivitySelective(
      this.octokit,
      owner,
      name,
      pr.number,
      pr.head.sha,
      pr.updated_at,
      previous,
      this.throttle
    );

    if (this.initialized) {
      this.emitNewComments(activity.comments, previous, pr, repo);
      this.emitNewReviews(activity.reviews, previous, pr, repo);
      this.emitCheckRunChanges(activity.checkRuns, previous, pr, repo);
    }

    let status: string | null = null;
    if (this.classifyPR) {
      const result = await classifyAndDetectChange(
        this.classifyPR,
        { pr, repo },
        activity,
        previous,
        this.initialized
      );
      ({ status } = result);
      if (result.changed) {
        this.emit(this.statusChangedCallbacks, result.changed);
      }
    }

    this.snapshots.set(key, buildSnapshot(pr, owner, name, activity, status));
  }

  private async handleRemovedPRs(currentKeys: Set<string>): Promise<void> {
    for (const [key, snapshot] of this.snapshots) {
      if (currentKeys.has(key)) {
        continue;
      }

      try {
        await this.throttle?.wait(1);
        const response = await this.octokit.pulls.get({
          owner: snapshot.owner,
          repo: snapshot.name,
          pull_number: snapshot.pr.number,
        });
        const freshPR = response.data as unknown as PullRequest;
        const repo = { owner: snapshot.owner, name: snapshot.name };

        if (freshPR.merged_at !== null) {
          this.emit(this.mergedCallbacks, { pr: freshPR, repo });
        } else if (freshPR.state === "closed") {
          this.emit(this.closedCallbacks, { pr: freshPR, repo });
        }
      } catch {
        // PR may have been deleted or become inaccessible
      }

      this.snapshots.delete(key);
    }
  }

  private async checkDefaultBranches(): Promise<void> {
    if (this.pushCallbacks.size === 0) {
      return;
    }
    const uniqueRepos = new Set(this.repos);
    for (const repoSlug of uniqueRepos) {
      const [owner, name] = repoSlug.split("/");
      await checkDefaultBranch(
        this.octokit,
        owner,
        name,
        this.defaultBranches,
        this.branchShas,
        this.throttle,
        this.initialized,
        (event) => {
          this.emit(this.pushCallbacks, event);
        }
      );
    }
  }

  private emitNewComments(
    comments: readonly PullRequestComment[],
    previous: PRSnapshot,
    pr: PullRequest,
    repo: { owner: string; name: string }
  ): void {
    for (const comment of comments) {
      if (!previous.commentIds.has(comment.id)) {
        this.emit(this.commentCallbacks, { comment, pr, repo });
      }
    }
  }

  private emitNewReviews(
    reviews: readonly PullRequestReview[],
    previous: PRSnapshot,
    pr: PullRequest,
    repo: { owner: string; name: string }
  ): void {
    for (const review of reviews) {
      if (!previous.reviewIds.has(review.id)) {
        this.emit(this.reviewCallbacks, { review, pr, repo });
      }
    }
  }

  private emitCheckRunChanges(
    checkRuns: readonly CheckRun[],
    previous: PRSnapshot,
    pr: PullRequest,
    repo: { owner: string; name: string }
  ): void {
    for (const checkRun of checkRuns) {
      const prev = previous.checkRuns.get(checkRun.id);
      const changed =
        prev?.status !== checkRun.status ||
        prev.conclusion !== checkRun.conclusion;
      if (changed) {
        this.emit(this.checkRunCallbacks, { checkRun, pr, repo });
      }
    }
  }

  private emit<T>(callbacks: Set<(event: T) => void>, event: T): void {
    for (const callback of callbacks) {
      try {
        callback(event);
      } catch (error: unknown) {
        this.emitError(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
  }

  private emitError(error: Error): void {
    for (const callback of this.errorCallbacks) {
      callback(error);
    }
  }
}

function prKey(owner: string, name: string, prNumber: number): string {
  return `${owner}/${name}#${String(prNumber)}`;
}
