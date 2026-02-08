#!/usr/bin/env node

import { cpSync, existsSync, rmSync, mkdirSync } from "fs";
import { join } from "path";

function main(): void {
  console.log("📋 Copying skills from monorepo root...\n");

  const packageRoot = join(__dirname, "..");
  const monorepoRoot = join(packageRoot, "../..");
  const sourceDir = join(monorepoRoot, ".claude");
  const destDir = join(packageRoot, "files", ".claude");

  // Verify source exists
  if (!existsSync(sourceDir)) {
    console.error(`❌ Source directory not found: ${sourceDir}`);
    process.exit(1);
  }

  // Clean destination
  if (existsSync(destDir)) {
    console.log("🧹 Cleaning existing files/.claude/");
    rmSync(destDir, { recursive: true, force: true });
  }

  // Ensure parent directory exists
  const filesDir = join(packageRoot, "files");
  if (!existsSync(filesDir)) {
    mkdirSync(filesDir, { recursive: true });
  }

  // Copy .claude directory
  console.log(`📂 Copying ${sourceDir} → ${destDir}`);
  cpSync(sourceDir, destDir, { recursive: true });

  console.log("✅ Skills copied successfully!\n");
}

main();
