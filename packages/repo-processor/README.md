# @hardlydifficult/repo-processor

Incremental GitHub repository processor with SHA-based stale detection, parallel file processing, and bottom-up directory updates.

## Installation

```bash
npm install @hardlydifficult/repo-processor
```

## Quick Start

Process all changed files and directories in a GitHub repository, persisting results to a git-backed YAML store:

```typescript
import { RepoProcessor, GitYamlStore } from "@hardlydifficult/repo-processor";
import { GitHubClient } from "@hardlydifficult/github";

const githubClient = new GitHubClient("owner", "repo", "main", process.env.GITHUB_TOKEN!);
const store = new GitYamlStore({
  cloneUrl: "https://github.com/your-org/results-repo.git",
  localPath: "/tmp/results",
  resultDir: (owner, repo) => `${owner}/${repo}`,
  gitUser: { name: "CI Bot", email: "bot@example.com" }
});

const processor = new RepoProcessor({
  githubClient,
  store,
  callbacks: {
    shouldProcess: (entry) => entry.type === "blob" && entry.path.endsWith(".ts"),
    processFile: async ({ entry, content }) => ({
      path: entry.path,
      sha: entry.sha,
      size: content.length,
      lines: content.split("\n").length
    }),
    processDirectory: async ({ path, children, tree }) => ({
      path,
      childrenCount: children.length,
      totalFiles: tree.filter(e => e.type === "blob").length
    })
  },
  concurrency: 5
});

const result = await processor.run("owner", "repo", (progress) => {
  console.log(`${progress.phase}: ${progress.filesCompleted}/${progress.filesTotal} files`);
});

console.log(result);
// {
//   filesProcessed: 12,
//   filesRemoved: 1,
//   dirsProcessed: 4
// }
```

## Core Concepts

### RepoProcessor

The main pipeline orchestrates incremental repository processing by:
- Fetching the file tree from GitHub
- Comparing against a stored manifest of file SHAs to detect changes
- Processing changed files in parallel batches
- Removing files that no longer exist
- Resolving and processing stale directories bottom-up
- Committing results to the git-backed store

#### Configuration

| Option | Description | Default |
|--------|-------------|---------|
| `githubClient` | GitHub client for tree and file access | — |
| `store` | Persistence layer for file/dir results and manifests | — |
| `callbacks` | Domain logic for filtering and processing | — |
| `concurrency` | Max parallel file/dir operations | `5` |
| `branch` | Git branch to use | `"main"` |

### GitYamlStore

A `ProcessorStore` implementation that persists results as YAML files in a git repository.

**File results** are stored at `<resultDir>/<filePath>.yml`.  
**Directory results** are stored at `<resultDir>/<dirPath>/dir.yml`.  
Each file includes a `sha` field for change detection.

```typescript
const store = new GitYamlStore({
  cloneUrl: "https://github.com/your-org/results-repo.git",
  localPath: "/tmp/results",
  resultDir: (owner, repo) => `${owner}/${repo}`,
  gitUser: { name: "CI Bot", email: "bot@example.com" }
});

// Later, load results back
const validated = await store.loadFileResult("owner", "repo", "src/index.ts", z.object({
  path: z.string(),
  sha: z.string(),
  size: z.number(),
  lines: z.number()
}));
```

### resolveStaleDirectories

Determines which directories require reprocessing by combining:
1. Directories identified as stale by `diffTree` (due to file changes/removals)
2. Directories whose stored tree SHA doesn’t match the current tree SHA

```typescript
import { resolveStaleDirectories } from "@hardlydifficult/repo-processor";

const staleDirs = await resolveStaleDirectories(
  "owner",
  "repo",
  diff.staleDirs,             // dirs flagged by diffTree
  allFilePaths,               // current file paths in tree
  tree,                       // full tree array
  store                       // store for SHA comparison
);
```

### Store Interface

The `ProcessorStore` interface defines the contract for persistence implementations:

| Method | Purpose |
|--------|---------|
| `ensureReady?(owner, repo)` | Initialize store (e.g., clone/pull repo) |
| `getFileManifest(owner, repo)` | Retrieve stored file SHAs |
| `getDirSha(owner, repo, dirPath)` | Retrieve stored directory SHA |
| `writeFileResult(owner, repo, path, sha, result)` | Persist file result |
| `writeDirResult(owner, repo, path, sha, result)` | Persist directory result |
| `deleteFileResult(owner, repo, path)` | Remove deleted file result |
| `commitBatch(owner, repo, count)` | Commit batch of changes |

### Contexts and Callbacks

#### `FileContext`

Passed to `processFile`:

| Field | Description |
|-------|-------------|
| `entry` | Tree entry for the file |
| `content` | File content as string |

#### `DirectoryContext`

Passed to `processDirectory`:

| Field | Description |
|-------|-------------|
| `path` | Directory path (`""` for root) |
| `sha` | Tree SHA for the directory |
| `subtreeFilePaths` | All file paths under this directory |
| `children` | Immediate children (files and directories) |
| `tree` | Full tree slice for the directory |

#### `ProcessorCallbacks`

| Method | Signature | Purpose |
|--------|-----------|---------|
| `shouldProcess` | `(entry: TreeEntry) => boolean` | Filter which entries to process |
| `processFile` | `(ctx: FileContext) => Promise<unknown>` | Process a single file |
| `processDirectory` | `(ctx: DirectoryContext) => Promise<unknown>` | Process directory after all children |

### Progress Reporting

The optional `onProgress` callback provides real-time updates:

```typescript
await processor.run("owner", "repo", (progress) => {
  console.log(progress.phase);        // "loading" | "files" | "directories" | "committing"
  console.log(progress.filesTotal);   // Total files to process
  console.log(progress.filesCompleted);
  console.log(progress.dirsTotal);    // Total directories to process
  console.log(progress.dirsCompleted);
});
```

## Processing Result

The `run()` method returns:

```typescript
interface ProcessingResult {
  filesProcessed: number;  // Files processed (including updates)
  filesRemoved: number;    // Files deleted
  dirsProcessed: number;   // Directories processed
}
```

## Pipeline Stages

1. **Init store** – Calls `ensureReady()` if implemented
2. **Fetch tree** – Retrieves full file tree from GitHub
3. **Filter** – Applies `shouldProcess` to file entries
4. **Diff** – Compares current manifest with stored manifest
5. **Process files** – Fetches content, calls `processFile`, persists results
6. **Remove files** – Deletes results for removed files
7. **Resolve stale directories** – Uses SHA mismatch detection
8. **Process directories bottom-up** – Processes deepest directories first
9. **Commit** – Finalizes all changes to the git store

## Error Handling

- File and directory errors are aggregated and reported with full path details
- Failed file processing stops the pipeline immediately with a summary
- Directory processing continues on individual failures but fails fast overall

## Appendices

### SHA-Based Stale Detection

Directories are marked stale when:
- Their stored SHA differs from the current tree SHA, or
- They have no stored SHA (first run)

This enables recovery after partial failures and catches directories whose tree SHA changed without file changes.

### Parallel Processing

Files and directories are processed in batches controlled by `concurrency`:
- Files are grouped into batches and processed in parallel
- Directories are grouped by depth and processed bottom-up within each depth
- Batches commit to the store individually for progress durability