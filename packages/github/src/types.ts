export interface Repository {
  readonly id: number;
  readonly name: string;
  readonly full_name: string;
  readonly owner: {
    readonly login: string;
    readonly id: number;
  };
  readonly html_url: string;
  readonly default_branch: string;
  readonly description: string | null;
}

export interface User {
  readonly login: string;
  readonly id: number;
  readonly avatar_url: string;
  readonly html_url: string;
}

export interface CheckRun {
  readonly id: number;
  readonly name: string;
  readonly status: "queued" | "in_progress" | "completed";
  readonly conclusion:
    | "success"
    | "failure"
    | "neutral"
    | "cancelled"
    | "skipped"
    | "timed_out"
    | "action_required"
    | null;
  readonly started_at: string | null;
  readonly completed_at: string | null;
  readonly html_url: string;
}

export interface PullRequestReview {
  readonly id: number;
  readonly user: User;
  readonly body: string;
  readonly state:
    | "APPROVED"
    | "CHANGES_REQUESTED"
    | "COMMENTED"
    | "DISMISSED"
    | "PENDING";
  readonly submitted_at: string;
  readonly html_url: string;
}

export interface PullRequestComment {
  readonly id: number;
  readonly user: User;
  readonly body: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly html_url: string;
}

export interface Label {
  readonly id: number;
  readonly name: string;
  readonly color: string;
  readonly description: string | null;
}

export type MergeableState = "mergeable" | "conflicting" | "unknown";

export interface PullRequest {
  readonly id: number;
  readonly number: number;
  readonly title: string;
  readonly body: string | null;
  readonly state: "open" | "closed";
  readonly draft: boolean;
  readonly user: User;
  readonly html_url: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly closed_at: string | null;
  readonly merged_at: string | null;
  readonly head: {
    readonly ref: string;
    readonly sha: string;
    readonly repo: Repository | null;
  };
  readonly base: {
    readonly ref: string;
    readonly sha: string;
    readonly repo: Repository;
  };
  readonly mergeable: boolean | null;
  readonly mergeable_state: MergeableState;
  readonly labels: readonly Label[];
  readonly requested_reviewers: readonly User[];
  readonly assignees: readonly User[];
}

export interface ContributionRepo {
  readonly owner: string;
  readonly name: string;
  readonly fullName: string;
}

export interface PullRequestFile {
  readonly sha: string;
  readonly filename: string;
  readonly status:
    | "added"
    | "removed"
    | "modified"
    | "renamed"
    | "copied"
    | "changed"
    | "unchanged";
  readonly additions: number;
  readonly deletions: number;
  readonly changes: number;
  readonly blob_url: string;
  readonly raw_url: string;
  readonly patch?: string;
  readonly previous_filename?: string;
}

export interface PullRequestCommit {
  readonly sha: string;
  readonly commit: {
    readonly author: {
      readonly name: string;
      readonly email: string;
      readonly date: string;
    };
    readonly message: string;
  };
  readonly author: User | null;
  readonly html_url: string;
}

// --- Repo tree types ---

export interface TreeEntry {
  readonly path: string;
  readonly type: string;
  readonly sha: string;
  readonly size?: number;
}

export interface FileTreeResult {
  readonly entries: readonly TreeEntry[];
  readonly rootSha: string;
}

// --- Repo context types ---

export interface RepoContext {
  readonly filePaths: readonly string[];
  readonly keyFiles: readonly KeyFile[];
}

export interface KeyFile {
  readonly path: string;
  readonly content: string;
}

// --- Watcher types ---

import type { PRActivity } from "./polling/fetchPRActivity.js";

export type ClassifyPR = (
  event: PREvent,
  activity: PRActivity
) => string | Promise<string>;

export type DiscoverRepos = () =>
  | readonly string[]
  | Promise<readonly string[]>;

/** Minimal throttle interface compatible with `@hardlydifficult/throttle`. */
export interface WatchThrottle {
  wait(weight?: number): Promise<void>;
}

export interface WatchOptions {
  readonly repos?: readonly string[];
  readonly myPRs?: boolean;
  readonly intervalMs?: number;
  readonly classifyPR?: ClassifyPR;
  readonly discoverRepos?: DiscoverRepos;
  readonly stalePRThresholdMs?: number;
  readonly throttle?: WatchThrottle;
}

export interface PREvent {
  readonly pr: PullRequest;
  readonly repo: { readonly owner: string; readonly name: string };
}

export interface PRStatusEvent extends PREvent {
  readonly status: string;
}

export interface StatusChangedEvent extends PRStatusEvent {
  readonly previousStatus: string;
}

export interface CommentEvent extends PREvent {
  readonly comment: PullRequestComment;
}

export interface ReviewEvent extends PREvent {
  readonly review: PullRequestReview;
}

export interface CheckRunEvent extends PREvent {
  readonly checkRun: CheckRun;
}

export interface PRUpdatedEvent extends PREvent {
  readonly changes: {
    readonly draft?: { readonly from: boolean; readonly to: boolean };
    readonly labels?: {
      readonly from: readonly Label[];
      readonly to: readonly Label[];
    };
    readonly mergeable_state?: {
      readonly from: MergeableState;
      readonly to: MergeableState;
    };
  };
}

export interface PollCompleteEvent {
  readonly prs: readonly PREvent[];
}

/** Emitted when the HEAD SHA of a repository's default branch changes. */
export interface PushEvent {
  readonly repo: { readonly owner: string; readonly name: string };
  readonly branch: string;
  readonly sha: string;
  readonly previousSha: string;
}

export type PRWatcherEvent =
  | { readonly type: "new_pr"; readonly payload: PREvent }
  | { readonly type: "comment"; readonly payload: CommentEvent }
  | { readonly type: "review"; readonly payload: ReviewEvent }
  | { readonly type: "check_run"; readonly payload: CheckRunEvent }
  | { readonly type: "merged"; readonly payload: PREvent }
  | { readonly type: "closed"; readonly payload: PREvent }
  | { readonly type: "pr_updated"; readonly payload: PRUpdatedEvent }
  | { readonly type: "poll_complete"; readonly payload: PollCompleteEvent }
  | { readonly type: "status_changed"; readonly payload: StatusChangedEvent }
  | { readonly type: "push"; readonly payload: PushEvent };

// --- Git Data API types ---

export interface CommitAuthor {
  readonly name: string;
  readonly email: string;
}

export interface CommitFile {
  readonly path: string;
  readonly content: string;
}

export interface CommitFilesOptions {
  readonly branch: string;
  readonly files: readonly CommitFile[];
  readonly message: string;
  readonly parentSha: string;
  readonly author?: CommitAuthor;
}

export interface CommitResult {
  readonly commitSha: string;
  readonly branchCreated: boolean;
}

export interface CreatePROptions {
  readonly head: string;
  readonly base: string;
  readonly title: string;
  readonly body: string;
}

export interface CreatedPR {
  readonly number: number;
  readonly url: string;
}
