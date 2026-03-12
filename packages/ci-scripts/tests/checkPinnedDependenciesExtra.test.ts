import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";

import { describe, expect, it, vi } from "vitest";

import {
  checkPinnedDependencies,
  assertPinnedDependencies,
  formatPinnedDependenciesSuccess,
  runCheckPinnedDependenciesCli,
} from "../src/check-pinned-deps.js";

function createTempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "ci-scripts-pinned-extra-"));
}

function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe("checkPinnedDependencies - extra coverage", () => {
  it("ignores .tmp directories", () => {
    const rootDir = createTempWorkspace();

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
      });
      // Valid package
      writeJsonFile(join(rootDir, "packages", "alpha", "package.json"), {
        name: "@acme/alpha",
        version: "1.0.0",
        dependencies: { lodash: "4.17.21" },
      });
      // File in .tmp directory (should be ignored)
      writeJsonFile(join(rootDir, ".tmp", "some", "package.json"), {
        name: "tmp-package",
        version: "1.0.0",
        dependencies: { lodash: "^4.17.21" },
      });

      const result = checkPinnedDependencies({ rootDir });

      expect(result.issues).toEqual([]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("checks all dependency field types (devDependencies, peerDependencies, optionalDependencies)", () => {
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
        devDependencies: { typescript: "^5.0.0" },
        peerDependencies: { react: "~18.0.0" },
        optionalDependencies: { fsevents: "^2.3.3" },
      });

      const result = checkPinnedDependencies({ rootDir });

      expect(result.issues).toHaveLength(3);
      expect(result.issues.some((i) => i.field === "devDependencies")).toBe(
        true
      );
      expect(result.issues.some((i) => i.field === "peerDependencies")).toBe(
        true
      );
      expect(result.issues.some((i) => i.field === "optionalDependencies")).toBe(
        true
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("skips non-package.json files in scanned directories", () => {
    const rootDir = createTempWorkspace();

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
      });
      // Create a file that is not a directory and not "package.json"
      mkdirSync(join(rootDir, "packages", "alpha"), { recursive: true });
      writeFileSync(join(rootDir, "packages", "alpha", "README.md"), "# Alpha");
      writeJsonFile(join(rootDir, "packages", "alpha", "package.json"), {
        name: "@acme/alpha",
        version: "1.0.0",
        dependencies: { lodash: "4.17.21" },
      });

      const result = checkPinnedDependencies({ rootDir });

      expect(result.issues).toHaveLength(0);
      expect(result.packageFiles).toHaveLength(2); // root + alpha
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("recursively finds package.json files in subdirectories", () => {
    const rootDir = createTempWorkspace();

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
      });
      writeJsonFile(
        join(rootDir, "packages", "alpha", "nested", "package.json"),
        {
          name: "@acme/alpha-nested",
          version: "1.0.0",
          dependencies: { lodash: "^4.0.0" },
        }
      );

      const result = checkPinnedDependencies({ rootDir });

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]?.packageName).toBe("lodash");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});

describe("formatPinnedDependenciesSuccess", () => {
  it("returns a formatted success message", () => {
    const result = {
      rootDir: "/workspace",
      packageFiles: ["/workspace/a/package.json", "/workspace/b/package.json"],
      issues: [],
    };

    const msg = formatPinnedDependenciesSuccess(result);

    expect(msg).toContain("2 package.json file(s)");
    expect(msg).toContain("/workspace");
    expect(msg).toContain("all dependencies are pinned");
  });
});

describe("runCheckPinnedDependenciesCli", () => {
  it("returns 0 and logs success when all dependencies are pinned", () => {
    const rootDir = createTempWorkspace();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
      });
      writeJsonFile(join(rootDir, "packages", "alpha", "package.json"), {
        name: "@acme/alpha",
        version: "1.0.0",
        dependencies: { lodash: "4.17.21" },
      });

      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(rootDir);

      try {
        const exitCode = runCheckPinnedDependenciesCli();
        expect(exitCode).toBe(0);
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("all dependencies are pinned")
        );
      } finally {
        cwdSpy.mockRestore();
      }
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("returns 1 and logs error when unpinned dependencies found", () => {
    const rootDir = createTempWorkspace();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
      });
      writeJsonFile(join(rootDir, "packages", "alpha", "package.json"), {
        name: "@acme/alpha",
        version: "1.0.0",
        dependencies: { lodash: "^4.17.21" },
      });

      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(rootDir);

      try {
        const exitCode = runCheckPinnedDependenciesCli();
        expect(exitCode).toBe(1);
        expect(errorSpy).toHaveBeenCalled();
      } finally {
        cwdSpy.mockRestore();
      }
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      errorSpy.mockRestore();
    }
  });


});
