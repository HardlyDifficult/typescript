#!/usr/bin/env node

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { dirname, join } from "path";

function findRepoRoot(): string | null {
  // INIT_CWD is set by npm to the directory where npm install was run
  if (process.env.INIT_CWD !== undefined && process.env.INIT_CWD !== "") {
    return process.env.INIT_CWD;
  }

  // Fallback: walk up from our location past node_modules
  let dir = __dirname;
  while (dir !== dirname(dir)) {
    if (dir.endsWith("node_modules")) {
      return dirname(dir);
    }
    dir = dirname(dir);
  }

  return null;
}

function findFilesDir(): string | null {
  // When installed from npm: files/ is a sibling of dist/
  const fromDist = join(__dirname, "..", "files");
  if (existsSync(fromDist)) {
    return fromDist;
  }

  return null;
}

function copyDirMerge(src: string, dest: string): void {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDirMerge(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function copyFileWithDir(src: string, dest: string): void {
  const destDir = dirname(dest);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }
  copyFileSync(src, dest);
}

function main(): void {
  const repoRoot = findRepoRoot();
  if (repoRoot === null) {
    // Can't determine repo root, skip silently
    return;
  }

  const filesDir = findFilesDir();
  if (filesDir === null) {
    // No files directory found (probably in development), skip silently
    return;
  }

  // Copy .gitignore (overwrite - shared config is authoritative)
  const gitignoreSrc = join(filesDir, ".gitignore");
  if (existsSync(gitignoreSrc)) {
    copyFileWithDir(gitignoreSrc, join(repoRoot, ".gitignore"));
  }

  // Copy .github/dependabot.yml (overwrite - shared config is authoritative)
  const dependabotSrc = join(filesDir, ".github", "dependabot.yml");
  if (existsSync(dependabotSrc)) {
    copyFileWithDir(dependabotSrc, join(repoRoot, ".github", "dependabot.yml"));
  }

  // Merge .claude/ (additive only - never delete local files)
  const claudeSrc = join(filesDir, ".claude");
  if (existsSync(claudeSrc)) {
    copyDirMerge(claudeSrc, join(repoRoot, ".claude"));
  }
}

main();
