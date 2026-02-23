import type { Octokit } from "@octokit/rest";

import { BranchHeadTracker } from "./polling/branchHeadTracker.js";
import { fetchPRActivitySelective } from "./polling/fetchPRActivity.js";
import { fetchWatchedPRs, type WatchedPR } from "./polling/fetchWatchedPRs.js";
import {
  buildSnapshot,
  detectCheckRunChanges,
  detectNewComments,
  detectNewReviews,
  detectPRChanges,
  type PRSnapshot,
} from "./polling/processSnapshot.js";
import { classifyAndDetectChange } from "./polling/statusTracker.js";
import type {
  CheckRunEvent,
  ClassifyPR,
  CommentEvent,
  DiscoverRepos,
  PollCompleteEvent,
  PREvent,
  PRStatusEvent,
  PRUpdatedEvent,
  PullRequest,
  PRWatcherEvent,
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
  private readonly eventCallbacks = new Set<
    (event: PRWatcherEvent) => void
  >();

  private readonly snapshots = new Map<string, PRSnapshot>();
  private readonly branchTracker = new BranchHeadTracker();
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

  /** Fires when the HEAD SHA of a watched repository's default branch changes. */
  onPush(callback: (event: PushEvent) => void): () => void {
    this.pushCallbacks.add(callback);
    return () => this.pushCallbacks.delete(callback);
  }

  onEvent(callback: (event: PRWatcherEvent) => void): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  onError(callback: (error: Error) => void): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
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
      this.branchTracker.removeRepo(repo);
    }
  }

  private async poll(): Promise<void> {
    if (this.fetching) {
      return;
    }
    this.fetching = true;

    try {
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
      } catch (error: unknown) {
        this.emitError(
          error instanceof Error ? error : new Error(String(error))
        );
      }

      // Push detection runs independently — PR processing failures do not block it
      if (this.pushCallbacks.size > 0) {
        try {
          const { events: pushEvents, errors: pushErrors } =
            await this.branchTracker.check(
              this.octokit,
              this.repos,
              this.throttle
            );
          for (const event of pushEvents) {
            this.emitWatcherEvent({ type: "push", payload: event });
          }
          for (const error of pushErrors) {
            this.emitError(error);
          }
        } catch (error: unknown) {
          this.emitError(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    } finally {
      this.fetching = false;
    }
  }

  private async processUpdates(
    watchedPRs: readonly WatchedPR[]
  ): Promise<void> {
    const currentKeys = new Set<string>();

    for (const { pr, owner, name } of watchedPRs) {
      const defaultBranch = pr.base.repo.default_branch;
      if (defaultBranch) {
        this.branchTracker.harvestDefaultBranch(
          `${owner}/${name}`,
          defaultBranch
        );
      }

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
    this.emitWatcherEvent({ type: "poll_complete", payload: { prs } });
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
    this.emitWatcherEvent({
      type: "new_pr",
      payload: { pr, repo: { owner, name } },
    });
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
      this.emitWatcherEvent({ type: "merged", payload: { pr, repo } });
      this.snapshots.delete(key);
      return;
    }
    if (pr.state === "closed" && previous.pr.state !== "closed") {
      this.emitWatcherEvent({ type: "closed", payload: { pr, repo } });
      this.snapshots.delete(key);
      return;
    }

    if (this.initialized) {
      const updateEvent = detectPRChanges(pr, previous.pr, repo);
      if (updateEvent) {
        this.emitWatcherEvent({ type: "pr_updated", payload: updateEvent });
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
      for (const comment of detectNewComments(activity.comments, previous)) {
        this.emitWatcherEvent({
          type: "comment",
          payload: { comment, pr, repo },
        });
      }
      for (const review of detectNewReviews(activity.reviews, previous)) {
        this.emitWatcherEvent({
          type: "review",
          payload: { review, pr, repo },
        });
      }
      for (const checkRun of detectCheckRunChanges(
        activity.checkRuns,
        previous
      )) {
        this.emitWatcherEvent({
          type: "check_run",
          payload: { checkRun, pr, repo },
        });
      }
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
        this.emitWatcherEvent({ type: "status_changed", payload: result.changed });
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
          this.emitWatcherEvent({
            type: "merged",
            payload: { pr: freshPR, repo },
          });
        } else if (freshPR.state === "closed") {
          this.emitWatcherEvent({
            type: "closed",
            payload: { pr: freshPR, repo },
          });
        }
      } catch {
        // PR may have been deleted or become inaccessible
      }

      this.snapshots.delete(key);
    }
  }

  private emitWatcherEvent(event: PRWatcherEvent): void {
    this.emit(this.eventCallbacks, event);

    switch (event.type) {
      case "new_pr":
        this.emit(this.newPRCallbacks, event.payload);
        break;
      case "comment":
        this.emit(this.commentCallbacks, event.payload);
        break;
      case "review":
        this.emit(this.reviewCallbacks, event.payload);
        break;
      case "check_run":
        this.emit(this.checkRunCallbacks, event.payload);
        break;
      case "merged":
        this.emit(this.mergedCallbacks, event.payload);
        break;
      case "closed":
        this.emit(this.closedCallbacks, event.payload);
        break;
      case "pr_updated":
        this.emit(this.updatedCallbacks, event.payload);
        break;
      case "poll_complete":
        this.emit(this.pollCompleteCallbacks, event.payload);
        break;
      case "status_changed":
        this.emit(this.statusChangedCallbacks, event.payload);
        break;
      case "push":
        this.emit(this.pushCallbacks, event.payload);
        break;
      default:
        event satisfies never;
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
