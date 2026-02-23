# @hardlydifficult/repo-processor

Incremental GitHub repository processor with SHA-based stale detection, parallel batch processing (files bottom-up, directories top-down), and git-backed YAML persistence.

## Installation

```bash
npm install @hardlydifficult/repo-processor
```

## Quick Start

```typescript
import { RepoProcessor, GitYamlStore } from "@hardlydifficult/repo-processor";
import { createGitHubClient } from "@hardlydifficult/github";

// 1. Configure git-backed YAML store
const store = new GitYamlStore({
  cloneUrl: "https://github.com/owner/repo.git",
  localPath: ".results",
  resultDir: (owner, repo) => `repos/${owner}/${repo}`,
  gitUser: { name: "CI", email: "ci@example.com" },
});

// 2. Define processing callbacks
const callbacks = {
  shouldProcess: (entry) => entry.type === "blob",
  processFile: async ({ entry, content }) => ({
    path: entry.path,
    length: content.length,
  }),
  processDirectory: async (ctx) => ({
    path: ctx.path,
    fileCount: ctx.subtreeFilePaths.length,
  }),
};

// 3. Create and run processor
const processor = new RepoProcessor({
  githubClient: createGitHubClient({ token: process.env.GITHUB_TOKEN! }),
  store,
  callbacks,
});

const result = await processor.run("owner", "repo");
// { filesProcessed: 10, filesRemoved: 1, dirsProcessed: 3 }
```

## RepoProcessor: Incremental Repository Processing

The `RepoProcessor` class implements an incremental pipeline for processing GitHub repository file trees. It detects changes by comparing current and previous file SHAs, processes only changed files in parallel batches, and processes affected directories bottom-up.

### Configuration

| Field | Type | Default | Description |
|-------|------|:-------:|-------------|
| `githubClient` | `GitHubClient` | — | GitHub API client from `@hardlydifficult/github` |
| `store` | `ProcessorStore` | — | Persistence layer for file/dir results and manifests |
| `callbacks` | `ProcessorCallbacks` | — | Domain logic for filtering, file processing, and directory processing |
| `concurrency` | `number` | `5` | Max concurrent file/dir processing per batch |
| `branch` | `string` | `"main"` | Git branch to fetch tree from |

### ProcessingResult

Result returned by `RepoProcessor.run()`.

```typescript
interface ProcessingResult {
  filesProcessed: number; // Count of files processed
  filesRemoved: number;   // Count of deleted files
  dirsProcessed: number;  // Count of directories processed
}
```

### File and Directory Contexts

Files are processed top-down (all changed files) and directories bottom-up (deepest first), ensuring child directories are processed before parents.

```typescript
interface FileContext {
  readonly entry: TreeEntry;
  readonly content: string;
}

interface DirectoryContext {
  path: string;
  sha: string;
  subtreeFilePaths: readonly string[];
  children: readonly DirectoryChild[];
  tree: readonly TreeEntry[];
}

interface DirectoryChild {
  readonly name: string;
  readonly isDir: boolean;
  readonly fullPath: string;
}
```

### Usage Example

```typescript
import { RepoProcessor } from "@hardlydifficult/repo-processor";
import { createGitHubClient } from "@hardlydifficult/github";

const processor = new RepoProcessor({
  githubClient: createGitHubClient({ token: process.env.GITHUB_TOKEN! }),
  store: new GitYamlStore({
    cloneUrl: "https://github.com/hardlydifficult/results.git",
    localPath: ".results",
    resultDir: () => "repos",
    gitUser: { name: "CI", email: "ci@example.com" },
  }),
  callbacks: {
    shouldProcess: (entry) => entry.path.endsWith(".ts"),
    processFile: async ({ entry, content }) => ({
      lines: content.split("\n").length,
      checksum: crypto.createHash("sha256").update(content).digest("hex"),
    }),
    processDirectory: async (ctx) => ({
      path: ctx.path,
      fileCount: ctx.subtreeFilePaths.length,
      hasSubdirs: ctx.children.some((c) => c.isDir),
    }),
  },
  concurrency: 10,
});

const result = await processor.run("hardlydifficult", "typescript", (progress) => {
  console.log(`Phase: ${progress.phase} | Files: ${progress.filesCompleted}/${progress.filesTotal}`);
});
// => { filesProcessed: 12, filesRemoved: 0, dirsProcessed: 4 }
```

