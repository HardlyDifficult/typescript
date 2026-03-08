import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";

import { describe, expect, it } from "vitest";

import {
  assertPinnedDependencies,
  checkPinnedDependencies,
  PinnedDependenciesError,
} from "../src/index.js";

function createTempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "ci-scripts-pinned-"));
}

function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe("checkPinnedDependencies", () => {
  it("checks the workspace root and ignores node_modules and dist", () => {
    const rootDir = createTempWorkspace();

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
      });
      writeJsonFile(join(rootDir, "packages", "alpha", "package.json"), {
        name: "@acme/alpha",
        version: "1.0.0",
        dependencies: {
          lodash: "^4.17.21",
        },
      });
      writeJsonFile(join(rootDir, "node_modules", "ignored", "package.json"), {
        name: "ignored",
        version: "1.0.0",
        dependencies: {
          ignored: "^1.0.0",
        },
      });
      writeJsonFile(
        join(rootDir, "packages", "alpha", "dist", "package.json"),
        {
          name: "@acme/compiled",
          version: "1.0.0",
          dependencies: {
            ignored: "^1.0.0",
          },
        }
      );

      const result = checkPinnedDependencies({
        rootDir: join(rootDir, "packages", "alpha"),
      });

      expect(result.rootDir).toBe(rootDir);
      expect(result.issues).toEqual([
        {
          file: join(rootDir, "packages", "alpha", "package.json"),
          field: "dependencies",
          packageName: "lodash",
          version: "^4.17.21",
        },
      ]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("throws a typed error when unpinned dependencies are found", () => {
    const rootDir = createTempWorkspace();

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
      });
      writeJsonFile(join(rootDir, "packages", "alpha", "package.json"), {
        name: "@acme/alpha",
        version: "1.0.0",
        dependencies: {
          lodash: "~4.17.21",
        },
      });

      let error: unknown;
      try {
        assertPinnedDependencies({
          rootDir: join(rootDir, "packages", "alpha"),
        });
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(PinnedDependenciesError);
      expect((error as Error).message).toContain("Found unpinned dependencies");
      expect((error as Error).message).toContain(
        'dependencies.lodash: "~4.17.21"'
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
