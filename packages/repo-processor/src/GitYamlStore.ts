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
import { simpleGit, type SimpleGit } from "simple-git";
import { parse as parseYaml } from "yaml";
import type { z } from "zod";

import type {
  BoundRepoRef,
  FileManifest,
  ResultsStore,
} from "./internalTypes.js";
import type { GitIdentity } from "./types.js";

export interface GitYamlStoreConfig {
  sourceRepo: BoundRepoRef;
  resultsRepo: BoundRepoRef;
  localPath: string;
  root: string;
  branch?: string;
  authToken?: string;
  gitUser?: GitIdentity;
}

function normalizeResult(
  result: unknown,
  sha: string
): Record<string, unknown> {
  if (result !== null && typeof result === "object" && !Array.isArray(result)) {
    return { ...(result as Record<string, unknown>), sha };
  }

  return { value: result, sha };
}

/** Persists file and directory processing results as YAML in a Git repo. */
export class GitYamlStore implements ResultsStore {
  private readonly sourceRepo: BoundRepoRef;
  private readonly cloneUrl: string;
  private readonly localPath: string;
  private readonly root: string;
  private readonly authToken: string | undefined;
  private readonly requestedBranch: string | undefined;
  private readonly configuredGitUser: GitIdentity | undefined;
  private initialized = false;
  private activeBranch: string | undefined;
  private gitUser: GitIdentity | undefined;

  constructor(config: GitYamlStoreConfig) {
    this.sourceRepo = config.sourceRepo;
    this.cloneUrl = `https://github.com/${config.resultsRepo.fullName}.git`;
    this.localPath = config.localPath;
    this.root = config.root;
    this.authToken = config.authToken;
    this.requestedBranch = config.branch;
    this.configuredGitUser = config.gitUser;
  }

  async ensureReady(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const gitDir = path.join(this.localPath, ".git");
    const hasClone = await stat(gitDir)
      .then(() => true)
      .catch(() => false);

    if (!hasClone) {
      await mkdir(path.dirname(this.localPath), { recursive: true });
      await simpleGit().clone(this.getAuthenticatedUrl(), this.localPath);
    }

    const git = simpleGit(this.localPath);
    this.activeBranch = await this.resolveBranch(git);
    await this.checkoutBranch(git, this.activeBranch);

    try {
      await git.pull("origin", this.activeBranch);
    } catch {
      // Pull can fail offline or when the branch has no remote tracking yet.
    }

    this.gitUser = await this.resolveGitUser(git);
    this.initialized = true;
  }

  async getFileManifest(): Promise<FileManifest> {
    const dir = this.getResultDir();
    const manifest: FileManifest = {};

    try {
      await this.walkDir(dir, dir, manifest);
    } catch {
      // First run: no results yet.
    }

    return manifest;
  }

  async getDirSha(dirPath: string): Promise<string | null> {
    const filePath = path.join(this.getResultDir(), dirPath, "dir.yml");
    try {
      const content = await readFile(filePath, "utf-8");
      const parsed = parseYaml(content) as Record<string, unknown>;
      return typeof parsed.sha === "string" ? parsed.sha : null;
    } catch {
      return null;
    }
  }

  async writeFileResult(
    filePath: string,
    sha: string,
    result: unknown
  ): Promise<void> {
    const fullPath = path.join(this.getResultDir(), `${filePath}.yml`);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(
      fullPath,
      formatYaml(normalizeResult(result, sha)),
      "utf-8"
    );
  }

  async writeDirResult(
    dirPath: string,
    sha: string,
    result: unknown
  ): Promise<void> {
    const fullPath = path.join(this.getResultDir(), dirPath, "dir.yml");
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(
      fullPath,
      formatYaml(normalizeResult(result, sha)),
      "utf-8"
    );
  }

  async deleteFileResult(filePath: string): Promise<void> {
    const fullPath = path.join(this.getResultDir(), `${filePath}.yml`);
    await rm(fullPath, { force: true });
  }

