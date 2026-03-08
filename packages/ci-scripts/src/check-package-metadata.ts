#!/usr/bin/env node

/**
 * Validates package metadata consistency for the monorepo.
 *
 * Checks:
 * - `engines.node` exactly matches the monorepo support baseline.
 * - Required metadata fields are present.
 * - Required lifecycle scripts exist.
 *
 * Usage:
 *   npx check-package-metadata
 */

import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

import { findWorkspaceRoot } from "./workspace.js";

const DEFAULT_PACKAGES_DIR = "packages";
const DEFAULT_NODE_ENGINE_BASELINE = ">=20.19.0";
const REQUIRED_FIELDS = [
  "name",
  "version",
  "files",
  "scripts",
  "engines",
] as const;
const REQUIRED_SCRIPTS = ["build", "clean"] as const;

interface RootPackageJson {
  engines?: {
    node?: string;
  };
}

interface PackageJson {
  name?: string;
  version?: string;
  files?: string[];
  scripts?: Record<string, string>;
  engines?: {
    node?: string;
  };
}

export interface CheckPackageMetadataOptions {
  rootDir?: string;
}

export interface PackageMetadataIssue {
  file: string;
  message: string;
}

export interface PackageMetadataResult {
  packageFiles: string[];
  rootDir: string;
  nodeEngineBaseline: string;
  issues: PackageMetadataIssue[];
}

export class PackageMetadataError extends Error {
  readonly issues: PackageMetadataIssue[];

  constructor(result: PackageMetadataResult) {
    super(formatPackageMetadataFailure(result.issues));
    this.name = "PackageMetadataError";
    this.issues = result.issues;
  }
}

function getPackageJsonFiles(rootDir: string): string[] {
  const packagesDir = join(rootDir, DEFAULT_PACKAGES_DIR);
  if (!existsSync(packagesDir)) {
    return [];
  }

  return readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(packagesDir, entry.name, "package.json"))
    .filter((packageJsonPath) => existsSync(packageJsonPath));
}

function getNodeEngineBaseline(rootDir: string): string {
  const rootPackageJsonPath = join(rootDir, "package.json");
  if (!existsSync(rootPackageJsonPath)) {
    return DEFAULT_NODE_ENGINE_BASELINE;
  }

  const rootPackageJson = JSON.parse(
    readFileSync(rootPackageJsonPath, "utf-8")
  ) as RootPackageJson;

  return rootPackageJson.engines?.node ?? DEFAULT_NODE_ENGINE_BASELINE;
}

function validatePackage(
  filePath: string,
  nodeEngineBaseline: string
): PackageMetadataIssue[] {
  const pkg = JSON.parse(readFileSync(filePath, "utf-8")) as PackageJson;
  const issues: PackageMetadataIssue[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (pkg[field] === undefined) {
      issues.push({
        file: filePath,
        message: `missing required field: ${field}`,
      });
    }
  }

  if (pkg.files?.length === 0) {
    issues.push({
      file: filePath,
      message: "files must include at least one entry",
    });
  }

  for (const scriptName of REQUIRED_SCRIPTS) {
    if (pkg.scripts?.[scriptName] === undefined) {
      issues.push({
        file: filePath,
        message: `missing required script: scripts.${scriptName}`,
      });
    }
  }

  if (pkg.engines?.node !== nodeEngineBaseline) {
    issues.push({
      file: filePath,
      message: `engines.node must be "${nodeEngineBaseline}" (found ${JSON.stringify(pkg.engines?.node ?? null)})`,
    });
  }

  return issues;
}

function formatPackageMetadataFailure(issues: PackageMetadataIssue[]): string {
  const lines = ["Package metadata validation failed:", ""];

  for (const issue of issues) {
    lines.push(`  ${issue.file}`);
    lines.push(`    - ${issue.message}`, "");
  }

  return lines.join("\n");
}

export function checkPackageMetadata(
  options: CheckPackageMetadataOptions = {}
): PackageMetadataResult {
  const rootDir = findWorkspaceRoot(options.rootDir);
  const packageFiles = getPackageJsonFiles(rootDir);
  const nodeEngineBaseline = getNodeEngineBaseline(rootDir);
  const issues = packageFiles.flatMap((filePath) =>
    validatePackage(filePath, nodeEngineBaseline)
  );

  return {
    packageFiles,
    rootDir,
    nodeEngineBaseline,
    issues,
  };
}

export function assertPackageMetadata(
  options: CheckPackageMetadataOptions = {}
): PackageMetadataResult {
  const result = checkPackageMetadata(options);

  if (result.issues.length > 0) {
    throw new PackageMetadataError(result);
  }

  return result;
}

export function formatPackageMetadataSuccess(
  result: PackageMetadataResult
): string {
  return `Validated ${String(result.packageFiles.length)} package.json file(s) under ${result.rootDir}: metadata and Node baseline (${result.nodeEngineBaseline}) are consistent.`;
}

export function runCheckPackageMetadataCli(): number {
  try {
    const result = assertPackageMetadata();
    // eslint-disable-next-line no-console
    console.log(formatPackageMetadataSuccess(result));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

if (require.main === module) {
  process.exitCode = runCheckPackageMetadataCli();
}