## RepoWatcher: SHA-based Change Monitoring

The `RepoWatcher` class watches GitHub repositories for SHA changes and triggers processing. It supports automatic state persistence, concurrent run prevention, pending SHA re-triggers, and retry logic.

### Configuration

| Field | Type | Default | Description |
|-------|------|:-------:|-------------|
| `stateKey` | `string` | — | Key used for persisting state (e.g., `"repo-processor"`). |
| `stateDirectory` | `string` | — | Directory where state is persisted. |
| `autoSaveMs` | `number` | `5000` | Auto-save interval in milliseconds. |
| `run` | `(owner: string, name: string) => Promise<T>` | — | Function to execute when processing is triggered. |
| `onComplete` | `(owner, name, result, sha) => void` | — | Called after a successful run (optional). |
| `onError` | `(owner, name, error) => void` | — | Called when a run fails (optional). |
| `onEvent` | `(event) => void` | — | Logger/event callback (optional). |
| `maxAttempts` | `number` | `1` | Max attempts for each run (includes initial + retries). |

### Usage

```typescript
import { RepoWatcher } from "@hardlydifficult/repo-processor";
import { RepoProcessor } from "@hardlydifficult/repo-processor";

const watcher = new RepoWatcher({
  stateKey: "repo-processor",
  stateDirectory: ".state",
  run: async (owner, name) => {
    const processor = new RepoProcessor({
      githubClient: createGitHubClient({ token: process.env.GITHUB_TOKEN! }),
      store: new GitYamlStore({
        cloneUrl: "https://github.com/hardlydifficult/results.git",
        localPath: ".results",
        resultDir: () => "repos",
        gitUser: { name: "CI", email: "ci@example.com" },
      }),
      callbacks: {
        shouldProcess: (entry) => entry.path.endsWith(".ts"),
        processFile: async ({ entry, content }) => ({
          path: entry.path,
          lines: content.split("\n").length,
        }),
        processDirectory: async (ctx) => ({
          path: ctx.path,
          fileCount: ctx.subtreeFilePaths.length,
        }),
      },
    });
    return processor.run(owner, name);
  },
});

await watcher.init(); // Load persisted state
watcher.handlePush("hardlydifficult", "typescript", "abc123");
// Triggers processing if SHA differs from last tracked SHA
```

### Trigger Methods

```typescript
// Handle push events (SHA comparison performed automatically)
watcher.handlePush("hardlydifficult", "typescript", "abc123...");

// Manual trigger (no SHA comparison)
watcher.trigger("hardlydifficult", "typescript");

// Synchronous trigger (blocks until complete)
const response = await watcher.triggerManual("hardlydifficult", "typescript");
// => { success: true, result: ProcessingResult } | { success: false, reason: string }
```

## GitYamlStore: Git-Backed YAML Persistence

The `GitYamlStore` class implements `ProcessorStore` by persisting results as YAML files in a git repository. Each result includes the tree SHA for change detection. It supports authenticated cloning, auto-pull, batch commits, and push with conflict resolution.

### Configuration

| Field | Type | Default | Description |
|-------|------|:-------:|-------------|
| `cloneUrl` | `string` | — | URL of the git repository to clone (e.g., `"https://github.com/user/results.git"`). |
| `localPath` | `string` | — | Local directory to clone the repo into. |
| `resultDir` | `(owner, repo) => string` | — | Function mapping owner/repo to result subdirectory. |
| `authToken` | `string` | `process.env.GITHUB_TOKEN` | GitHub token for authenticated clone/push. |
| `gitUser` | `{ name: string; email: string }` | — | Git user identity used when committing. |

