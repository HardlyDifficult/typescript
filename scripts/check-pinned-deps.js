#!/usr/bin/env node

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
];

const UNPINNED_PATTERN = /^[\^~]/;

function findPackageJsonFiles(dir, files = []) {
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

function checkPackageJson(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const pkg = JSON.parse(content);
  const errors = [];

  for (const field of DEPENDENCY_FIELDS) {
    const deps = pkg[field];
    if (!deps) continue;

    for (const [name, version] of Object.entries(deps)) {
      if (typeof version === 'string' && UNPINNED_PATTERN.test(version)) {
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

function main() {
  const rootDir = process.cwd();
  const packageFiles = findPackageJsonFiles(rootDir);
  const allErrors = [];

  for (const file of packageFiles) {
    const errors = checkPackageJson(file);
    allErrors.push(...errors);
  }

  if (allErrors.length > 0) {
    console.error('Found unpinned dependencies:\n');

    for (const error of allErrors) {
      console.error(
        `  ${error.file}\n    ${error.field}.${error.package}: "${error.version}"\n`
      );
    }

    console.error(
      '\nAll dependencies must use exact versions (no ^ or ~ prefixes).'
    );
    console.error('Fix by removing the ^ or ~ prefix from each version.\n');
    process.exit(1);
  }

  console.log(`Checked ${packageFiles.length} package.json file(s) - all dependencies are pinned.`);
}

main();