  async commitBatch(sourceRepo: string, count: number): Promise<void> {
    await this.ensureReady();

    const git = simpleGit(this.localPath);
    const status = await git.status();
    if (status.files.length === 0) {
      return;
    }

    const { gitUser } = this;
    const branch = this.activeBranch;
    if (gitUser === undefined || branch === undefined) {
      throw new Error("Git results store was not initialized correctly");
    }

    await git.addConfig("user.email", gitUser.email);
    await git.addConfig("user.name", gitUser.name);
    await git.add("-A");

    const message = `Update results for ${sourceRepo} (${String(count)} files)`;
    await git.commit(message);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await git.push("origin", branch);
        return;
      } catch (pushError) {
        const errorMessage =
          pushError instanceof Error ? pushError.message : String(pushError);
        if (
          !errorMessage.includes("rejected") &&
          !errorMessage.includes("conflict")
        ) {
          throw pushError;
        }

        try {
          await git.pull("origin", branch, { "--rebase": null });
        } catch {
          await git.rebase({ "--abort": null }).catch(() => undefined);
          await git.pull("origin", branch);
          await git.add("-A");
          await git.commit(message);
        }
      }
    }

    throw new Error("Failed to push after 3 attempts");
  }

  async readFileResult<T>(
    filePath: string,
    schema: z.ZodType<T>
  ): Promise<T | null> {
    await this.ensureReady();
    const fullPath = path.join(this.getResultDir(), `${filePath}.yml`);

    try {
      const content = await readFile(fullPath, "utf-8");
      return schema.parse(parseYaml(content));
    } catch {
      return null;
    }
  }

  async readDirectoryResult<T>(
    dirPath: string,
    schema: z.ZodType<T>
  ): Promise<T | null> {
    await this.ensureReady();
    const fullPath = path.join(this.getResultDir(), dirPath, "dir.yml");

    try {
      const content = await readFile(fullPath, "utf-8");
      return schema.parse(parseYaml(content));
    } catch {
      return null;
    }
  }

  private getResultDir(): string {
    return path.join(
      this.localPath,
      this.root,
      this.sourceRepo.owner,
      this.sourceRepo.name
    );
  }

  private getAuthenticatedUrl(): string {
    if (this.authToken === undefined || this.authToken === "") {
      return this.cloneUrl;
    }

    return this.cloneUrl.replace(
      "https://github.com/",
      `https://${this.authToken}@github.com/`
    );
  }

  private async resolveBranch(git: SimpleGit): Promise<string> {
    if (this.requestedBranch !== undefined && this.requestedBranch !== "") {
      return this.requestedBranch;
    }

    const localBranches = await git.branchLocal();
    if (localBranches.current !== "") {
      return localBranches.current;
    }

    try {
      const remoteHead = await git.raw([
        "symbolic-ref",
        "--quiet",
        "refs/remotes/origin/HEAD",
      ]);
      const branch = remoteHead.trim().replace(/^refs\/remotes\/origin\//u, "");
      if (branch !== "") {
        return branch;
      }
    } catch {
      // Fall back to any available branch.
    }

    if (localBranches.all.length > 0) {
      return localBranches.all[0];
    }

    throw new Error("Unable to determine which branch to use for results");
  }

  private async checkoutBranch(git: SimpleGit, branch: string): Promise<void> {
    const localBranches = await git.branchLocal();
    if (localBranches.current === branch) {
      return;
    }

    if (localBranches.all.includes(branch)) {
      await git.checkout(branch);
      return;
    }

    try {
      await git.checkoutBranch(branch, `origin/${branch}`);
    } catch {
      await git.checkoutLocalBranch(branch);
    }
  }

  private async resolveGitUser(git: SimpleGit): Promise<GitIdentity> {
    if (this.configuredGitUser !== undefined) {
      return this.configuredGitUser;
    }

    const [nameResult, emailResult] = await Promise.all([
      git.getConfig("user.name"),
      git.getConfig("user.email"),
    ]);

    const name = nameResult.value?.trim() ?? "";
    const email = emailResult.value?.trim() ?? "";
    if (name !== "" && email !== "") {
      return { name, email };
    }

    throw new Error(
      "Git user is required. Set results.gitUser or configure git user.name and user.email."
    );
  }

  private async walkDir(
    baseDir: string,
    currentDir: string,
    manifest: FileManifest
  ): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await this.walkDir(baseDir, fullPath, manifest);
        continue;
      }

      if (
        !entry.isFile() ||
        !entry.name.endsWith(".yml") ||
        entry.name === "dir.yml"
      ) {
        continue;
      }

      try {
        const yamlContent = await readFile(fullPath, "utf-8");
        const parsed = parseYaml(yamlContent) as Record<string, unknown>;
        if (typeof parsed.sha === "string") {
          const relativePath = path.relative(baseDir, fullPath);
          manifest[relativePath.slice(0, -4)] = parsed.sha;
        }
      } catch {
        // Skip invalid YAML files while building the manifest.
      }
    }
  }
}
