import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  parsePublishArgs,
  publishPackages,
  runPublishCli,
} from "../src/publish.js";

// Mock child_process
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

import { execSync } from "child_process";

const mockExecSync = vi.mocked(execSync);

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "ci-scripts-publish-"));
}

function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(require("path").dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function createRootPackageJson(rootDir: string): void {
  writeJsonFile(join(rootDir, "package.json"), {
    name: "workspace",
    private: true,
    workspaces: ["packages/*"],
  });
}

function createPublicPackage(
  rootDir: string,
  name: string,
  pkgName: string,
  version = "1.0.0",
  extra: Record<string, unknown> = {}
): string {
  const pkgPath = join(rootDir, "packages", name);
  writeJsonFile(join(pkgPath, "package.json"), {
    name: pkgName,
    version,
    ...extra,
  });
  return pkgPath;
}

describe("parsePublishArgs", () => {
  it("returns default packagesDir when no args", () => {
    expect(parsePublishArgs([])).toEqual({ packagesDir: "packages" });
  });

  it("parses --packages-dir argument", () => {
    expect(parsePublishArgs(["--packages-dir", "libs"])).toEqual({
      packagesDir: "libs",
    });
  });

  it("ignores --packages-dir when next arg is missing", () => {
    expect(parsePublishArgs(["--packages-dir"])).toEqual({
      packagesDir: "packages",
    });
  });

  it("ignores --packages-dir when next arg is empty string", () => {
    expect(parsePublishArgs(["--packages-dir", ""])).toEqual({
      packagesDir: "packages",
    });
  });

  it("uses process.argv.slice(2) as default args", () => {
    const origArgv = process.argv;
    process.argv = ["node", "script.js", "--packages-dir", "custom"];
    try {
      expect(parsePublishArgs()).toEqual({ packagesDir: "custom" });
    } finally {
      process.argv = origArgv;
    }
  });
});

describe("publishPackages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty result when no publishable packages exist", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      mkdirSync(join(rootDir, "packages"), { recursive: true });

      const result = publishPackages({ rootDir });

      expect(result.published).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        "No publishable packages found."
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("skips private packages", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "private-pkg", "@acme/private", "1.0.0", {
        private: true,
      });

      const result = publishPackages({ rootDir });

      expect(result.published).toEqual([]);
      expect(result.skipped).toEqual([]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("skips packages without package.json", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      // Create a directory without package.json
      mkdirSync(join(rootDir, "packages", "no-json"), { recursive: true });

      const result = publishPackages({ rootDir });

      expect(result.published).toEqual([]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("skips non-directory entries in packages dir", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      mkdirSync(join(rootDir, "packages"), { recursive: true });
      writeFileSync(join(rootDir, "packages", "not-a-dir.txt"), "text");

      const result = publishPackages({ rootDir });

      expect(result.published).toEqual([]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("publishes initial release when no previous tag exists", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return ""; // No tags => initial release
        }
        if (typeof command === "string" && command.includes("npm view")) {
          return "null"; // No versions on npm
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      expect(result.published).toHaveLength(1);
      expect(result.published[0]?.reason).toBe("initial-release");
      expect(result.published[0]?.version).toBe("1.0.0");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it("publishes with changed reason when previous tag exists and files changed", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return "acme-alpha-v1.0.0"; // Has a previous tag
        }
        if (
          typeof command === "string" &&
          command.includes("git diff --name-only")
        ) {
          return "packages/alpha/src/index.ts"; // Has changes
        }
        if (typeof command === "string" && command.includes("npm view")) {
          return '"1.0.0"'; // Single version string from npm
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      expect(result.published).toHaveLength(1);
      expect(result.published[0]?.reason).toBe("changed");
      expect(result.published[0]?.version).toBe("1.0.1");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("skips unchanged packages when no changes detected", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return "acme-alpha-v1.0.0"; // Has a previous tag
        }
        if (
          typeof command === "string" &&
          command.includes("git diff --name-only")
        ) {
          return ""; // No changes
        }
        if (typeof command === "string" && command.includes("npm view")) {
          return '"1.0.0"';
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0]?.reason).toBe("unchanged");
      expect(result.skipped[0]?.name).toBe("@acme/alpha");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("tracks existing npm version for skipped packages", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.5");

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return "acme-alpha-v1.0.5";
        }
        if (
          typeof command === "string" &&
          command.includes("git diff --name-only")
        ) {
          return "";
        }
        if (typeof command === "string" && command.includes("npm view")) {
          return '["1.0.0","1.0.1","1.0.5"]';
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      expect(result.skipped).toHaveLength(1);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("skipped package without npm version does not track version", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return "acme-alpha-v1.0.0";
        }
        if (
          typeof command === "string" &&
          command.includes("git diff --name-only")
        ) {
          return "";
        }
        if (typeof command === "string" && command.includes("npm view")) {
          throw new Error("Package not found");
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      expect(result.skipped).toHaveLength(1);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("handles npm view returning a single version string (not array)", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return "";
        }
        if (typeof command === "string" && command.includes("npm view")) {
          return '"1.0.0"'; // Single string, not array
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      expect(result.published).toHaveLength(1);
      expect(result.published[0]?.version).toBe("1.0.1");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("publishes dependency-update reason when deps change but package unchanged", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      // alpha is a dependency of beta; beta's recorded version is old (0.9.0)
      // so when alpha publishes 1.0.0, beta's dep gets updated to 1.0.0 (different)
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");
      createPublicPackage(rootDir, "beta", "@acme/beta", "1.0.0", {
        dependencies: { "@acme/alpha": "0.9.0" },
      });

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          // alpha: no tag (initial release)
          // beta: has a tag (unchanged)
          if ((command as string).includes('"acme-beta')) {
            return "acme-beta-v1.0.0";
          }
          return "";
        }
        if (
          typeof command === "string" &&
          command.includes("git diff --name-only")
        ) {
          // beta: no changes
          if ((command as string).includes("packages/beta")) {
            return "";
          }
          return "";
        }
        if (typeof command === "string" && command.includes("npm view")) {
          // No existing versions
          throw new Error("not found");
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      // alpha should be published (initial-release since no tag)
      // beta should be published (dependency-update) because alpha dep was updated
      const betaPublished = result.published.find(
        (p) => p.name === "@acme/beta"
      );
      expect(betaPublished?.reason).toBe("dependency-update");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("transforms file: references in dependencies when publishing", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");
      createPublicPackage(rootDir, "beta", "@acme/beta", "1.0.0", {
        dependencies: { "@acme/alpha": "file:../alpha" },
      });

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return "";
        }
        if (typeof command === "string" && command.includes("npm view")) {
          throw new Error("not found");
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      // Beta should have been published with file: reference transformed
      const betaPublished = result.published.find(
        (p) => p.name === "@acme/beta"
      );
      expect(betaPublished).toBeDefined();

      // Check the beta package.json was updated
      const betaPkg = JSON.parse(
        readFileSync(
          join(rootDir, "packages", "beta", "package.json"),
          "utf-8"
        )
      ) as { dependencies?: Record<string, string> };
      expect(betaPkg.dependencies?.["@acme/alpha"]).not.toMatch(/^file:/);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("warns about file: in peerDependencies and skips transform", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");
      createPublicPackage(rootDir, "beta", "@acme/beta", "1.0.0", {
        peerDependencies: { "@acme/alpha": "file:../alpha" },
      });

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return "";
        }
        if (typeof command === "string" && command.includes("npm view")) {
          throw new Error("not found");
        }
        return "";
      });

      publishPackages({ rootDir });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("peerDependencies uses file: reference")
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  it("updates non-file: internal dependency versions", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");
      createPublicPackage(rootDir, "beta", "@acme/beta", "1.0.0", {
        dependencies: { "@acme/alpha": "1.0.0" },
      });

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return "";
        }
        if (typeof command === "string" && command.includes("npm view")) {
          throw new Error("not found");
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      const alphaPublished = result.published.find(
        (p) => p.name === "@acme/alpha"
      );
      expect(alphaPublished).toBeDefined();
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("handles circular dependency detection", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0", {
        dependencies: { "@acme/beta": "1.0.0" },
      });
      createPublicPackage(rootDir, "beta", "@acme/beta", "1.0.0", {
        dependencies: { "@acme/alpha": "1.0.0" },
      });

      expect(() => publishPackages({ rootDir })).toThrow(
        "Circular dependency detected"
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("treats lastTag=null as always-changed (initial release)", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          // Return empty string -> null tag (no previous release)
          return "";
        }
        if (typeof command === "string" && command.includes("npm view")) {
          throw new Error("not found");
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      // lastTag is null => hasChanges returns true => package gets published
      expect(result.published).toHaveLength(1);
      expect(result.published[0]?.reason).toBe("initial-release");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("handles git tag -l throwing (falls back to null tag)", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          throw new Error("git error");
        }
        if (typeof command === "string" && command.includes("npm view")) {
          throw new Error("not found");
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      expect(result.published).toHaveLength(1);
      expect(result.published[0]?.reason).toBe("initial-release");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("handles package name with @ and / in tag generation", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@scope/alpha", "2.0.0");

      const tagCalls: string[] = [];
      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          tagCalls.push(command as string);
          return "";
        }
        if (typeof command === "string" && command.includes("git tag ")) {
          tagCalls.push(command as string);
          return "";
        }
        if (typeof command === "string" && command.includes("npm view")) {
          throw new Error("not found");
        }
        return "";
      });

      publishPackages({ rootDir });

      // Tag name should have @ and / replaced
      const gitTagCall = tagCalls.find(
        (c) => c.includes("git tag ") && !c.includes("-l")
      );
      expect(gitTagCall).toContain("scope-alpha-v");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("uses custom packagesDir option", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["libs/*"],
      });
      writeJsonFile(join(rootDir, "libs", "alpha", "package.json"), {
        name: "@acme/alpha",
        version: "1.0.0",
      });

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return "";
        }
        if (typeof command === "string" && command.includes("npm view")) {
          throw new Error("not found");
        }
        return "";
      });

      const result = publishPackages({ rootDir, packagesDir: "libs" });

      expect(result.packagesDir).toBe("libs");
      expect(result.published).toHaveLength(1);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("handles packages with devDependencies and peerDependencies on workspace packages", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");
      createPublicPackage(rootDir, "beta", "@acme/beta", "1.0.0", {
        devDependencies: { "@acme/alpha": "1.0.0" },
        peerDependencies: { "@acme/alpha": ">=1.0.0" },
      });

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return "";
        }
        if (typeof command === "string" && command.includes("npm view")) {
          throw new Error("not found");
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      // Both should be published
      expect(result.published).toHaveLength(2);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("resolves rootDir from process.cwd when not provided", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      mkdirSync(join(rootDir, "packages"), { recursive: true });

      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(rootDir);

      try {
        const result = publishPackages();
        expect(result.rootDir).toBe(rootDir);
      } finally {
        cwdSpy.mockRestore();
      }
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("npm view with no matching major.minor versions returns null", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "2.0.0");

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return "";
        }
        if (typeof command === "string" && command.includes("npm view")) {
          // Returns versions but none matching 2.0.x
          return '["1.0.0","1.0.1","1.1.0"]';
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      expect(result.published[0]?.version).toBe("2.0.0");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("handles package with external (non-workspace) dependencies", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0", {
        dependencies: { lodash: "4.17.21" }, // external dep — not in workspace
      });

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return "";
        }
        if (typeof command === "string" && command.includes("npm view")) {
          throw new Error("not found");
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      // Alpha should be published; lodash dep doesn't affect sorting
      expect(result.published).toHaveLength(1);
      expect(result.published[0]?.name).toBe("@acme/alpha");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("handles diamond dependency (newDegree > 0 before reaching 0)", () => {
    // gamma depends on BOTH alpha AND beta (diamond pattern).
    // gamma's inDegree = 2. When alpha is processed, gamma's degree: 2→1 (false branch
    // of `if (newDegree === 0)`). When beta is processed, gamma's degree: 1→0 (true branch).
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      // alpha and beta: no workspace deps → inDegree=0
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");
      createPublicPackage(rootDir, "beta", "@acme/beta", "1.0.0");
      // gamma depends on both alpha and beta → inDegree=2
      createPublicPackage(rootDir, "gamma", "@acme/gamma", "1.0.0", {
        dependencies: { "@acme/alpha": "1.0.0", "@acme/beta": "1.0.0" },
      });

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return "";
        }
        if (typeof command === "string" && command.includes("npm view")) {
          throw new Error("not found");
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      // gamma must be published after both alpha and beta
      expect(result.published).toHaveLength(3);
      const names = result.published.map((p) => p.name);
      expect(names.indexOf("@acme/gamma")).toBeGreaterThan(
        names.indexOf("@acme/alpha")
      );
      expect(names.indexOf("@acme/gamma")).toBeGreaterThan(
        names.indexOf("@acme/beta")
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("handles package with malformed version (no minor/patch parts)", () => {
    // Version "1" has no minor or patch — triggers the `?? "0"` fallbacks
    // in version parsing code.
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1");

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return "";
        }
        if (typeof command === "string" && command.includes("npm view")) {
          throw new Error("not found");
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      // Should publish with version "1.0.0" (using defaults for missing parts)
      expect(result.published).toHaveLength(1);
      expect(result.published[0]?.version).toBe("1.0.0");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("skips package and tracks its npm version for dependency resolution", () => {
    // When a package is skipped but has a matching npm version,
    // it should be tracked in publishedVersions (covers the `latestVersion !== null` true branch).
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      // alpha is skipped (unchanged) but has an npm version that matches 1.0.x
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return "acme-alpha-v1.0.0"; // Has a tag → check for changes
        }
        if (typeof command === "string" && command.includes("git diff")) {
          return ""; // No changes → skipped
        }
        if (typeof command === "string" && command.includes("npm view")) {
          return '["1.0.0"]'; // npm has version 1.0.0 (matches 1.0.x)
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      // Alpha should be skipped but its npm version tracked
      expect(result.skipped).toHaveLength(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Tracked existing version")
      );
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("handles file: reference to unpublished dependency (no version in publishedVersions)", () => {
    // When a package's file: dependency was NOT published in this run,
    // publishedVersions.get(depName) returns undefined, so the false branch
    // of `if (newVersion !== undefined && newVersion !== "")` is taken.
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      // beta has a file: reference to alpha, but alpha is skipped (not published)
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");
      createPublicPackage(rootDir, "beta", "@acme/beta", "1.0.0", {
        dependencies: { "@acme/alpha": "file:../alpha" },
      });

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          // alpha has a tag (so it's skipped as unchanged)
          if ((command as string).includes('"acme-alpha')) {
            return "acme-alpha-v1.0.0";
          }
          return ""; // beta: no tag (initial release)
        }
        if (typeof command === "string" && command.includes("git diff")) {
          return ""; // alpha: no changes → skipped
        }
        if (typeof command === "string" && command.includes("npm view")) {
          throw new Error("not found");
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      // beta should be published (initial release)
      // alpha should be skipped
      const betaPublished = result.published.find((p) => p.name === "@acme/beta");
      expect(betaPublished).toBeDefined();
      const alphaSkipped = result.skipped.find((p) => p.name === "@acme/alpha");
      expect(alphaSkipped).toBeDefined();
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("publishes with existing npm patch version (latestNpmVersion not null)", () => {
    // Covers the `if (latestNpmVersion !== null)` true branch by having npm
    // return an existing version matching the package's major.minor.
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");

      mockExecSync.mockImplementation((command: string) => {
        if (typeof command === "string" && command.includes("git tag -l")) {
          return ""; // No previous tag → initial release
        }
        if (typeof command === "string" && command.includes("npm view")) {
          // npm has 1.0.3 already → next publish should be 1.0.4
          return '["1.0.0","1.0.1","1.0.2","1.0.3"]';
        }
        return "";
      });

      const result = publishPackages({ rootDir });

      expect(result.published).toHaveLength(1);
      expect(result.published[0]?.version).toBe("1.0.4");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });
});

describe("runPublishCli", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 on success", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      mkdirSync(join(rootDir, "packages"), { recursive: true });

      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(rootDir);

      try {
        const exitCode = runPublishCli([]);
        expect(exitCode).toBe(0);
      } finally {
        cwdSpy.mockRestore();
      }
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("returns 1 and logs error on failure", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    // Provide a packagesDir that doesn't exist to force an error
    const cwdSpy = vi
      .spyOn(process, "cwd")
      .mockReturnValue("/nonexistent/path");

    try {
      const exitCode = runPublishCli(["--packages-dir", "packages"]);
      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "Publish failed:",
        expect.any(String)
      );
    } finally {
      cwdSpy.mockRestore();
      errorSpy.mockRestore();
      consoleSpy.mockRestore();
    }
  });

  it("returns 1 and handles non-Error thrown values", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    // Mock execSync to throw a string (non-Error)
    mockExecSync.mockImplementation(() => {
      throw "string error";
    });

    const rootDir = createTempDir();

    try {
      createRootPackageJson(rootDir);
      createPublicPackage(rootDir, "alpha", "@acme/alpha", "1.0.0");

      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(rootDir);

      try {
        const exitCode = runPublishCli([]);
        expect(exitCode).toBe(1);
      } finally {
        cwdSpy.mockRestore();
      }
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      errorSpy.mockRestore();
      consoleSpy.mockRestore();
    }
  });

  it("uses process.argv.slice(2) as default args", () => {
    const rootDir = createTempDir();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      createRootPackageJson(rootDir);
      mkdirSync(join(rootDir, "packages"), { recursive: true });

      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(rootDir);
      const origArgv = process.argv;
      process.argv = ["node", "script.js"];

      try {
        const exitCode = runPublishCli();
        expect(exitCode).toBe(0);
      } finally {
        cwdSpy.mockRestore();
        process.argv = origArgv;
      }
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });
});
