import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";

import { describe, expect, it } from "vitest";

import {
  assertPackageMetadata,
  checkPackageMetadata,
  PackageMetadataError,
} from "../src/index.js";

function createTempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "ci-scripts-metadata-"));
}

function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function createWorkspacePackage(
  rootDir: string,
  packageName: string,
  overrides: Record<string, unknown> = {}
): void {
  writeJsonFile(join(rootDir, "packages", packageName, "package.json"), {
    name: `@acme/${packageName}`,
    version: "1.0.0",
    files: ["dist"],
    scripts: {
      build: "tsc",
      clean: "rm -rf dist",
    },
    engines: {
      node: ">=42.0.0",
    },
    ...overrides,
  });
}

describe("checkPackageMetadata", () => {
  it("uses the workspace root and root node baseline automatically", () => {
    const rootDir = createTempWorkspace();

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
        engines: {
          node: ">=42.0.0",
        },
      });
      createWorkspacePackage(rootDir, "alpha");

      const result = checkPackageMetadata({
        rootDir: join(rootDir, "packages", "alpha"),
      });

      expect(result.rootDir).toBe(rootDir);
      expect(result.nodeEngineBaseline).toBe(">=42.0.0");
      expect(result.packageFiles).toEqual([
        join(rootDir, "packages", "alpha", "package.json"),
      ]);
      expect(result.issues).toEqual([]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("throws a grouped error for invalid package metadata", () => {
    const rootDir = createTempWorkspace();

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
        engines: {
          node: ">=42.0.0",
        },
      });
      createWorkspacePackage(rootDir, "alpha", {
        files: [],
        scripts: {
          build: "tsc",
        },
        engines: {
          node: ">=20.19.0",
        },
      });

      let error: unknown;
      try {
        assertPackageMetadata({
          rootDir: join(rootDir, "packages", "alpha"),
        });
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(PackageMetadataError);
      expect((error as Error).message).toContain(
        'engines.node must be ">=42.0.0"'
      );
      expect((error as Error).message).toContain(
        "missing required script: scripts.clean"
      );
      expect((error as Error).message).toContain(
        "files must include at least one entry"
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
