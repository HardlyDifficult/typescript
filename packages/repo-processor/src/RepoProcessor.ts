import { bottomUp, inBatches } from "@hardlydifficult/collections";
import {
  diffTree,
  GitHubClient,
  parseGitHubRepoReference,
  type TreeEntry,
} from "@hardlydifficult/github";
import { getErrorMessage } from "@hardlydifficult/text";
import type { z } from "zod";

import { GitYamlStore } from "./GitYamlStore.js";
import type {
  BoundRepoRef,
  ProcessingFailure,
  RepoProcessorInternals,
} from "./internalTypes.js";
import { RepoWatcher } from "./RepoWatcher.js";
import { resolveStaleDirectories } from "./resolveDirectories.js";
import type {
  RepoDirectoryChild,
  RepoDirectoryInput,
  RepoProcessorOptions,
  RepoProcessorProgress,
  RepoProcessorRunOptions,
  RepoProcessorRunResult,
  RepoWatcherOptions,
} from "./types.js";

function parseRepoReference(value: string, label: string): BoundRepoRef {
  const parsed = parseGitHubRepoReference(value);
  if (parsed === null) {
    throw new Error(
      `Invalid ${label}: ${value}. Expected "owner/repo" or a GitHub URL.`
    );
  }

  return {
    owner: parsed.owner,
    name: parsed.repo,
    fullName: `${parsed.owner}/${parsed.repo}`,
  };
}

function formatFailures(
  label: string,
  failures: readonly ProcessingFailure[]
): Error {
  const details = failures
    .map((failure) => `  ${failure.path}: ${getErrorMessage(failure.reason)}`)
    .join("\n");
  return new Error(
    `${String(failures.length)} ${label} failed to process:\n${details}`
  );
}

export class RepoProcessor<TFileResult = unknown, TDirResult = never> {
  static async open<TFileResult, TDirResult = never>(
    options: RepoProcessorOptions<TFileResult, TDirResult>
  ): Promise<RepoProcessor<TFileResult, TDirResult>> {
    const repo = parseRepoReference(options.repo, "repo");
    const resultsRepo = parseRepoReference(
      options.results.repo,
      "results repo"
    );
    const githubToken =
      options.githubToken ?? process.env.GH_PAT ?? process.env.GITHUB_TOKEN;
    const github = new GitHubClient({ token: githubToken });
    const sourceRepo = github.repo(repo.fullName);
    const store = new GitYamlStore({
      sourceRepo: repo,
      resultsRepo,
      localPath: options.results.directory,
      root: options.results.root ?? "repos",
      branch: options.results.branch,
      authToken: githubToken,
      gitUser: options.results.gitUser,
    });

    return new RepoProcessor({
      repo,
      repoClient: {
        getFileTree(ref: string | undefined) {
          return sourceRepo.tree(ref);
        },
        getFileContent(filePath: string, ref: string | undefined) {
          return sourceRepo.read(filePath, ref);
        },
      },
      store,
      ref: options.ref,
      concurrency: options.concurrency ?? 5,
      include: options.include ?? (() => true),
      processFile: options.processFile,
      processDirectory: options.processDirectory,
    });
  }

  private readonly repoRef: BoundRepoRef;
  private readonly repoClient: RepoProcessorInternals<
    TFileResult,
    TDirResult
  >["repoClient"];
  private readonly store: RepoProcessorInternals<
    TFileResult,
    TDirResult
  >["store"];
  private readonly ref: string | undefined;
  private readonly concurrency: number;
  private readonly include: RepoProcessorInternals<
    TFileResult,
    TDirResult
  >["include"];
  private readonly processFileHandler: RepoProcessorInternals<
    TFileResult,
    TDirResult
  >["processFile"];
  private readonly processDirectoryHandler:
    | RepoProcessorInternals<TFileResult, TDirResult>["processDirectory"]
    | undefined;

