export { github, GitHubClient, RepoClient, PRClient } from "./GitHubClient.js";
export { PRWatcher } from "./PRWatcher.js";
export { buildTimeline, formatTimeline } from "./timeline.js";
export type { TimelineEntry, TimelineEntryKind } from "./timeline.js";
export type { PRActivity } from "./polling/fetchPRActivity.js";
export {
  diffTree,
  collectDirectories,
  groupByDirectory,
  discoverTreeChildren,
} from "./treeDiff.js";
export type { FileManifest, TreeDiff, TreeChild } from "./treeDiff.js";
export type {
  PullRequest,
  PullRequestSnapshot,
  Repository,
  User,
  CheckRun,
  PullRequestReview,
  PullRequestComment,
  PullRequestFile,
  PullRequestCommit,
  Label,
  ContributionRepo,
  MergeableState,
  WatchOptions,
  WatchThrottle,
  PREvent,
  CommentEvent,
  ReviewEvent,
  CheckRunEvent,
  PRUpdatedEvent,
  PollCompleteEvent,
  ClassifyPR,
  DiscoverRepos,
  PRStatusEvent,
  PushEvent,
  StatusChangedEvent,
  PRWatcherEvent,
  TreeEntry,
  FileTreeResult,
  GitHubClientConfig,
  RepoContext,
  KeyFile,
  RepoContextOptions,
  CommitAuthor,
  CommitFile,
  CommitOptions,
  CommitResult,
  OpenPullRequestOptions,
  CreatedPR,
} from "./types.js";

export {
  parseGitHubFileUrl,
  parseGitHubDirectoryUrl,
  type GitHubFileInfo,
  type GitHubDirectoryInfo,
  parseGitHubRepoReference,
  type GitHubRepoInfo,
  parseGitHubPullRequestReference,
  type GitHubPullRequestInfo,
} from "./githubUrlParser.js";
