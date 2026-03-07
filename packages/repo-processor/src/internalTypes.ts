import type {
  FileTreeResult,
  TreeEntry,
} from "@hardlydifficult/github";
import type { z } from "zod";

import type {
  RepoDirectoryInput,
  RepoFileFilterInput,
  RepoFileInput,
} from "./types.js";

export interface BoundRepoRef {
  owner: string;
  name: string;
  fullName: string;
}

export interface FileManifest {
  [path: string]: string;
}

export interface ResultsStore {
  ensureReady(): Promise<void>;
  getFileManifest(): Promise<FileManifest>;
  getDirSha(dirPath: string): Promise<string | null>;
  writeFileResult(
    filePath: string,
    sha: string,
    result: unknown
  ): Promise<void>;
  writeDirResult(
    dirPath: string,
    sha: string,
    result: unknown
  ): Promise<void>;
  deleteFileResult(filePath: string): Promise<void>;
  commitBatch(sourceRepo: string, count: number): Promise<void>;
  readFileResult<T>(
    filePath: string,
    schema: z.ZodType<T>
  ): Promise<T | null>;
  readDirectoryResult<T>(
    dirPath: string,
    schema: z.ZodType<T>
  ): Promise<T | null>;
}

export interface RepoClientLike {
  getFileTree(ref?: string): Promise<FileTreeResult>;
  getFileContent(filePath: string, ref?: string): Promise<string>;
}

export interface RepoProcessorInternals<
  TFileResult,
  TDirResult = never,
> {
  repo: BoundRepoRef;
  repoClient: RepoClientLike;
  store: ResultsStore;
  ref?: string;
  concurrency: number;
  include: (file: RepoFileFilterInput) => boolean;
  processFile(file: RepoFileInput): Promise<TFileResult>;
  processDirectory?: (
    directory: RepoDirectoryInput
  ) => Promise<TDirResult>;
}

export interface ProcessingFailure {
  path: string;
  reason: unknown;
}

export type DirectoryTreeEntry = TreeEntry & { type: "tree" };
