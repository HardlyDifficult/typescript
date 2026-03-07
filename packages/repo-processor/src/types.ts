import type { StateTrackerEvent } from "@hardlydifficult/state-tracker";

export interface GitIdentity {
  name: string;
  email: string;
}

export interface RepoFileFilterInput {
  path: string;
  sha: string;
  size?: number;
}

export interface RepoFileInput {
  repo: string;
  path: string;
  sha: string;
  content: string;
}

export interface RepoDirectoryChild {
  name: string;
  path: string;
  type: "file" | "directory";
}

export interface RepoDirectoryInput {
  repo: string;
  path: string;
  sha: string;
  files: readonly string[];
  children: readonly RepoDirectoryChild[];
}

export interface RepoProcessorResultsConfig {
  repo: string;
  directory: string;
  root?: string;
  branch?: string;
  gitUser?: GitIdentity;
}

export interface RepoProcessorOptions<
  TFileResult,
  TDirResult = never,
> {
  repo: string;
  githubToken?: string;
  ref?: string;
  concurrency?: number;
  results: RepoProcessorResultsConfig;
  include?: (file: RepoFileFilterInput) => boolean;
  processFile(file: RepoFileInput): Promise<TFileResult>;
  processDirectory?: (
    directory: RepoDirectoryInput
  ) => Promise<TDirResult>;
}

export interface RepoProcessorProgressCounts {
  total: number;
  completed: number;
}

export interface RepoProcessorProgress {
  phase: "loading" | "files" | "directories" | "committing";
  message: string;
  files: RepoProcessorProgressCounts;
  directories: RepoProcessorProgressCounts;
}

export type RepoProcessorProgressCallback = (
  progress: RepoProcessorProgress
) => void;

export interface RepoProcessorRunOptions {
  onProgress?: RepoProcessorProgressCallback;
}

export interface RepoProcessorRunResult {
  repo: string;
  sourceSha: string;
  processedFiles: number;
  removedFiles: number;
  processedDirectories: number;
}

export interface RepoWatcherOptions {
  stateDirectory?: string;
  stateKey?: string;
  autoSaveMs?: number;
  maxAttempts?: number;
  onComplete?: (
    result: RepoProcessorRunResult,
    sha: string
  ) => void;
  onError?: (error: unknown) => void;
  onEvent?: (event: StateTrackerEvent) => void;
}