  private constructor(
    internals: RepoProcessorInternals<TFileResult, TDirResult>
  ) {
    this.repoRef = internals.repo;
    this.repoClient = internals.repoClient;
    this.store = internals.store;
    this.ref = internals.ref;
    this.concurrency = internals.concurrency;
    this.include = internals.include;
    this.processFileHandler = internals.processFile;
    this.processDirectoryHandler = internals.processDirectory;
  }

  get repo(): string {
    return this.repoRef.fullName;
  }

  async run(
    options: RepoProcessorRunOptions = {}
  ): Promise<RepoProcessorRunResult> {
    const onProgress = options.onProgress;

    const emitProgress = (
      phase: RepoProcessorProgress["phase"],
      message: string,
      filesTotal: number,
      filesCompleted: number,
      dirsTotal: number,
      dirsCompleted: number
    ): void => {
      onProgress?.({
        phase,
        message,
        files: { total: filesTotal, completed: filesCompleted },
        directories: { total: dirsTotal, completed: dirsCompleted },
      });
    };

    emitProgress("loading", "Initializing results store...", 0, 0, 0, 0);
    await this.store.ensureReady();

    emitProgress("loading", "Fetching source tree...", 0, 0, 0, 0);
    const { entries, rootSha } = await this.repoClient.getFileTree(this.ref);
    const tree: readonly TreeEntry[] = [
      ...entries,
      { path: "", type: "tree", sha: rootSha },
    ];

    const blobs = entries.filter(
      (entry): entry is TreeEntry & { type: "blob" } => {
        if (entry.type !== "blob") {
          return false;
        }

        return this.include({
          path: entry.path,
          sha: entry.sha,
          size: entry.size,
        });
      }
    );

    const currentManifest = await this.store.getFileManifest();
    const diff = diffTree(blobs, currentManifest);

    const filesTotal = diff.changedFiles.length;
    let filesCompleted = 0;
    emitProgress(
      "files",
      filesTotal === 0
        ? "No files to process."
        : `Processing ${String(filesTotal)} files...`,
      filesTotal,
      0,
      0,
      0
    );

    const fileFailures: ProcessingFailure[] = [];
    for (const batch of inBatches(diff.changedFiles, this.concurrency)) {
      const results = await Promise.allSettled(
        batch.map(async (entry) => {
          const content = await this.repoClient.getFileContent(
            entry.path,
            this.ref
          );
          const result = await this.processFileHandler({
            repo: this.repo,
            path: entry.path,
            sha: entry.sha,
            content,
          });
          await this.store.writeFileResult(entry.path, entry.sha, result);
        })
      );

      let succeededCount = 0;
      for (let index = 0; index < results.length; index++) {
        const result = results[index];
        filesCompleted++;
        if (result.status === "rejected") {
          fileFailures.push({
            path: batch[index]?.path ?? `unknown-${String(index)}`,
            reason: result.reason,
          });
        } else {
          succeededCount++;
        }

        emitProgress(
          "files",
          `Files: ${String(filesCompleted)}/${String(filesTotal)}`,
          filesTotal,
          filesCompleted,
          0,
          0
        );
      }

      if (succeededCount > 0) {
        await this.store.commitBatch(this.repo, succeededCount);
      }
    }

    if (fileFailures.length > 0) {
      throw formatFailures("file(s)", fileFailures);
    }

    for (const removedPath of diff.removedFiles) {
      await this.store.deleteFileResult(removedPath);
    }
    if (diff.removedFiles.length > 0) {
      await this.store.commitBatch(this.repo, diff.removedFiles.length);
    }

    let dirsCompleted = 0;
    if (this.processDirectoryHandler !== undefined) {
      const allFilePaths = blobs.map((blob) => blob.path);
      const allDirs = await resolveStaleDirectories(
        diff.staleDirs,
        allFilePaths,
        tree,
        this.store
      );

      emitProgress(
        "directories",
        allDirs.length === 0
          ? "No directories to process."
          : `Processing ${String(allDirs.length)} directories...`,
        filesTotal,
        filesCompleted,
        allDirs.length,
        0
      );

      const directoryFailures: ProcessingFailure[] = [];
      for (const dirsAtDepth of bottomUp(allDirs)) {
        let succeededCount = 0;

        for (const batch of inBatches(dirsAtDepth, this.concurrency)) {
          const results = await Promise.allSettled(
            batch.map(async (dirPath) => {
              const directory = this.buildDirectoryInput(
                dirPath,
                tree,
                allFilePaths
              );
              const result = await this.processDirectoryHandler?.(directory);
              await this.store.writeDirResult(dirPath, directory.sha, result);
            })
          );

          for (let index = 0; index < results.length; index++) {
            const result = results[index];
            dirsCompleted++;
            if (result.status === "rejected") {
              directoryFailures.push({
                path: batch[index] ?? `unknown-${String(index)}`,
                reason: result.reason,
              });
            } else {
              succeededCount++;
            }

            emitProgress(
              "directories",
              `Directories: ${String(dirsCompleted)}/${String(allDirs.length)}`,
              filesTotal,
              filesCompleted,
              allDirs.length,
              dirsCompleted
            );
          }
        }

        if (succeededCount > 0) {
          await this.store.commitBatch(this.repo, succeededCount);
        }
      }

      if (directoryFailures.length > 0) {
        throw formatFailures("directory(ies)", directoryFailures);
      }
    }

    emitProgress(
      "committing",
      "Finalizing results...",
      filesTotal,
      filesCompleted,
      this.processDirectoryHandler === undefined ? 0 : dirsCompleted,
      dirsCompleted
    );
    await this.store.commitBatch(this.repo, 0);

    return {
      repo: this.repo,
      sourceSha: rootSha,
      processedFiles: filesCompleted,
      removedFiles: diff.removedFiles.length,
      processedDirectories: dirsCompleted,
    };
  }

