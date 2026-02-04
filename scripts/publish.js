#!/usr/bin/env node

/**
 * Publishes packages that have changed since the last publish.
 * Auto-increments the patch version for each changed package.
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const PACKAGES_DIR = 'packages';

function exec(command, options = {}) {
  console.log(`$ ${command}`);
  try {
    return execSync(command, { encoding: 'utf-8', stdio: 'pipe', ...options }).trim();
  } catch (error) {
    if (options.ignoreError) {
      return '';
    }
    throw error;
  }
}

function getPackages() {
  const packagesPath = join(process.cwd(), PACKAGES_DIR);
  const entries = readdirSync(packagesPath);
  const packages = [];

  for (const entry of entries) {
    const packagePath = join(packagesPath, entry);
    const stat = statSync(packagePath);

    if (!stat.isDirectory()) {
      continue;
    }

    const packageJsonPath = join(packagePath, 'package.json');
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      if (packageJson.private) {
        continue;
      }
      packages.push({
        name: packageJson.name,
        path: packagePath,
        relativePath: `${PACKAGES_DIR}/${entry}`,
        version: packageJson.version,
      });
    } catch {
      // Skip if no package.json
    }
  }

  return packages;
}

function getLastPublishedVersion(packageName) {
  try {
    return exec(`npm view ${packageName} version`, { ignoreError: true });
  } catch {
    return null;
  }
}

function hasChanges(packagePath, lastTag) {
  if (!lastTag) {
    return true;
  }

  try {
    const diff = exec(`git diff --name-only ${lastTag} HEAD -- ${packagePath}`, { ignoreError: true });
    return diff.length > 0;
  } catch {
    return true;
  }
}

function getLastTag(packageName) {
  try {
    const safeName = packageName.replace('@', '').replace('/', '-');
    const tags = exec(`git tag -l "${safeName}-v*" --sort=-v:refname`, { ignoreError: true });
    const tagList = tags.split('\n').filter(Boolean);
    return tagList[0] || null;
  } catch {
    return null;
  }
}

async function main() {
  const packages = getPackages();

  if (packages.length === 0) {
    console.log('No publishable packages found.');
    return;
  }

  console.log(`Found ${packages.length} package(s): ${packages.map((p) => p.name).join(', ')}`);

  for (const pkg of packages) {
    console.log(`\n--- Processing ${pkg.name} ---`);

    const lastTag = getLastTag(pkg.name);
    const changed = hasChanges(pkg.relativePath, lastTag);

    if (!changed) {
      console.log(`No changes since last publish (${lastTag}). Skipping.`);
      continue;
    }

    console.log(lastTag ? `Changes detected since ${lastTag}.` : 'No previous tag found. Publishing initial version.');

    // Increment version
    console.log('Incrementing patch version...');
    exec(`npm version patch --no-git-tag-version`, { cwd: pkg.path });

    // Read new version
    const updatedPackageJson = JSON.parse(readFileSync(join(pkg.path, 'package.json'), 'utf-8'));
    const newVersion = updatedPackageJson.version;
    console.log(`New version: ${newVersion}`);

    // Publish
    console.log('Publishing to npm...');
    try {
      exec(`npm publish --access public`, { cwd: pkg.path });
      console.log(`Successfully published ${pkg.name}@${newVersion}`);

      // Create and push git tag
      const safeName = pkg.name.replace('@', '').replace('/', '-');
      const tagName = `${safeName}-v${newVersion}`;
      exec(`git add ${pkg.relativePath}/package.json`);
      exec(`git commit -m "chore: release ${pkg.name}@${newVersion}"`);
      exec(`git tag ${tagName}`);
      exec(`git push origin HEAD --tags`);
      console.log(`Created tag: ${tagName}`);
    } catch (error) {
      console.error(`Failed to publish ${pkg.name}:`, error.message);
      process.exit(1);
    }
  }

  console.log('\nDone!');
}

main().catch((error) => {
  console.error('Publish failed:', error);
  process.exit(1);
});
