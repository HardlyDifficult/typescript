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

// --- Watcher types ---

export interface WatchOptions {
  readonly repos?: readonly string[];
  readonly myPRs?: boolean;
  readonly intervalMs?: number;
}

export interface PREvent {
  readonly pr: PullRequest;
  readonly repo: { readonly owner: string; readonly name: string };
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
