# @hardlydifficult/repo-processor

Incremental GitHub repo processor with SHA-based stale detection, parallel file/dir processing, and git-backed YAML persistence.

## Installation

```bash
npm install @hardlydifficult/repo-processor
```

## Quick Start

```typescript
import { RepoProcessor, GitYamlStore } from "@hardlydifficult/repo-processor";
import { GitHubClient } from "@hardlydifficult/github";

// 1. Configure git-backed YAML store
const store = new GitYamlStore({
  cloneUrl: "https://github.com/owner/repo.git",
  localPath: "/tmp/repo-store",
  resultDir: (owner, repo) => `results/${owner}/${repo}`,
  authToken: process.env.GITHUB_TOKEN,
  gitUser: { name: "Processor Bot", email: "bot@example.com" },
});

// 2. Define processing callbacks
const callbacks = {
  shouldProcess: (entry) => entry.type === "blob" && entry.path.endsWith(".ts"),
  processFile: async ({ entry, content }) => ({
    path: entry.path,
    lineCount: content.split("\n").length,
  }),
  processDirectory: async ({ path, subtreeFilePaths, children }) => ({
    path,
    files: subtreeFilePaths.length,
    dirs: children.filter((c) => c.isDir).length,
  }),
};

// 3. Create and run processor
const github = new GitHubClient({ token: process.env.GITHUB_TOKEN });
const processor = new RepoProcessor({
  githubClient: github,
  store,
  callbacks,
});

const result = await processor.run("owner", "repo");
// => { filesProcessed: 12, filesRemoved: 1, dirsProcessed: 4 }
```

## RepoProcessor: Incremental Processing

`RepoProcessor` executes an incremental pipeline for processing GitHub file trees: fetch tree → diff → process changed files → remove deleted files → resolve stale directories → commit.

```typescript
import { RepoProcessor } from "@hardlydifficult/repo-processor";

const processor = new RepoProcessor({
  githubClient,
  store,
  callbacks,
  concurrency: 5,      // optional (default 5)
  branch: "main",      // optional (default "main")
});

const result = await processor.run("owner", "repo", (progress) => {
  console.log(
    `Phase: ${progress.phase}, Files: ${progress.filesCompleted}/${progress.filesTotal}, Dirs: ${progress.dirsCompleted}/${progress.dirsTotal}`
  );
});
```

### RepoProcessorConfig

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `githubClient` | `GitHubClient` | Yes | — |
| `store` | `ProcessorStore` | Yes | — |
| `callbacks` | `ProcessorCallbacks` | Yes | — |
| `concurrency` | `number` | No | `5` |
| `branch` | `string` | No | `"main"` |

### ProcessingResult

```typescript
{
  filesProcessed: number; // Count of files processed
  filesRemoved: number;   // Count of deleted files
  dirsProcessed: number;  // Count of directories processed
}
```

### File and Directory Contexts

```typescript
interface FileContext {
  entry: TreeEntry;
  content: string;
}

interface DirectoryContext {
  path: string;
  sha: string;
  subtreeFilePaths: string[];
  children: DirectoryChild[];
  tree: TreeEntry[];
}

interface DirectoryChild {
  name: string;
  isDir: boolean;
  fullPath: string;
}
```

## RepoWatcher: SHA-based Triggering

`RepoWatcher` monitors GitHub repos for SHA changes and triggers processing with automatic retries, concurrency control, and state persistence.

```typescript
import { RepoWatcher } from "@hardlydifficult/repo-processor";

const watcher = new RepoWatcher({
  stateKey: "repo-state",
  stateDirectory: "/tmp/state",
  run: async (owner, name) => {
    const processor = new RepoProcessor({ /* config */ });
    return processor.run(owner, name);
  },
  onComplete: (owner, name, result, sha) => {
    console.log(`Completed ${owner}/${name}: ${result.filesProcessed} files`);
  },
  onError: (owner, name, error) => {
    console.error(`Failed ${owner}/${name}:`, error);
  },
  maxAttempts: 3,  // optional retries
});

await watcher.init();

// Handle push events (SHA comparison performed automatically)
watcher.handlePush("hardlydifficult", "typescript", "abc123...");

// Manual trigger (no SHA comparison)
watcher.trigger("hardlydifficult", "typescript");

// Synchronous trigger (blocks until complete)
const response = await watcher.triggerManual("hardlydifficult", "typescript");
// => { success: true, result: ProcessingResult } | { success: false, reason: string }
```

