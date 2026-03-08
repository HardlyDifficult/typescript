#!/usr/bin/env node

/**
 * Checks that all dependencies in package.json files use pinned versions.
 * Fails if any dependency uses ^ or ~ prefixes.
 *
 * Usage:
 *   npx check-pinned-deps
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

import { findWorkspaceRoot } from "./workspace.js";

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

const UNPINNED_PATTERN = /^[\^~]/;

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export interface CheckPinnedDependenciesOptions {
  rootDir?: string;
}

export interface UnpinnedDependency {
  file: string;
  field: string;
  packageName: string;
  version: string;
}

export interface PinnedDependenciesResult {
  rootDir: string;
  packageFiles: string[];
  issues: UnpinnedDependency[];
}

export class PinnedDependenciesError extends Error {
  readonly issues: UnpinnedDependency[];

  constructor(result: PinnedDependenciesResult) {
    super(formatPinnedDependenciesFailure(result.issues));
    this.name = "PinnedDependenciesError";
    this.issues = result.issues;
  }
}

function findPackageJsonFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    if (entry === "node_modules" || entry === "dist" || entry === ".tmp") {
      continue;
    }

    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findPackageJsonFiles(fullPath, files);
    } else if (entry === "package.json") {
      files.push(fullPath);
    }
  }

  return files;
}

function checkPackageJson(filePath: string): UnpinnedDependency[] {
  const content = readFileSync(filePath, "utf-8");
  const pkg = JSON.parse(content) as PackageJson;
  const issues: UnpinnedDependency[] = [];

  for (const field of DEPENDENCY_FIELDS) {
    const deps = pkg[field];
    if (!deps) {
      continue;
    }

    for (const [name, version] of Object.entries(deps)) {
      if (UNPINNED_PATTERN.test(version)) {
        issues.push({
          file: filePath,
          field,
          packageName: name,
          version,
        });
      }
    }
  }

  return issues;
}

function formatPinnedDependenciesFailure(issues: UnpinnedDependency[]): string {
  const lines = ["Found unpinned dependencies:", ""];

  for (const issue of issues) {
    lines.push(`  ${issue.file}`);
    lines.push(
      `    ${issue.field}.${issue.packageName}: "${issue.version}"`,
      ""
    );
  }

  lines.push("All dependencies must use exact versions (no ^ or ~ prefixes).");
  lines.push("Fix by removing the ^ or ~ prefix from each version.");

  return lines.join("\n");
}

export function checkPinnedDependencies(
  options: CheckPinnedDependenciesOptions = {}
): PinnedDependenciesResult {
  const rootDir = findWorkspaceRoot(options.rootDir);
  const packageFiles = findPackageJsonFiles(rootDir);
  const issues = packageFiles.flatMap((filePath) => checkPackageJson(filePath));

  return {
    rootDir,
    packageFiles,
    issues,
  };
}

export function assertPinnedDependencies(
  options: CheckPinnedDependenciesOptions = {}
): PinnedDependenciesResult {
  const result = checkPinnedDependencies(options);

  if (result.issues.length > 0) {
    throw new PinnedDependenciesError(result);
  }

  return result;
}

export function formatPinnedDependenciesSuccess(
  result: PinnedDependenciesResult
): string {
  return `Checked ${String(result.packageFiles.length)} package.json file(s) under ${result.rootDir} - all dependencies are pinned.`;
}

export function runCheckPinnedDependenciesCli(): number {
  try {
    const result = assertPinnedDependencies();
    // eslint-disable-next-line no-console
    console.log(formatPinnedDependenciesSuccess(result));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runCheckPinnedDependenciesCli();
}
