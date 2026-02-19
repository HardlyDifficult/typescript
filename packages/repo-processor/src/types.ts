import type { FileManifest, TreeEntry } from "@hardlydifficult/github";

export type { TreeEntry, FileManifest };

/** Manifest of previously processed file SHAs (path → blob SHA). */
export type { FileManifest as ProcessorFileManifest };

/** Consumer-implemented persistence layer. */
export interface ProcessorStore {
  /** One-time init (e.g. ensure local clone). Optional. */
  ensureReady?(owner: string, repo: string): Promise<void>;
  /** Return manifest of previously processed file SHAs (path → blob SHA). */
  getFileManifest(owner: string, repo: string): Promise<FileManifest>;
  /** Return stored SHA for a directory. Null if not stored. */
  getDirSha(
    owner: string,
    repo: string,
    dirPath: string
  ): Promise<string | null>;
  /** Persist result for a processed file. */
  writeFileResult(
    owner: string,
    repo: string,
    path: string,
    sha: string,
    result: unknown
  ): Promise<void>;
  /** Persist result for a processed directory. */
  writeDirResult(
    owner: string,
    repo: string,
    path: string,
    sha: string,
    result: unknown
  ): Promise<void>;
  /** Delete stored result for a removed file. */
  deleteFileResult(owner: string, repo: string, path: string): Promise<void>;
  /** Commit current batch of changes. */
  commitBatch(owner: string, repo: string, count: number): Promise<void>;
}

/** Context passed to processFile callback. */
export interface FileContext {
  readonly entry: TreeEntry;
  readonly content: string;
}

/** An immediate child of a directory being processed. */
export interface DirectoryChild {
  readonly name: string;
  readonly isDir: boolean;
  readonly fullPath: string;
}

/** Context passed to processDirectory callback. */
export interface DirectoryContext {
  readonly path: string;
  readonly sha: string;
  readonly subtreeFilePaths: readonly string[];
  readonly children: readonly DirectoryChild[];
  readonly tree: readonly TreeEntry[];
}

/** Consumer-provided domain logic. */
export interface ProcessorCallbacks {
  /** Filter: which tree entries should be processed? */
  shouldProcess(entry: TreeEntry): boolean;
  /** Process a single changed file. Return value passed to store.writeFileResult. */
  processFile(ctx: FileContext): Promise<unknown>;
  /** Process a directory after all children. Return value passed to store.writeDirResult. */
  processDirectory(ctx: DirectoryContext): Promise<unknown>;
}

/** Progress reported during a run. */
export interface ProcessingProgress {
  phase: "loading" | "files" | "directories" | "committing";
  message: string;
  filesTotal: number;
  filesCompleted: number;
  dirsTotal: number;
  dirsCompleted: number;
}

export type ProgressCallback = (progress: ProcessingProgress) => void;

/** Result returned by RepoProcessor.run(). */
export interface ProcessingResult {
  filesProcessed: number;
  filesRemoved: number;
  dirsProcessed: number;
}
