# @hardlydifficult/repo-processor

Incremental GitHub repository processor that fetches file trees, diffs against a manifest, processes files in parallel, and updates directories bottom-up with SHA-based stale detection.

## Installation

```bash
npm install @hardlydifficult/repo-processor
```

## Quick Start

Process all `.ts` files in a repository and generate summaries:

```typescript
import { RepoProcessor, GitYamlStore } from "@hardlydifficult/repo-processor";
import { GitHubClient } from "@hardlydifficult/github";

// Create store that persists results to a git repository
const store = new GitYamlStore({
  cloneUrl: "https://github.com/owner/repo.git",
  localPath: "./results",
  resultDir: (owner, repo) => `${owner}/${repo}`,
});

// Create GitHub client (requires GITHUB_TOKEN env var or token in constructor)
const github = new GitHubClient({ authToken: process.env.GITHUB_TOKEN });

// Create processor with custom callbacks
const processor = new RepoProcessor({
  githubClient: github,
  store,
  callbacks: {
    shouldProcess: (entry) => entry.path.endsWith(".ts"),
    async processFile({ entry, content }) {
      return { summary: `Processed ${entry.path}` };
    },
    async processDirectory(ctx) {
      return { fileCount: ctx.subtreeFilePaths.length };
    },
  },
});

// Run the processor
const result = await processor.run("owner", "repo", (progress) => {
  console.log(`${progress.phase}: ${progress.filesCompleted}/${progress.filesTotal} files`);
});
```

## Core Concepts

### RepoProcessor

The main processor class that orchestrates incremental GitHub repository updates using the following pipeline:
1. Initializes the store and fetches the file tree from GitHub
2. Filters entries and computes diffs against the previous manifest
3. Processes changed files in parallel with configurable concurrency
4. Removes deleted files
5. Resolves stale directories (by SHA mismatch or diff)
6. Processes directories bottom-up by depth

### RepoProcessorConfig

| Field | Description |
|-------|-------------|
| `githubClient` | GitHub client for fetching trees and file contents |
| `store` | Persistent store implementing `ProcessorStore` interface |
| `callbacks` | Consumer-provided domain logic for filtering and processing |
| `concurrency?` | Max concurrent file/directory operations (default: `5`) |
| `branch?` | Repository branch to process (default: `"main"`) |

### ProcessorCallbacks

Consumer-implemented domain logic for filtering and processing:

| Callback | Description |
|----------|-------------|
| `shouldProcess(entry)` | Returns `true` if the tree entry should be processed |
| `processFile(ctx)` | Processes a file's content; result saved to store |
| `processDirectory(ctx)` | Processes a directory after all children are processed |

### FileContext

Passed to `processFile`:

| Field | Type | Description |
|-------|------|-------------|
| `entry` | `TreeEntry` | Tree entry metadata (path, sha, type) |
| `content` | `string` | Raw file contents from GitHub |

### DirectoryContext

Passed to `processDirectory`:

| Field | Type | Description |
|-------|------|-------------|
| `path` | `string` | Directory path (empty string for root) |
| `sha` | `string` | Current tree SHA for the directory |
| `subtreeFilePaths` | `readonly string[]` | All file paths under this directory |
| `children` | `readonly DirectoryChild[]` | Immediate children (files and subdirs) |
| `tree` | `readonly TreeEntry[]` | Full tree for the repository |

### DirectoryChild

Immediate child of a directory:

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Child name (file/dir name) |
| `isDir` | `boolean` | `true` if child is a directory |
| `fullPath` | `string` | Full path to the child |

### GitYamlStore

Persistent store implementation using a local git repository with YAML files:

```typescript
const store = new GitYamlStore({
  cloneUrl: "https://github.com/owner/repo.git",
  localPath: "./results",
  resultDir: (owner, repo) => `${owner}/${repo}`,
  authToken?: string; // optional; falls back to GITHUB_TOKEN
});
```

File results are stored at `<resultDir>/<filePath>.yml`.  
Directory results are stored at `<resultDir>/<dirPath>/dir.yml`.  
Each YAML file includes a `sha` field for change detection.

### resolveStaleDirectories

Determines which directories need reprocessing by combining two sources:
1. Directories identified as stale via `diffTree` (changed/removed children)
2. Directories whose stored SHA differs from the current tree SHA

```typescript
const staleDirs = await resolveStaleDirectories(
  owner,
  repo,
  staleDirsFromDiff,
  allFilePaths,
  tree,
  store
);
```

## Progress Reporting

During `RepoProcessor.run`, progress callbacks are called with:

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

## Result

`RepoProcessor.run` returns:

```typescript
interface ProcessingResult {
  filesProcessed: number;
  filesRemoved: number;
  dirsProcessed: number;
}
```