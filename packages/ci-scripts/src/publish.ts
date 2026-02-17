#!/usr/bin/env node

/**
 * Publishes packages that have changed since the last publish.
 * Auto-increments the patch version for each changed package.
 *
 * Handles inter-package dependencies:
 * - Detects dependency order and publishes dependencies first
 * - Auto-updates dependency versions before publishing dependent packages
 * - Transforms file: references to real versions at publish time
 *
 * Usage:
 *   npx monorepo-publish [--packages-dir <dir>]
 *
 * Options:
 *   --packages-dir  Directory containing packages (default: "packages")
 */

import { execSync, type ExecSyncOptions } from "child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";

interface ExecOptions extends ExecSyncOptions {
  ignoreError?: boolean;
}

interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface Package {
  name: string;
  path: string;
  packageJsonPath: string;
  relativePath: string;
  version: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  peerDependencies: Record<string, string>;
}

function parseArgs(): { packagesDir: string } {
  const args = process.argv.slice(2);
  let packagesDir = "packages";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--packages-dir") {
      const next = args[i + 1];
      if (next !== undefined && next !== "") {
        packagesDir = next;
      }
    }
  }

  return { packagesDir };
}

function exec(command: string, options: ExecOptions = {}): string {
  // eslint-disable-next-line no-console
  console.log(`$ ${command}`);
  try {
    const { ignoreError: _ignoreError, ...execOptions } = options;
    const result = execSync(command, {
      encoding: "utf-8",
      stdio: "pipe",
      ...execOptions,
    });
    return typeof result === "string" ? result.trim() : "";
  } catch (error) {
    if (options.ignoreError === true) {
      return "";
    }
    throw error;
  }
}

