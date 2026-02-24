# @hardlydifficult/repo-processor

Incremental GitHub repository processor with SHA-based stale detection, parallel batch processing (files bottom-up, directories top-down), and git-backed YAML persistence.

## Installation

```bash
npm install @hardlydifficult/repo-processor
```

## Quick Start

```typescript
import { RepoProcessor, GitYamlStore, type ProcessingProgress } from "@hardlydifficult/repo-processor";
import { GitHubClient } from "@hardlydifficult/github";

// Setup the git-backed YAML store for state persistence
const store = new GitYamlStore({
  cloneUrl: "https://github.com/owner/repo-data.git",
  localPath: "./repo-data",
  resultDir: (owner, repo) => `repos/${owner}/${repo}`,
  gitUser: { name: "Processor Bot", email: "bot@example.com" },
});

// Build a GitHub client with token authentication
const github = new GitHubClient({ token: process.env.GITHUB_TOKEN });

// Configure callbacks to define how files and directories are processed
const callbacks = {
  shouldProcess: (entry) => entry.path.endsWith(".ts"),
  processFile: async ({ entry, content }) => ({
    path: entry.path,
    sha: entry.sha,
    length: content.length,
  }),
  processDirectory: async ({ path, subtreeFilePaths }) => ({
    path,
    fileCount: subtreeFilePaths.length,
  }),
};

// Create and run the processor
const processor = new RepoProcessor({
  githubClient: github,
  store,
  callbacks,
  concurrency: 5, // Optional: default 5
  branch: "main", // Optional: default "main"
});

const result = await processor.run("hardlydifficult", "typescript", (progress) => {
  console.log(`${progress.phase}: ${progress.message}`);
});

// Example result:
// {
//   filesProcessed: 12,
//   filesRemoved: 0,
//   dirsProcessed: 5
// }
```

## RepoProcessor

Processes GitHub repositories incrementally by fetching file trees, detecting changes via SHA diffing, and persisting results.

### Constructor

| Parameter | Description |
|-----------|-------------|
| `githubClient` | GitHub client for fetching trees and file contents |
| `store` | Persistence layer implementing `ProcessorStore` |
| `callbacks` | Domain logic callbacks (`shouldProcess`, `processFile`, `processDirectory`) |
| `concurrency?` | Parallel batch size (default: `5`) |
| `branch?` | Git branch to fetch from (default: `"main"`) |

### `run(owner, repo, onProgress?)`

Processes the repository and returns a summary.

**Returns:**
```typescript
{
  filesProcessed: number;
  filesRemoved: number;
  dirsProcessed: number;
}
```

**Example:**
```typescript
const result = await processor.run("hardlydifficult", "typescript", (progress) => {
  console.log(`Phase: ${progress.phase}, Files: ${progress.filesCompleted}/${progress.filesTotal}`);
});
```

### Directory Processing

Directories are processed bottom-up (deepest first) after all files. Each directory context includes:
- `path`: Directory path (empty string for root)
- `sha`: Git tree SHA
- `subtreeFilePaths`: All file paths beneath the directory
- `children`: Immediate children (files and subdirectories)
- `tree`: Full repo tree entries

## RepoWatcher

Watches repositories for SHA changes and triggers processing with retry logic and deduplication.

### Constructor

```typescript
interface RepoWatcherConfig<TResult> {
  stateKey: string;              // Key for persisting state
  stateDirectory: string;        // Directory for state files
  autoSaveMs?: number;           // Auto-save interval (default: 5000)
  run: (owner: string, name: string) => Promise<TResult>;
  onComplete?: (owner: string, name: string, result: TResult, sha: string) => void;
  onError?: (owner: string, name: string, error: unknown) => void;
  onEvent?: (event: StateTrackerEvent) => void;
  maxAttempts?: number;          // Retry attempts (default: 1)
}
```

### Methods

| Method | Description |
|--------|-------------|
| `init()` | Load persisted state from disk |
| `handlePush(owner, name, sha)` | Handle GitHub push event. Queues processing if SHA changed |
| `trigger(owner, name)` | Manually trigger processing (skips SHA check) |
| `triggerManual(owner, name)` | Synchronous trigger. Returns `{ success, result }` |
| `isRunning(owner, name)` | Check if repo is currently processing |
| `getLastSha(key)` | Get last processed SHA for a repo key |
| `setLastSha(key, sha)` | Manually set last processed SHA |

**Example:**
```typescript
const watcher = new RepoWatcher({
  stateKey: "repo-processor",
  stateDirectory: "./state",
  run: async (owner, name) => {
    const processor = new RepoProcessor({ /* ... */ });
    return await processor.run(owner, name);
  },
  onComplete: (owner, name, result, sha) => {
    console.log(`Processed ${owner}/${name}, SHA: ${sha}`);
  },
  maxAttempts: 3,
});

await watcher.init();
watcher.handlePush("hardlydifficult", "typescript", "abc123");
```

