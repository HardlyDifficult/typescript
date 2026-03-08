# @hardlydifficult/repo-processor

Opinionated GitHub repo processing with git-backed YAML results.

The package is built around one happy path:

1. Open a processor for one source repo.
2. Describe how to turn files and directories into results.
3. Run it or attach a watcher.

## Installation

```bash
npm install @hardlydifficult/repo-processor
```

## Quick Start

```typescript
import { RepoProcessor } from "@hardlydifficult/repo-processor";

const processor = await RepoProcessor.open({
  repo: "hardlydifficult/typescript",
  ref: "main",
  results: {
    repo: "hardlydifficult/repo-data",
    directory: "./repo-data",
  },
  include(file) {
    return file.path.endsWith(".ts");
  },
  async processFile(file) {
    return {
      path: file.path,
      sha: file.sha,
      length: file.content.length,
    };
  },
  async processDirectory(directory) {
    return {
      path: directory.path,
      fileCount: directory.files.length,
    };
  },
});

const result = await processor.run({
  onProgress(progress) {
    console.log(progress.phase, progress.message);
  },
});

console.log(result);
// {
//   repo: "hardlydifficult/typescript",
//   sourceSha: "...",
//   processedFiles: 12,
//   removedFiles: 0,
//   processedDirectories: 5
// }
```

## Why This API

- `RepoProcessor.open()` binds the source repo once.
- `run()` does not ask for `owner` and `repo` again.
- GitHub auth and git-backed YAML persistence are built in.
- The default results layout is `repos/<owner>/<repo>`.

## API

### `await RepoProcessor.open(options)`

```typescript
interface RepoProcessorOptions<TFileResult, TDirResult = never> {
  repo: string;
  githubToken?: string;
  ref?: string;
  concurrency?: number;
  results: {
    repo: string;
    directory: string;
    root?: string;
    branch?: string;
    gitUser?: { name: string; email: string };
  };
  include?: (file: {
    path: string;
    sha: string;
    size?: number;
  }) => boolean;
  processFile(file: {
    repo: string;
    path: string;
    sha: string;
    content: string;
  }): Promise<TFileResult>;
  processDirectory?: (directory: {
    repo: string;
    path: string;
    sha: string;
    files: readonly string[];
    children: readonly {
      name: string;
      path: string;
      type: "file" | "directory";
    }[];
  }) => Promise<TDirResult>;
}
```

Notes:

- `repo` and `results.repo` accept either `owner/repo` or a GitHub URL.
- `githubToken` defaults to `GH_PAT`, then `GITHUB_TOKEN`.
- `results.root` defaults to `"repos"`.
- `results.branch` defaults to the checked-out branch in the results clone.
- `results.gitUser` defaults to local git config (`user.name` and `user.email`).

### `await processor.run({ onProgress? })`

```typescript
type RepoProcessorRunResult = {
  repo: string;
  sourceSha: string;
  processedFiles: number;
  removedFiles: number;
  processedDirectories: number;
};
```

```typescript
type RepoProcessorProgress = {
  phase: "loading" | "files" | "directories" | "committing";
  message: string;
  files: { total: number; completed: number };
  directories: { total: number; completed: number };
};
```

If `processDirectory` is omitted, directory diffing and directory result writes are skipped.

### Reading Stored Results

```typescript
const fileResult = await processor.readFileResult(
  "src/index.ts",
  schema
);

const directoryResult = await processor.readDirectoryResult(
  "src",
  schema
);
```

## Watching A Repo

```typescript
const watcher = await processor.watch({
  stateDirectory: "./state",
  maxAttempts: 3,
  onComplete(result, sha) {
    console.log("processed", sha, result.processedFiles);
  },
});

watcher.handlePush("abc123");
await watcher.runNow();
```

Watcher methods:

- `handlePush(sha)`
- `runNow()`
- `isRunning()`
- `getLastSha()`
- `setLastSha(sha)`