### Loading Results with Schema Validation

```typescript
import { GitYamlStore } from "@hardlydifficult/repo-processor";
import { z } from "zod";

const store = new GitYamlStore({
  cloneUrl: "https://github.com/hardlydifficult/results.git",
  localPath: ".results",
  resultDir: (owner, repo) => `repos/${owner}/${repo}`,
  gitUser: { name: "CI", email: "ci@example.com" },
});

const FileResultSchema = z.object({
  path: z.string(),
  lines: z.number(),
  sha: z.string(),
});
const fileResult = await store.loadFileResult(
  "hardlydifficult",
  "typescript",
  "src/index.ts",
  FileResultSchema
);
// { path: "src/index.ts", lines: 12, sha: "abc..." }
```

## resolveStaleDirectories: Stale Directory Detection

The `resolveStaleDirectories` function identifies directories requiring reprocessing by combining diff-based stale directories with SHA-based comparison.

```typescript
import {
  resolveStaleDirectories,
  GitYamlStore,
} from "@hardlydifficult/repo-processor";
import { createGitHubClient } from "@hardlydifficult/github";

const client = createGitHubClient({ token: process.env.GITHUB_TOKEN! });
const { entries, rootSha } = await client.repo("owner", "repo").getFileTree();
const tree = [...entries, { path: "", type: "tree", sha: rootSha }];

const staleDirs = await resolveStaleDirectories(
  "owner",
  "repo",
  [], // stale dirs from diff
  entries.filter((e) => e.type === "blob").map((e) => e.path),
  tree,
  store
);
// ["src/utils", "src", ""] (bottom-up order inferred later)
```

### Stale Directory Logic

1. **Diff-based stale dirs** — directories with changed/removed children
2. **SHA mismatch** — any directory whose stored SHA differs from the current tree SHA

Directories whose stored SHA is missing are always included.

## Progress Reporting

Progress reported by the `onProgress` callback during `RepoProcessor.run()`.

```typescript
interface ProcessingProgress {
  phase: "loading" | "files" | "directories" | "committing";
  message: string;
  filesTotal: number;
  filesCompleted: number;
  dirsTotal: number;
  dirsCompleted: number;
}
```

| Phase | Description |
|-------|-------------|
| `"loading"` | Initial fetching of file tree. |
| `"files"` | Processing of files. |
| `"directories"` | Processing of directories (bottom-up). |
| `"committing"` | Final commit to persistence. |

## ProcessorStore Interface

Consumer-implemented persistence layer.

| Method | Description |
|--------|-------------|
| `ensureReady?(owner, repo)` | One-time initialization (optional). |
| `getFileManifest(owner, repo)` | Return manifest of previously processed file SHAs (path → blob SHA). |
| `getDirSha(owner, repo, dirPath)` | Return stored SHA for a directory. Null if not stored. |
| `writeFileResult(owner, repo, path, sha, result)` | Persist result for a processed file. |
| `writeDirResult(owner, repo, path, sha, result)` | Persist result for a processed directory. |
| `deleteFileResult(owner, repo, path)` | Delete stored result for a removed file. |
| `commitBatch(owner, repo, count)` | Commit current batch of changes. |

## ProcessorCallbacks Interface

Consumer-provided domain logic.

| Method | Description |
|--------|-------------|
| `shouldProcess(entry)` | Filter: which tree entries should be processed? |
| `processFile(ctx)` | Process a single changed file. Return value passed to `store.writeFileResult`. |
| `processDirectory(ctx)` | Process a directory after all children. Return value passed to `store.writeDirResult`. |

## Setup

No external service setup beyond GitHub is required. The package uses `@hardlydifficult/github` for tree fetches and `simple-git` for git operations.

### Environment Variables

| Variable | Usage |
|---------|-------|
| `GITHUB_TOKEN` | Used by `GitYamlStore` for authenticated git operations if `authToken` not provided |