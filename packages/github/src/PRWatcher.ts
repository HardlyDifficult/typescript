import type { Octokit } from "@octokit/rest";

import { fetchPRActivity, type PRActivity } from "./polling/fetchPRActivity.js";
import { fetchWatchedPRs, type WatchedPR } from "./polling/fetchWatchedPRs.js";
import type {
  CheckRun,
  CheckRunEvent,
  CommentEvent,
  PollCompleteEvent,
  PREvent,
  PullRequest,
  PullRequestComment,
  PullRequestReview,
  ReviewEvent,
  WatchOptions,
} from "./types.js";

interface PRSnapshot {
  pr: PullRequest;
  owner: string;
  name: string;
  commentIds: Set<number>;
  reviewIds: Set<number>;
  checkRuns: Map<number, { status: string; conclusion: string | null }>;
}

const DEFAULT_INTERVAL_MS = 30_000;

export class PRWatcher {
  private readonly octokit: Octokit;
  private readonly username: string;
  private readonly repos: readonly string[];
  private readonly myPRs: boolean;
  private readonly intervalMs: number;

  private readonly newPRCallbacks = new Set<(event: PREvent) => void>();
  private readonly commentCallbacks = new Set<(event: CommentEvent) => void>();
  private readonly reviewCallbacks = new Set<(event: ReviewEvent) => void>();
  private readonly checkRunCallbacks = new Set<
    (event: CheckRunEvent) => void
  >();
  private readonly mergedCallbacks = new Set<(event: PREvent) => void>();
  private readonly closedCallbacks = new Set<(event: PREvent) => void>();
  private readonly pollCompleteCallbacks = new Set<
    (event: PollCompleteEvent) => void
  >();
  private readonly errorCallbacks = new Set<(error: Error) => void>();

  private readonly snapshots = new Map<string, PRSnapshot>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private fetching = false;
  private initialized = false;

  /** @internal */
  constructor(octokit: Octokit, username: string, options: WatchOptions) {
    this.octokit = octokit;
    this.username = username;
    this.repos = options.repos ?? [];
    this.myPRs = options.myPRs ?? false;
    this.intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
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

  onPollComplete(callback: (event: PollCompleteEvent) => void): () => void {
    this.pollCompleteCallbacks.add(callback);
    return () => this.pollCompleteCallbacks.delete(callback);
  }

  onError(callback: (error: Error) => void): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  async start(): Promise<void> {
    await this.poll();
    this.timer = setInterval(() => {
      void this.poll();
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async poll(): Promise<void> {
    if (this.fetching) {
      return;
    }
    this.fetching = true;

    try {
      const prs = await fetchWatchedPRs(
        this.octokit,
        this.username,
        this.repos,
        this.myPRs
      );
      await this.processUpdates(prs);
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
    const activity = await fetchPRActivity(
      this.octokit,
      owner,
      name,
      pr.number,
      pr.head.sha
    );
    this.snapshots.set(key, buildSnapshot(pr, owner, name, activity));
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

    const activity = await fetchPRActivity(
      this.octokit,
      owner,
      name,
      pr.number,
      pr.head.sha
    );

    if (this.initialized) {
      this.emitNewComments(activity.comments, previous, pr, repo);
      this.emitNewReviews(activity.reviews, previous, pr, repo);
      this.emitCheckRunChanges(activity.checkRuns, previous, pr, repo);
    }

    this.snapshots.set(key, buildSnapshot(pr, owner, name, activity));
  }

  private async handleRemovedPRs(currentKeys: Set<string>): Promise<void> {
    for (const [key, snapshot] of this.snapshots) {
      if (currentKeys.has(key)) {
        continue;
      }

      try {
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

function buildSnapshot(
  pr: PullRequest,
  owner: string,
  name: string,
  activity: PRActivity
): PRSnapshot {
  return {
    pr,
    owner,
    name,
    commentIds: new Set(activity.comments.map((c) => c.id)),
    reviewIds: new Set(activity.reviews.map((r) => r.id)),
    checkRuns: new Map(
      activity.checkRuns.map((cr) => [
        cr.id,
        { status: cr.status, conclusion: cr.conclusion },
      ])
    ),
  };
}