### RepoWatcherConfig

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stateKey` | `string` | Yes | Key for state persistence |
| `stateDirectory` | `string` | Yes | Directory for state files |
| `run` | `(owner, name) => Promise<TResult>` | Yes | Processing logic |
| `onComplete` | `(owner, name, result, sha) => void` | No | Success callback |
| `onError` | `(owner, name, error) => void` | No | Failure callback |
| `autoSaveMs` | `number` | No | `5000` (5s) |
| `maxAttempts` | `number` | No | `1` (no retry) |

## GitYamlStore: YAML Persistence

`GitYamlStore` implements `ProcessorStore` by persisting results as YAML files in a git repository.

```typescript
import { GitYamlStore } from "@hardlydifficult/repo-processor";

const store = new GitYamlStore({
  cloneUrl: "https://github.com/owner/repo.git",
  localPath: "/tmp/store",
  resultDir: (owner, repo) => `results/${owner}/${repo}`,
  authToken: process.env.GITHUB_TOKEN,  // optional, falls back to env
  gitUser: { name: "Processor", email: "bot@example.com" },
});
```

### Typed Result Loading

```typescript
import { z } from "zod";

const fileSchema = z.object({
  path: z.string(),
  lineCount: z.number(),
  sha: z.string(),
});

const dirSchema = z.object({
  path: z.string(),
  files: z.number(),
  dirs: z.number(),
  sha: z.string(),
});

const fileResult = await store.loadFileResult("owner", "repo", "src/index.ts", fileSchema);
const dirResult = await store.loadDirResult("owner", "repo", "src", dirSchema);
```

## resolveStaleDirectories: Stale Directory Resolution

`resolveStaleDirectories` determines which directories need reprocessing by combining SHA-based detection with diff-derived stale directories.

```typescript
import { resolveStaleDirectories } from "@hardlydifficult/repo-processor";

const staleDirs = await resolveStaleDirectories(
  owner,
  repo,
  staleDirsFromDiff,
  allFilePaths,
  tree,
  store
);
```

### Algorithm

- All directories derived from file paths (and root `""`) are checked
- A directory is stale if:
  - Its stored SHA is missing, or
  - Its stored SHA differs from the current tree SHA
- Stale directories from diff (e.g., due to file changes) are also included

## ProcessorStore Interface

```typescript
interface ProcessorStore {
  ensureReady?(owner: string, repo: string): Promise<void>;
  getFileManifest(owner: string, repo: string): Promise<FileManifest>;
  getDirSha(owner: string, repo: string, dirPath: string): Promise<string | null>;
  writeFileResult(owner: string, repo: string, path: string, sha: string, result: unknown): Promise<void>;
  writeDirResult(owner: string, repo: string, path: string, sha: string, result: unknown): Promise<void>;
  deleteFileResult(owner: string, repo: string, path: string): Promise<void>;
  commitBatch(owner: string, repo: string, count: number): Promise<void>;
}
```

## ProcessorCallbacks Interface

```typescript
interface ProcessorCallbacks {
  shouldProcess(entry: TreeEntry): boolean;
  processFile(ctx: FileContext): Promise<unknown>;
  processDirectory(ctx: DirectoryContext): Promise<unknown>;
}
```

## Progress Reporting

```typescript
interface ProcessingProgress {
  phase: "loading" | "files" | "directories" | "committing";
  message: string;
  filesTotal: number;
  filesCompleted: number;
  dirsTotal: number;
  dirsCompleted: number;
}

type ProgressCallback = (progress: ProcessingProgress) => void;
```

## Setup

No external service setup beyond GitHub is required. The package uses `@hardlydifficult/github` for tree fetches and `simple-git` for git operations.

### Environment Variables

| Variable | Usage |
|----------|-------|
| `GITHUB_TOKEN` | Used by `GitYamlStore` for authenticated git operations if `authToken` not provided |