## GitYamlStore

Persists processing results as YAML files in a git repository.

### Constructor

| Parameter | Description |
|-----------|-------------|
| `cloneUrl` | URL of the git repository to clone/pull |
| `localPath` | Local directory to clone the repo into |
| `resultDir` | Function mapping `(owner, repo)` to result subdirectory |
| `authToken?` | GitHub token for authenticated operations (fallback: `GITHUB_TOKEN` env) |
| `gitUser` | Git committer identity: `{ name: string, email: string }` |

### Result Storage

- File results: `<resultDir>/<filePath>.yml`
- Directory results: `<resultDir>/<dirPath>/dir.yml`

Each YAML file includes a `sha` field for change detection.

**Example:**
```typescript
const store = new GitYamlStore({
  cloneUrl: "https://github.com/owner/repo-data.git",
  localPath: "./data",
  resultDir: (owner, repo) => `results/${owner}/${repo}`,
  gitUser: { name: "Processor Bot", email: "bot@example.com" },
});
```

### Typed Load Helpers

```typescript
// Load file result with Zod validation
const result = await store.loadFileResult(
  "owner",
  "repo",
  "src/index.ts",
  z.object({ path: z.string(), sha: z.string(), length: z.number() })
);

// Load directory result with Zod validation
const dirResult = await store.loadDirResult(
  "owner",
  "repo",
  "src/utils",
  z.object({ path: z.string(), fileCount: z.number() })
);
```

## resolveStaleDirectories

Identifies directories requiring reprocessing by combining SHA-based stale detection with diff-derived stale directories.

### Signature

```typescript
async function resolveStaleDirectories(
  owner: string,
  repo: string,
  staleDirsFromDiff: readonly string[],
  allFilePaths: readonly string[],
  tree: readonly TreeEntry[],
  store: ProcessorStore
): Promise<string[]>
```

**Logic:**
1. Start with stale directories from file diff
2. Add any directory whose stored SHA is missing or differs from current tree SHA
3. Always include root directory if missing

**Example:**
```typescript
const staleDirs = await resolveStaleDirectories(
  "owner",
  "repo",
  ["src"], // directories with changed children
  ["src/index.ts", "src/utils/helper.ts"],
  treeEntries,
  store
);

// Returns ["src", "src/utils"] if SHAs differ or missing
```

## Types

### ProcessorStore Interface

| Method | Description |
|--------|-------------|
| `ensureReady?(owner, repo)` | One-time init (e.g. clone repo). Optional |
| `getFileManifest(owner, repo)` | Get manifest of previous file SHAs |
| `getDirSha(owner, repo, dirPath)` | Get stored directory SHA |
| `writeFileResult(owner, repo, path, sha, result)` | Persist file result |
| `writeDirResult(owner, repo, path, sha, result)` | Persist directory result |
| `deleteFileResult(owner, repo, path)` | Delete result for removed file |
| `commitBatch(owner, repo, count)` | Commit changes |

### Callback Interfaces

```typescript
interface FileContext {
  entry: TreeEntry;
  content: string;
}

interface DirectoryContext {
  path: string;
  sha: string;
  subtreeFilePaths: readonly string[];
  children: readonly DirectoryChild[];
  tree: readonly TreeEntry[];
}

interface DirectoryChild {
  name: string;
  isDir: boolean;
  fullPath: string;
}

interface ProcessorCallbacks {
  shouldProcess(entry: TreeEntry): boolean;
  processFile(ctx: FileContext): Promise<unknown>;
  processDirectory(ctx: DirectoryContext): Promise<unknown>;
}

interface ProcessingProgress {
  phase: "loading" | "files" | "directories" | "committing";
  message: string;
  filesTotal: number;
  filesCompleted: number;
  dirsTotal: number;
  dirsCompleted: number;
}

interface ProcessingResult {
  filesProcessed: number;
  filesRemoved: number;
  dirsProcessed: number;
}
```

## Error Handling

File and directory processing failures throw descriptive errors:

```typescript
try {
  await processor.run("owner", "repo");
} catch (error) {
  // Error includes all failed paths and messages
  // e.g., "2 file(s) failed to process:\nfile1.ts: Connection timeout\nfile2.ts: Invalid format"
}
```

### Retries

`RepoWatcher` includes automatic retries for transient failures:

```typescript
const watcher = new RepoWatcher({
  // ...
  maxAttempts: 3, // Initial + 2 retries
  onError: (owner, name, error) => {
    console.error(`Failed for ${owner}/${name}: ${error}`);
  },
});
```