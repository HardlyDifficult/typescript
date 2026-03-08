import { existsSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";

interface RootPackageJson {
  workspaces?: unknown;
}

/**
 * Finds the nearest workspace root by walking up until a package.json with
 * a workspaces field is found. Falls back to the starting directory.
 */
export function findWorkspaceRoot(startDir = process.cwd()): string {
  let currentDir = resolve(startDir);

  for (;;) {
    const packageJsonPath = join(currentDir, "package.json");
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(
        readFileSync(packageJsonPath, "utf-8")
      ) as RootPackageJson;

      if (packageJson.workspaces !== undefined) {
        return currentDir;
      }
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return resolve(startDir);
    }

    currentDir = parentDir;
  }
}