function getPackages(packagesDir: string): Package[] {
  const packagesPath = join(process.cwd(), packagesDir);
  const entries = readdirSync(packagesPath);
  const packages: Package[] = [];

  for (const entry of entries) {
    const packagePath = join(packagesPath, entry);
    const stat = statSync(packagePath);

    if (!stat.isDirectory()) {
      continue;
    }

    const packageJsonPath = join(packagePath, "package.json");
    try {
      const packageJson = JSON.parse(
        readFileSync(packageJsonPath, "utf-8")
      ) as PackageJson;
      if (packageJson.private === true) {
        continue;
      }
      packages.push({
        name: packageJson.name,
        path: packagePath,
        packageJsonPath,
        relativePath: `${packagesDir}/${entry}`,
        version: packageJson.version,
        dependencies: packageJson.dependencies ?? {},
        devDependencies: packageJson.devDependencies ?? {},
        peerDependencies: packageJson.peerDependencies ?? {},
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
function sortByDependencyOrder(packages: Package[]): Package[] {
  const packageNames = new Set(packages.map((p) => p.name));
  const graph = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize
  for (const pkg of packages) {
    graph.set(pkg.name, []);
    inDegree.set(pkg.name, 0);
  }

  // Build dependency graph (only for packages in this monorepo)
  for (const pkg of packages) {
    const allDeps: Record<string, string> = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
      ...pkg.peerDependencies,
    };

    for (const dep of Object.keys(allDeps)) {
      if (packageNames.has(dep)) {
        // dep must be published before pkg
        const dependents = graph.get(dep);
        if (dependents) {
          dependents.push(pkg.name);
        }
        const currentDegree = inDegree.get(pkg.name);
        if (currentDegree !== undefined) {
          inDegree.set(pkg.name, currentDegree + 1);
        }
      }
    }
  }

  // Kahn's algorithm for topological sort
  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) {
      queue.push(name);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) {
      break;
    }
    sorted.push(current);

    const dependents = graph.get(current);
    if (dependents) {
      for (const dependent of dependents) {
        const currentDegree = inDegree.get(dependent);
        if (currentDegree !== undefined) {
          const newDegree = currentDegree - 1;
          inDegree.set(dependent, newDegree);
          if (newDegree === 0) {
            queue.push(dependent);
          }
        }
      }
    }
  }

  if (sorted.length !== packages.length) {
    throw new Error("Circular dependency detected between packages");
  }

  // Return packages in sorted order
  const packageMap = new Map(packages.map((p) => [p.name, p]));
  return sorted
    .map((name) => packageMap.get(name))
    .filter((pkg): pkg is Package => pkg !== undefined);
}

function hasChanges(packagePath: string, lastTag: string | null): boolean {
  if (lastTag === null || lastTag === "") {
    return true;
  }

  try {
    const diff = exec(
      `git diff --name-only ${lastTag} HEAD -- ${packagePath}`,
      {
        ignoreError: true,
      }
    );
    return diff.length > 0;
  } catch {
    return true;
  }
}

function getLastTag(packageName: string): string | null {
  try {
    const safeName = packageName.replace("@", "").replace("/", "-");
    const tags = exec(`git tag -l "${safeName}-v*" --sort=-v:refname`, {
      ignoreError: true,
    });
    const tagList = tags.split("\n").filter(Boolean);
    return tagList[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the latest patch version of a package from npm for a given major.minor.
 * Returns the full version string (e.g., "1.1.5") or null if no versions exist for that major.minor.
 */
function getLatestNpmPatchVersion(
  packageName: string,
  majorMinor: string
): string | null {
  try {
    // Get all versions from npm and filter to the major.minor we want
    const allVersions = exec(`npm view ${packageName} versions --json`, {
      ignoreError: false,
    });
    const versions = JSON.parse(allVersions) as string[];

    // Filter to versions matching our major.minor and find the highest patch
    const matchingVersions = versions
      .filter((v) => v.startsWith(`${majorMinor}.`))
      .map((v) => {
        const parts = v.split(".");
        return { full: v, patch: parseInt(parts[2] ?? "0", 10) };
      })
      .sort((a, b) => b.patch - a.patch);

    return matchingVersions[0]?.full ?? null;
  } catch {
    return null;
  }
}

/**
 * Update a package's dependencies to use newly published versions.
 * Handles both:
 * - file:../packageName references (transforms to real version)
 * - version numbers that need updating
 *
 * Note: peerDependencies are excluded from file: transformations since they
 * should use version ranges for compatibility, not exact versions.
 */
function updateInternalDependencies(
  pkg: Package,
  publishedVersions: Map<string, string>
): boolean {
  const packageJson = JSON.parse(
    readFileSync(pkg.packageJsonPath, "utf-8")
  ) as PackageJson;
  let updated = false;

  const depTypes = [
    "dependencies",
    "devDependencies",
    "peerDependencies",
  ] as const;

  for (const depType of depTypes) {
    const deps = packageJson[depType];
    if (!deps) {
      continue;
    }

    for (const [depName, currentVersion] of Object.entries(deps)) {
      // Check if this is a file: reference to a monorepo package
      if (currentVersion.startsWith("file:")) {
        // Skip file: transformations for peerDependencies - they should use
        // version ranges for compatibility, not exact versions
        if (depType === "peerDependencies") {
          console.warn(
            `  Warning: ${depName} in peerDependencies uses file: reference. ` +
              `Consider using a version range instead.`
          );
          continue;
        }
        const newVersion = publishedVersions.get(depName);
        if (newVersion !== undefined && newVersion !== "") {
          // eslint-disable-next-line no-console
          console.log(
            `  Transforming ${depName}: ${currentVersion} → ${newVersion}`
          );
          deps[depName] = newVersion;
          updated = true;
        }
      }
      // Check if this is a version that needs updating
      else {
        const newVersion = publishedVersions.get(depName);
        if (
          newVersion !== undefined &&
          newVersion !== "" &&
          currentVersion !== newVersion
        ) {
          // eslint-disable-next-line no-console
          console.log(
            `  Updating ${depName}: ${currentVersion} → ${newVersion}`
          );
          deps[depName] = newVersion;
          updated = true;
        }
      }
    }
  }

  if (updated) {
    writeFileSync(
      pkg.packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`
    );
  }

  return updated;
}

function main(): void {
  const { packagesDir } = parseArgs();
  const packages = getPackages(packagesDir);

  if (packages.length === 0) {
    // eslint-disable-next-line no-console
    console.log("No publishable packages found.");
    return;
  }

  // Sort packages so dependencies are published first
  const sortedPackages = sortByDependencyOrder(packages);

  // eslint-disable-next-line no-console
  console.log(
    `Found ${String(packages.length)} package(s) (in publish order):`
  );
  sortedPackages.forEach((p, i) => {
    // eslint-disable-next-line no-console
    console.log(`  ${String(i + 1)}. ${p.name}`);
  });

  // Track versions we've published this run
  const publishedVersions = new Map<string, string>();

  for (const pkg of sortedPackages) {
    // eslint-disable-next-line no-console
    console.log(`\n--- Processing ${pkg.name} ---`);

    const lastTag = getLastTag(pkg.name);
    const changed = hasChanges(pkg.relativePath, lastTag);

    // Check if any of its internal dependencies were just published
    const depsUpdated = updateInternalDependencies(pkg, publishedVersions);

    if (!changed && !depsUpdated) {
      // eslint-disable-next-line no-console
      console.log(
        `No changes since last publish (${lastTag ?? "none"}). Skipping.`
      );

      // Even though we're skipping this package, record its current npm version
      // so downstream packages can transform their file: references to it.
      const versionParts = pkg.version.split(".");
      const majorMinor = `${versionParts[0] ?? "0"}.${versionParts[1] ?? "0"}`;
      const latestVersion = getLatestNpmPatchVersion(pkg.name, majorMinor);
      if (latestVersion !== null) {
        publishedVersions.set(pkg.name, latestVersion);
        // eslint-disable-next-line no-console
        console.log(
          `  Tracked existing version ${latestVersion} for dependency resolution.`
        );
      }

      continue;
    }

    if (depsUpdated && !changed) {
      // eslint-disable-next-line no-console
      console.log("Internal dependencies updated. Publishing new version.");
    } else {
      // eslint-disable-next-line no-console
      console.log(
        lastTag !== null && lastTag !== ""
          ? `Changes detected since ${lastTag}.`
          : "No previous tag found. Publishing initial version."
      );
    }

    // Get the major.minor version from package.json - this is controlled by developers.
    // Then auto-determine the patch version based on what's already published to npm.
    const packageJson = JSON.parse(
      readFileSync(pkg.packageJsonPath, "utf-8")
    ) as PackageJson;
    const versionParts = packageJson.version.split(".");
    const major = versionParts[0] ?? "0";
    const minor = versionParts[1] ?? "0";
    const majorMinor = `${major}.${minor}`;

    // Check npm for the latest patch version of this major.minor
    const latestNpmVersion = getLatestNpmPatchVersion(pkg.name, majorMinor);

    let newVersion: string;
    if (latestNpmVersion !== null) {
      // Increment patch from the latest npm version
      const npmParts = latestNpmVersion.split(".");
      const nextPatch = parseInt(npmParts[2] ?? "0", 10) + 1;
      newVersion = `${majorMinor}.${String(nextPatch)}`;
      // eslint-disable-next-line no-console
      console.log(
        `Latest npm version for ${majorMinor}.x: ${latestNpmVersion}`
      );
    } else {
      // No versions exist for this major.minor, start at .0
      newVersion = `${majorMinor}.0`;
      // eslint-disable-next-line no-console
      console.log(`No existing versions for ${majorMinor}.x on npm.`);
    }

    // Update package.json with the new version
    packageJson.version = newVersion;
    writeFileSync(
      pkg.packageJsonPath,
      `${JSON.stringify(packageJson, null, 2)}\n`
    );

    // eslint-disable-next-line no-console
    console.log(`New version: ${newVersion}`);

    // Track this version for dependent packages
    publishedVersions.set(pkg.name, newVersion);

    // Publish
    // eslint-disable-next-line no-console
    console.log("Publishing to npm...");
    try {
      exec(`npm publish --access public`, { cwd: pkg.path });
      // eslint-disable-next-line no-console
      console.log(`Successfully published ${pkg.name}@${newVersion}`);

      // Create and push git tag
      const safeName = pkg.name.replace("@", "").replace("/", "-");
      const tagName = `${safeName}-v${newVersion}`;
      exec(`git tag ${tagName}`);
      exec(`git push origin ${tagName}`);
      // eslint-disable-next-line no-console
      console.log(`Created and pushed tag: ${tagName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to publish ${pkg.name}:`, message);
      process.exit(1);
    }
  }

  // eslint-disable-next-line no-console
  console.log("\nDone!");
}

try {
  main();
} catch (error: unknown) {
  console.error("Publish failed:", error);
  process.exit(1);
}
