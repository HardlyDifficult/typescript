import {
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { formatYaml } from "@hardlydifficult/text";
import { parse as parseYaml } from "yaml";
import type { z } from "zod";

import type { FileManifest, ProcessorStore } from "./types.js";

export interface GitYamlStoreConfig {
  /** URL of the git repository to clone/pull. */
  cloneUrl: string;
  /** Local directory to clone the repo into. */
  localPath: string;
  /** Maps (owner, repo) to the subdirectory where results are stored. */
  resultDir: (owner: string, repo: string) => string;
  /** GitHub token for authenticated clone/push. Falls back to GITHUB_TOKEN env. */
  authToken?: string;
}

/**
 * A ProcessorStore implementation that persists results as YAML files
 * in a git repository.
 *
 * File results are stored at `<resultDir>/<filePath>.yml`.
 * Directory results are stored at `<resultDir>/<dirPath>/dir.yml`.
 * Each YAML file includes a `sha` field for change detection.
 */
export class GitYamlStore implements ProcessorStore {
  private readonly localPath: string;
  private readonly cloneUrl: string;
  private readonly authToken: string | undefined;
  private readonly resultDir: (owner: string, repo: string) => string;
  private initialized = false;

  constructor(config: GitYamlStoreConfig) {
    this.cloneUrl = config.cloneUrl;
    this.localPath = config.localPath;
    this.resultDir = config.resultDir;
    this.authToken = config.authToken ?? process.env.GITHUB_TOKEN;
  }

  // ---------------------------------------------------------------------------
  // ProcessorStore implementation
  // ---------------------------------------------------------------------------

  async ensureReady(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const { simpleGit } = await import("simple-git");
    const exists = await stat(path.join(this.localPath, ".git")).catch(
      () => null
    );

    if (exists) {
      const git = simpleGit(this.localPath);
      try {
        await git.pull("origin", "main");
      } catch {
        // Pull failed (e.g. offline), continue with local state
      }
    } else {
      await mkdir(path.dirname(this.localPath), { recursive: true });
      const git = simpleGit();
      await git.clone(this.getAuthenticatedUrl(), this.localPath);
    }

    this.initialized = true;
  }

  async getFileManifest(owner: string, repo: string): Promise<FileManifest> {
    const dir = this.getResultDir(owner, repo);
    const manifest: FileManifest = {};

    try {
      await this.walkDir(dir, dir, manifest);
    } catch {
      // Directory doesn't exist yet, return empty manifest
    }

    return manifest;
  }

  async getDirSha(
    owner: string,
    repo: string,
    dirPath: string
  ): Promise<string | null> {
    const filePath = path.join(
      this.getResultDir(owner, repo),
      dirPath,
      "dir.yml"
    );
    try {
      const content = await readFile(filePath, "utf-8");
      const parsed = parseYaml(content) as Record<string, unknown>;
      return typeof parsed.sha === "string" ? parsed.sha : null;
    } catch {
      return null;
    }
  }

  async writeFileResult(
    owner: string,
    repo: string,
    filePath: string,
    sha: string,
    result: unknown
  ): Promise<void> {
    const data = { ...(result as Record<string, unknown>), sha };
    const yamlContent = formatYaml(data);
    const fullPath = path.join(
      this.getResultDir(owner, repo),
      `${filePath}.yml`
    );
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, yamlContent, "utf-8");
  }

  async writeDirResult(
    owner: string,
    repo: string,
    dirPath: string,
    sha: string,
    result: unknown
  ): Promise<void> {
    const data = { ...(result as Record<string, unknown>), sha };
    const yamlContent = formatYaml(data);
    const fullPath = path.join(
      this.getResultDir(owner, repo),
      dirPath,
      "dir.yml"
    );
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, yamlContent, "utf-8");
  }

  async deleteFileResult(
    owner: string,
    repo: string,
    filePath: string
  ): Promise<void> {
    const fullPath = path.join(
      this.getResultDir(owner, repo),
      `${filePath}.yml`
    );
    await rm(fullPath, { force: true });
  }

  async commitBatch(
    owner: string,
    repo: string,
    filesChanged: number
  ): Promise<void> {
    const { simpleGit } = await import("simple-git");
    const git = simpleGit(this.localPath);

    await git.addConfig("user.email", "HardlyDifficult@users.noreply.github.com");
    await git.addConfig("user.name", "HardlyDifficult");

    const status = await git.status();
    if (status.files.length === 0) {
      return;
    }

    await git.add("-A");
    const message = `Update results for ${owner}/${repo} (${String(filesChanged)} files)`;
    await git.commit(message);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await git.push("origin", "main");
        return;
      } catch (pushError) {
        const errorMsg =
          pushError instanceof Error ? pushError.message : String(pushError);
        if (errorMsg.includes("rejected") || errorMsg.includes("conflict")) {
          try {
            await git.pull("origin", "main", { "--rebase": null });
          } catch {
            await git.rebase({ "--abort": null }).catch(() => undefined);
            await git.pull("origin", "main");
            await git.add("-A");
            await git.commit(message);
          }
        } else {
          throw pushError;
        }
      }
    }

    throw new Error("Failed to push after 3 attempts");
  }

  // ---------------------------------------------------------------------------
  // Generic typed readers (for callers that need to load results back)
  // ---------------------------------------------------------------------------

  /**
   * Load a file result, parsed and validated with the given Zod schema.
   * Returns null if the file doesn't exist or fails validation.
   */
  async loadFileResult<T>(
    owner: string,
    repo: string,
    filePath: string,
    schema: z.ZodType<T>
  ): Promise<T | null> {
    const fullPath = path.join(
      this.getResultDir(owner, repo),
      `${filePath}.yml`
    );
    try {
      const content = await readFile(fullPath, "utf-8");
      return schema.parse(parseYaml(content));
    } catch {
      return null;
    }
  }

  /**
   * Load a directory result, parsed and validated with the given Zod schema.
   * Returns null if the file doesn't exist or fails validation.
   */
  async loadDirResult<T>(
    owner: string,
    repo: string,
    dirPath: string,
    schema: z.ZodType<T>
  ): Promise<T | null> {
    const fullPath = path.join(
      this.getResultDir(owner, repo),
      dirPath,
      "dir.yml"
    );
    try {
      const content = await readFile(fullPath, "utf-8");
      return schema.parse(parseYaml(content));
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private getResultDir(owner: string, repo: string): string {
    return path.join(this.localPath, this.resultDir(owner, repo));
  }

  private getAuthenticatedUrl(): string {
    if (this.authToken !== undefined && this.authToken !== "") {
      return this.cloneUrl.replace(
        "https://github.com/",
        `https://${this.authToken}@github.com/`
      );
    }
    return this.cloneUrl;
  }

  private async walkDir(
    baseDir: string,
    currentDir: string,
    manifest: FileManifest
  ): Promise<void> {
    let entries;
    try {
      entries = await readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await this.walkDir(baseDir, fullPath, manifest);
      } else if (
        entry.isFile() &&
        entry.name.endsWith(".yml") &&
        entry.name !== "dir.yml"
      ) {
        try {
          const yamlContent = await readFile(fullPath, "utf-8");
          const parsed = parseYaml(yamlContent) as Record<string, unknown>;
          if (typeof parsed.sha === "string") {
            const relativePath = path.relative(baseDir, fullPath);
            const repoPath = relativePath.slice(0, -4); // Remove .yml
            manifest[repoPath] = parsed.sha;
          }
        } catch {
          // Invalid file, skip
        }
      }
    }
  }
}
