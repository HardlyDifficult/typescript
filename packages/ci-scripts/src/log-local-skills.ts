#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Logs .claude/ files that exist locally but not in the shared-config package.
 * Informational only - never fails. Helps identify skills that could be promoted to shared.
 *
 * Usage:
 *   npx log-local-skills
 */

import { existsSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

function listFilesRecursive(dir: string): string[] {
  const results: string[] = [];

  if (!existsSync(dir)) {
    return results;
  }

  for (const entry of readdirSync(dir)) {
    if (entry === ".gitkeep") {
      continue;
    }
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      results.push(...listFilesRecursive(fullPath));
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

function findSharedConfigFiles(): string | null {
  // Try to find shared-config package in node_modules
  try {
    const sharedConfigBase = join(
      process.cwd(),
      "node_modules",
      "@hardlydifficult",
      "shared-config",
      "files",
      ".claude"
    );
    if (existsSync(sharedConfigBase)) {
      return sharedConfigBase;
    }
  } catch {
    // Ignore
  }

  // Try monorepo path
  const monoRepoPath = join(
    process.cwd(),
    "packages",
    "shared-config",
    "files",
    ".claude"
  );
  if (existsSync(monoRepoPath)) {
    return monoRepoPath;
  }

  return null;
}

function main(): void {
  const localClaudeDir = join(process.cwd(), ".claude");

  if (!existsSync(localClaudeDir)) {
    console.log("No .claude/ directory found in repo root.");
    return;
  }

  const sharedClaudeDir = findSharedConfigFiles();
  if (sharedClaudeDir === null) {
    console.log(
      "Could not find shared-config package. Listing all .claude/ files as local:"
    );
    const allFiles = listFilesRecursive(localClaudeDir);
    for (const file of allFiles) {
      console.log(`  LOCAL: ${relative(process.cwd(), file)}`);
    }
    return;
  }

  const localFiles = listFilesRecursive(localClaudeDir);
  const sharedFiles = new Set(
    listFilesRecursive(sharedClaudeDir).map((f) => relative(sharedClaudeDir, f))
  );

  const localOnly: string[] = [];
  const externalSkills: string[] = [];

  for (const file of localFiles) {
    const relPath = relative(localClaudeDir, file);

    // External skills are synced dynamically, not local-only
    if (relPath.startsWith("skills/external/")) {
      externalSkills.push(relPath);
      continue;
    }

    if (!sharedFiles.has(relPath)) {
      localOnly.push(relPath);
    }
  }

  // Report external skills
  if (externalSkills.length > 0) {
    const skillCount = externalSkills.filter(f => f.endsWith("/SKILL.md")).length;
    console.log(
      `📦 External skills: ${String(skillCount)} skill(s) synced from external repositories`
    );
  }

  // Report local-only files
  if (localOnly.length === 0) {
    console.log(
      "✅ All .claude/ files are from shared-config. No local-only files."
    );
  } else {
    console.log(
      `Found ${String(localOnly.length)} local-only .claude/ file(s):`
    );
    for (const file of localOnly) {
      console.log(`  LOCAL: .claude/${file}`);
    }
    console.log(
      "\n💡 Consider promoting these to shared-config if they should be shared across repos."
    );
  }
}

main();