  async readFileResult<T>(
    filePath: string,
    schema: z.ZodType<T>
  ): Promise<T | null> {
    return this.store.readFileResult(filePath, schema);
  }

  async readDirectoryResult<T>(
    dirPath: string,
    schema: z.ZodType<T>
  ): Promise<T | null> {
    return this.store.readDirectoryResult(dirPath, schema);
  }

  async watch(
    options: RepoWatcherOptions = {}
  ): Promise<RepoWatcher<TFileResult, TDirResult>> {
    return RepoWatcher.open(this, options);
  }

  private buildDirectoryInput(
    dirPath: string,
    tree: readonly TreeEntry[],
    allFilePaths: readonly string[]
  ): RepoDirectoryInput {
    const dirTreeEntry = tree.find(
      (entry): entry is TreeEntry & { type: "tree" } =>
        entry.type === "tree" && entry.path === dirPath
    );
    const prefix = dirPath === "" ? "" : `${dirPath}/`;
    const files = allFilePaths.filter(
      (filePath) => dirPath === "" || filePath.startsWith(prefix)
    );

    const seen = new Set<string>();
    const children: RepoDirectoryChild[] = [];

    for (const filePath of files) {
      const relative = prefix === "" ? filePath : filePath.slice(prefix.length);
      const slashIndex = relative.indexOf("/");
      const isDirectory = slashIndex !== -1;
      const childName = isDirectory ? relative.slice(0, slashIndex) : relative;

      if (seen.has(childName)) {
        continue;
      }

      seen.add(childName);
      children.push({
        name: childName,
        path: dirPath === "" ? childName : `${dirPath}/${childName}`,
        type: isDirectory ? "directory" : "file",
      });
    }

    return {
      repo: this.repo,
      path: dirPath,
      sha: dirTreeEntry?.sha ?? "",
      files,
      children,
    };
  }
}

export function createRepoProcessorForTests<
  TFileResult = unknown,
  TDirResult = never,
>(
  internals: RepoProcessorInternals<TFileResult, TDirResult>
): RepoProcessor<TFileResult, TDirResult> {
  const RepoProcessorCtor = RepoProcessor as unknown as {
    new (
      config: RepoProcessorInternals<TFileResult, TDirResult>
    ): RepoProcessor<TFileResult, TDirResult>;
  };
  return new RepoProcessorCtor(internals);
}
