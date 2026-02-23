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

import { readdirSync, readFileSync } from "fs";
import { join } from "path";

const PACKAGES_DIR = "packages";
const NODE_ENGINE_BASELINE = ">=20.19.0";
const REQUIRED_FIELDS = ["name", "version", "files", "scripts", "engines"] as const;
const REQUIRED_SCRIPTS = ["build", "clean"] as const;

interface PackageJson {
  name?: string;
  version?: string;
  files?: string[];
  scripts?: Record<string, string>;
  engines?: {
    node?: string;
  };
}

interface ValidationError {
  file: string;
  message: string;
}

function getPackageJsonFiles(): string[] {
  const packageDirs = readdirSync(PACKAGES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(PACKAGES_DIR, entry.name, "package.json"));

  return packageDirs;
}

function validatePackage(filePath: string): ValidationError[] {
  const pkg = JSON.parse(readFileSync(filePath, "utf-8")) as PackageJson;
  const errors: ValidationError[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (pkg[field] === undefined) {
      errors.push({ file: filePath, message: `missing required field: ${field}` });
    }
  }

  if (pkg.files && pkg.files.length === 0) {
    errors.push({ file: filePath, message: "files must include at least one entry" });
  }

  for (const scriptName of REQUIRED_SCRIPTS) {
    if (pkg.scripts?.[scriptName] === undefined) {
      errors.push({ file: filePath, message: `missing required script: scripts.${scriptName}` });
    }
  }

  if (pkg.engines?.node !== NODE_ENGINE_BASELINE) {
    errors.push({
      file: filePath,
      message: `engines.node must be "${NODE_ENGINE_BASELINE}" (found ${JSON.stringify(pkg.engines?.node ?? null)})`,
    });
  }

  return errors;
}

function main(): void {
  const packageFiles = getPackageJsonFiles();
  const allErrors = packageFiles.flatMap((filePath) => validatePackage(filePath));

  if (allErrors.length > 0) {
    console.error("Package metadata validation failed:\n");

    for (const error of allErrors) {
      console.error(`  ${error.file}`);
      console.error(`    - ${error.message}\n`);
    }

    process.exit(1);
  }

  console.warn(
    `Validated ${String(packageFiles.length)} package.json file(s): metadata and Node baseline are consistent.`
  );
}

main();
