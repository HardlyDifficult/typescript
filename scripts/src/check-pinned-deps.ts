#!/usr/bin/env npx tsx

/**
 * Checks that all dependencies in package.json files use pinned versions.
 * Fails if any dependency uses ^ or ~ prefixes.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

const UNPINNED_PATTERN = /^[\^~]/;

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface DependencyError {
  file: string;
  field: string;
  package: string;
  version: string;
}

function findPackageJsonFiles(dir: string, files: string[] = []): string[] {
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    if (entry === 'node_modules' || entry === 'dist') {
      continue;
    }

    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      findPackageJsonFiles(fullPath, files);
    } else if (entry === 'package.json') {
      files.push(fullPath);
    }
  }

  return files;
}

function checkPackageJson(filePath: string): DependencyError[] {
  const content = readFileSync(filePath, 'utf-8');
  const pkg = JSON.parse(content) as PackageJson;
  const errors: DependencyError[] = [];

  for (const field of DEPENDENCY_FIELDS) {
    const deps = pkg[field];
    if (!deps) {
      continue;
    }

    for (const [name, version] of Object.entries(deps)) {
      if (UNPINNED_PATTERN.test(version)) {
        errors.push({
          file: filePath,
          field,
          package: name,
          version,
        });
      }
    }
  }

  return errors;
}

function main(): void {
  const rootDir = process.cwd();
  const packageFiles = findPackageJsonFiles(rootDir);
  const allErrors: DependencyError[] = [];

  for (const file of packageFiles) {
    const errors = checkPackageJson(file);
    allErrors.push(...errors);
  }

  if (allErrors.length > 0) {
    console.error('Found unpinned dependencies:\n');

    for (const error of allErrors) {
      console.error(`  ${error.file}\n    ${error.field}.${error.package}: "${error.version}"\n`);
    }

    console.error('\nAll dependencies must use exact versions (no ^ or ~ prefixes).');
    console.error('Fix by removing the ^ or ~ prefix from each version.\n');
    process.exit(1);
  }

  console.log(
    `Checked ${String(packageFiles.length)} package.json file(s) - all dependencies are pinned.`,
  );
}

main();
