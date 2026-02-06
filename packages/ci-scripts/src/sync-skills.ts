#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Syncs .claude/ skills from external GitHub repositories into the shared-config package.
 * Reads skill-repos.json for the list of repos (owner/repo format).
 * Uses the GitHub REST API with native fetch().
 *
 * Usage:
 *   npx sync-skills
 *
 * Environment:
 *   GITHUB_TOKEN - Optional. Required for private repos. Auto-available in GitHub Actions.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";

interface GitHubContent {
  name: string;
  path: string;
  type: "file" | "dir";
  download_url: string | null;
}

const GITHUB_API = "https://api.github.com";

function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "hardlydifficult-sync-skills",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token !== undefined && token !== "") {
    headers.Authorization = `token ${token}`;
  }
  return headers;
}

async function fetchContents(
  repo: string,
  path: string
): Promise<GitHubContent[]> {
  const url = `${GITHUB_API}/repos/${repo}/contents/${path}`;
  const response = await fetch(url, { headers: getHeaders() });

  if (response.status === 404) {
    console.log(`  No ${path} directory found in ${repo}, skipping`);
    return [];
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API error ${String(response.status)}: ${await response.text()}`
    );
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    // Single file, not a directory
    return [data as GitHubContent];
  }
  return data as GitHubContent[];
}

async function downloadFile(downloadUrl: string): Promise<string> {
  const response = await fetch(downloadUrl, { headers: getHeaders() });
  if (!response.ok) {
    throw new Error(
      `Failed to download ${downloadUrl}: ${String(response.status)}`
    );
  }
  return response.text();
}

async function syncDirectory(
  repo: string,
  remotePath: string,
  localDir: string
): Promise<void> {
  const contents = await fetchContents(repo, remotePath);

  for (const item of contents) {
    const localPath = join(localDir, item.name);

    if (item.type === "dir") {
      mkdirSync(localPath, { recursive: true });
      await syncDirectory(repo, item.path, localPath);
    } else if (item.download_url !== null) {
      const content = await downloadFile(item.download_url);
      const parentDir = dirname(localPath);
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true });
      }
      writeFileSync(localPath, content);
      console.log(`  Synced: ${item.path}`);
    }
  }
}

async function main(): Promise<void> {
  // Find skill-repos.json relative to this monorepo
  const sharedConfigDir = join(process.cwd(), "packages", "shared-config");
  const skillReposPath = join(sharedConfigDir, "skill-repos.json");

  if (!existsSync(skillReposPath)) {
    console.error("Error: packages/shared-config/skill-repos.json not found");
    console.error("Run this command from the monorepo root.");
    process.exit(1);
  }

  const skillRepos: string[] = JSON.parse(
    readFileSync(skillReposPath, "utf-8")
  ) as string[];

  if (skillRepos.length === 0) {
    console.log("No skill repos configured in skill-repos.json");
    return;
  }

  const targetDir = join(sharedConfigDir, "files", ".claude");

  // Clean and recreate the target .claude directory
  if (existsSync(targetDir)) {
    rmSync(targetDir, { recursive: true });
  }
  mkdirSync(targetDir, { recursive: true });

  for (const repo of skillRepos) {
    console.log(`Syncing skills from ${repo}...`);
    await syncDirectory(repo, ".claude", targetDir);
  }

  console.log("Skill sync complete.");
}

main().catch((err: unknown) => {
  console.error("Skill sync failed:", err);
  process.exit(1);
});
