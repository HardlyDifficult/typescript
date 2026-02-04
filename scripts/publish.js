#!/usr/bin/env node

/**
 * Publishes packages that have changed since the last publish.
 * Auto-increments the patch version for each changed package.
 *
 * Handles inter-package dependencies:
 * - Detects dependency order and publishes dependencies first
 * - Auto-updates dependency versions before publishing dependent packages
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
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
        packageJsonPath,
        relativePath: `${PACKAGES_DIR}/${entry}`,
        version: packageJson.version,
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        peerDependencies: packageJson.peerDependencies || {},
      });
    } catch {
      // Skip if no package.json
    }
  }

  return packages;
}

/**
 * Sort packages so dependencies are published first.
 * Uses topological sort based on inter-package dependencies.
 */
function sortByDependencyOrder(packages) {
  const packageNames = new Set(packages.map((p) => p.name));
  const graph = new Map();
  const inDegree = new Map();

  // Initialize
  for (const pkg of packages) {
    graph.set(pkg.name, []);
    inDegree.set(pkg.name, 0);
  }

  // Build dependency graph (only for packages in this monorepo)
  for (const pkg of packages) {
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    };

    for (const dep of Object.keys(allDeps)) {
      if (packageNames.has(dep)) {
        // dep must be published before pkg
        graph.get(dep).push(pkg.name);
        inDegree.set(pkg.name, inDegree.get(pkg.name) + 1);
      }
    }
  }

  // Kahn's algorithm for topological sort
  const queue = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) {
      queue.push(name);
    }
  }

  const sorted = [];
  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(current);

    for (const dependent of graph.get(current)) {
      inDegree.set(dependent, inDegree.get(dependent) - 1);
      if (inDegree.get(dependent) === 0) {
        queue.push(dependent);
      }
    }
  }

  if (sorted.length !== packages.length) {
    throw new Error('Circular dependency detected between packages');
  }

  // Return packages in sorted order
  const packageMap = new Map(packages.map((p) => [p.name, p]));
  return sorted.map((name) => packageMap.get(name));
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

/**
 * Update a package's dependencies to use newly published versions.
 * Handles both:
 * - file:../packageName references (transforms to real version)
 * - version numbers that need updating
 */
function updateInternalDependencies(pkg, publishedVersions) {
  const packageJson = JSON.parse(readFileSync(pkg.packageJsonPath, 'utf-8'));
  let updated = false;

  for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
    if (!packageJson[depType]) continue;

    for (const [depName, currentVersion] of Object.entries(packageJson[depType])) {
      // Check if this is a file: reference to a monorepo package
      if (typeof currentVersion === 'string' && currentVersion.startsWith('file:')) {
        if (publishedVersions.has(depName)) {
          const newVersion = publishedVersions.get(depName);
          console.log(`  Transforming ${depName}: ${currentVersion} → ${newVersion}`);
          packageJson[depType][depName] = newVersion;
          updated = true;
        }
      }
      // Check if this is a version that needs updating
      else if (publishedVersions.has(depName)) {
        const newVersion = publishedVersions.get(depName);
        if (currentVersion !== newVersion) {
          console.log(`  Updating ${depName}: ${currentVersion} → ${newVersion}`);
          packageJson[depType][depName] = newVersion;
          updated = true;
        }
      }
    }
  }

  if (updated) {
    writeFileSync(pkg.packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    // Also update the in-memory version
    pkg.version = packageJson.version;
  }

  return updated;
}

async function main() {
  const packages = getPackages();

  if (packages.length === 0) {
    console.log('No publishable packages found.');
    return;
  }

  // Sort packages so dependencies are published first
  const sortedPackages = sortByDependencyOrder(packages);

  console.log(`Found ${packages.length} package(s) (in publish order):`);
  sortedPackages.forEach((p, i) => console.log(`  ${i + 1}. ${p.name}`));

  // Track versions we've published this run
  const publishedVersions = new Map();

  for (const pkg of sortedPackages) {
    console.log(`\n--- Processing ${pkg.name} ---`);

    const lastTag = getLastTag(pkg.name);
    const changed = hasChanges(pkg.relativePath, lastTag);

    // Check if any of its internal dependencies were just published
    const depsUpdated = updateInternalDependencies(pkg, publishedVersions);

    if (!changed && !depsUpdated) {
      console.log(`No changes since last publish (${lastTag}). Skipping.`);
      continue;
    }

    if (depsUpdated && !changed) {
      console.log('Internal dependencies updated. Publishing new version.');
    } else {
      console.log(lastTag ? `Changes detected since ${lastTag}.` : 'No previous tag found. Publishing initial version.');
    }

    // Increment version
    console.log('Incrementing patch version...');
    exec(`npm version patch --no-git-tag-version`, { cwd: pkg.path });

    // Read new version
    const updatedPackageJson = JSON.parse(readFileSync(pkg.packageJsonPath, 'utf-8'));
    const newVersion = updatedPackageJson.version;
    console.log(`New version: ${newVersion}`);

    // Track this version for dependent packages
    publishedVersions.set(pkg.name, newVersion);

    // Publish
    console.log('Publishing to npm...');
    try {
      exec(`npm publish --access public`, { cwd: pkg.path });
      console.log(`Successfully published ${pkg.name}@${newVersion}`);

      // Create and push git tag
      const safeName = pkg.name.replace('@', '').replace('/', '-');
      const tagName = `${safeName}-v${newVersion}`;
      exec(`git tag ${tagName}`);
      exec(`git push origin ${tagName}`);
      console.log(`Created and pushed tag: ${tagName}`);
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
