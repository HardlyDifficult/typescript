import { chunk, groupByDepth } from "@hardlydifficult/collections";
import {
  diffTree,
  type GitHubClient,
  type TreeEntry,
} from "@hardlydifficult/github";
import { getErrorMessage } from "@hardlydifficult/text";

import { resolveStaleDirectories } from "./resolveDirectories.js";
import type {
  DirectoryChild,
  DirectoryContext,
  ProcessingProgress,
  ProcessingResult,
  ProcessorCallbacks,
  ProcessorStore,
  ProgressCallback,
} from "./types.js";

export interface RepoProcessorConfig {
  githubClient: GitHubClient;
  store: ProcessorStore;
  callbacks: ProcessorCallbacks;
  concurrency?: number;
  branch?: string;
}

/**
 * Generic pipeline for incrementally processing a GitHub repo's file tree.
 *
 * Pipeline: init → fetch tree → filter → diff → process changed files →
 * remove deleted files → resolve stale dirs → process dirs bottom-up → commit.
 */
export class RepoProcessor {
  private readonly github: GitHubClient;
  private readonly store: ProcessorStore;
  private readonly callbacks: ProcessorCallbacks;
  private readonly concurrency: number;
  private readonly branch: string;

  constructor(config: RepoProcessorConfig) {
    this.github = config.githubClient;
    this.store = config.store;
    this.callbacks = config.callbacks;
    this.concurrency = config.concurrency ?? 5;
    this.branch = config.branch ?? "main";
  }

  async run(
    owner: string,
    repo: string,
    onProgress?: ProgressCallback
  ): Promise<ProcessingResult> {
    const emitProgress = (
      phase: ProcessingProgress["phase"],
      message: string,
      filesTotal: number,
      filesCompleted: number,
      dirsTotal: number,
      dirsCompleted: number
    ): void => {
      onProgress?.({
        phase,
        message,
        filesTotal,
        filesCompleted,
        dirsTotal,
        dirsCompleted,
      });
    };

    // 1. Init store
    emitProgress("loading", "Initializing store...", 0, 0, 0, 0);
    await this.store.ensureReady?.(owner, repo);

    // 2. Fetch tree
    emitProgress("loading", "Fetching file tree...", 0, 0, 0, 0);
    const { entries, rootSha } = await this.github
      .repo(owner, repo)
      .getFileTree();
    const tree: readonly TreeEntry[] = [
      ...entries,
      { path: "", type: "tree", sha: rootSha },
    ];

    // 3. Filter blobs
    const blobs = entries.filter(
      (e) => e.type === "blob" && this.callbacks.shouldProcess(e)
    );

    // 4. Diff
    const currentManifest = await this.store.getFileManifest(owner, repo);
    const diff = diffTree(blobs, currentManifest);

    const filesTotal = diff.changedFiles.length;
    let filesCompleted = 0;

    emitProgress(
      "files",
      `Processing ${String(filesTotal)} files...`,
      filesTotal,
      0,
      diff.staleDirs.length,
      0
    );

    // 5. Process changed files in batches
    const fileBatches = chunk(diff.changedFiles, this.concurrency);
    for (const batch of fileBatches) {
      const results = await Promise.allSettled(
        batch.map(async (entry) => {
          const content = await this.github
            .repo(owner, repo)
            .getFileContent(entry.path);
          const result = await this.callbacks.processFile({ entry, content });
          await this.store.writeFileResult(
            owner,
            repo,
            entry.path,
            entry.sha,
            result
          );
        })
      );

      const failures: { path: string; reason: unknown }[] = [];
      let succeededCount = 0;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        filesCompleted++;
        if (result.status === "rejected") {
          failures.push({
            path: batch[i]?.path ?? `unknown-${String(i)}`,
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
          diff.staleDirs.length,
          0
        );
      }

      if (failures.length > 0) {
        const details = failures
          .map((f) => `  ${f.path}: ${getErrorMessage(f.reason)}`)
          .join("\n");
        throw new Error(
          `${String(failures.length)} file(s) failed to process:\n${details}`
        );
      }

      if (succeededCount > 0) {
        await this.store.commitBatch(owner, repo, succeededCount);
      }
    }

    // 6. Remove deleted files
    for (const removedPath of diff.removedFiles) {
      await this.store.deleteFileResult(owner, repo, removedPath);
    }
    if (diff.removedFiles.length > 0) {
      await this.store.commitBatch(owner, repo, diff.removedFiles.length);
    }

    // 7. Resolve stale directories
    const allFilePaths = blobs.map((b) => b.path);
    const allDirs = await resolveStaleDirectories(
      owner,
      repo,
      diff.staleDirs,
      allFilePaths,
      tree,
      this.store
    );
    let dirsCompleted = 0;

    if (allDirs.length > 0) {
      emitProgress(
        "directories",
        `Processing ${String(allDirs.length)} directories...`,
        filesTotal,
        filesCompleted,
        allDirs.length,
        0
      );

      // 8. Process directories bottom-up by depth
      const depthGroups = groupByDepth(allDirs);

      for (const { paths: dirsAtDepth } of depthGroups) {
        const batches = chunk(dirsAtDepth, this.concurrency);
        let dirsInDepthGroup = 0;

        for (const batch of batches) {
          const results = await Promise.allSettled(
            batch.map(async (dirPath) => {
              const ctx = this.buildDirectoryContext(
                dirPath,
                tree,
                allFilePaths
              );
              const result = await this.callbacks.processDirectory(ctx);
              await this.store.writeDirResult(
                owner,
                repo,
                dirPath,
                ctx.sha,
                result
              );
            })
          );

          const failures: { path: string; reason: unknown }[] = [];
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            dirsCompleted++;
            dirsInDepthGroup++;
            if (result.status === "rejected") {
              failures.push({
                path: batch[i] ?? `unknown-${String(i)}`,
                reason: result.reason,
              });
            }
            emitProgress(
              "directories",
              `Dirs: ${String(dirsCompleted)}/${String(allDirs.length)}`,
              filesTotal,
              filesCompleted,
              allDirs.length,
              dirsCompleted
            );
          }

          if (failures.length > 0) {
            const details = failures
              .map((f) => `  ${f.path}: ${getErrorMessage(f.reason)}`)
              .join("\n");
            throw new Error(
              `${String(failures.length)} directory(ies) failed to process:\n${details}`
            );
          }
        }

        if (dirsInDepthGroup > 0) {
          await this.store.commitBatch(owner, repo, dirsInDepthGroup);
        }
      }
    }

    // 9. Final safety commit
    emitProgress(
      "committing",
      "Final commit...",
      filesTotal,
      filesCompleted,
      allDirs.length,
      dirsCompleted
    );
    await this.store.commitBatch(owner, repo, 0);

    return {
      filesProcessed: filesCompleted,
      filesRemoved: diff.removedFiles.length,
      dirsProcessed: dirsCompleted,
    };
  }

  private buildDirectoryContext(
    dirPath: string,
    tree: readonly TreeEntry[],
    allFilePaths: readonly string[]
  ): DirectoryContext {
    const dirTreeEntry = tree.find(
      (e) => e.type === "tree" && e.path === dirPath
    );
    const sha = dirTreeEntry?.sha ?? "";

    const prefix = dirPath === "" ? "" : `${dirPath}/`;
    const subtreeFilePaths = allFilePaths.filter(
      (fp) => dirPath === "" || fp.startsWith(prefix)
    );

    // Build immediate children list
    const seen = new Set<string>();
    const children: DirectoryChild[] = [];

    for (const fp of subtreeFilePaths) {
      const relative = prefix ? fp.slice(prefix.length) : fp;
      const slashIndex = relative.indexOf("/");
      const isDir = slashIndex !== -1;
      const childName = isDir ? relative.slice(0, slashIndex) : relative;

      if (!seen.has(childName)) {
        seen.add(childName);
        children.push({
          name: childName,
          isDir,
          fullPath: dirPath === "" ? childName : `${dirPath}/${childName}`,
        });
      }
    }

    return { path: dirPath, sha, subtreeFilePaths, children, tree };
  }
}
