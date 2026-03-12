import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";

import { describe, expect, it, vi } from "vitest";

import {
  checkPackageMetadata,
  assertPackageMetadata,
  formatPackageMetadataSuccess,
  runCheckPackageMetadataCli,
} from "../src/check-package-metadata.js";

function createTempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "ci-scripts-metadata-extra-"));
}

function writeJsonFile(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function createValidWorkspacePackage(
  rootDir: string,
  packageName: string,
  nodeBaseline = ">=42.0.0"
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
      node: nodeBaseline,
    },
  });
}

describe("checkPackageMetadata - extra coverage", () => {
  it("returns empty packageFiles when packages directory does not exist", () => {
    const rootDir = createTempWorkspace();

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
        engines: { node: ">=42.0.0" },
      });
      // No packages directory created

      const result = checkPackageMetadata({ rootDir });

      expect(result.packageFiles).toEqual([]);
      expect(result.issues).toEqual([]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("uses DEFAULT_NODE_ENGINE_BASELINE when root package.json has no engines field", () => {
    const rootDir = createTempWorkspace();

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
        // No engines field
      });
      // Create a package with the default node engine to avoid issues
      writeJsonFile(join(rootDir, "packages", "alpha", "package.json"), {
        name: "@acme/alpha",
        version: "1.0.0",
        files: ["dist"],
        scripts: { build: "tsc", clean: "rm -rf dist" },
        engines: { node: ">=20.19.0" },
      });

      const result = checkPackageMetadata({ rootDir });

      expect(result.nodeEngineBaseline).toBe(">=20.19.0");
      expect(result.issues).toEqual([]);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("uses DEFAULT_NODE_ENGINE_BASELINE when root package.json does not exist", () => {
    const rootDir = createTempWorkspace();

    try {
      // Create packages dir but no root package.json
      mkdirSync(join(rootDir, "packages"), { recursive: true });

      const result = checkPackageMetadata({ rootDir });

      expect(result.nodeEngineBaseline).toBe(">=20.19.0");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("reports all missing required fields", () => {
    const rootDir = createTempWorkspace();

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
        engines: { node: ">=42.0.0" },
      });
      // Package with all required fields missing
      writeJsonFile(join(rootDir, "packages", "empty", "package.json"), {});

      const result = checkPackageMetadata({ rootDir });

      const messages = result.issues.map((i) => i.message);
      expect(messages).toContain("missing required field: name");
      expect(messages).toContain("missing required field: version");
      expect(messages).toContain("missing required field: files");
      expect(messages).toContain("missing required field: scripts");
      expect(messages).toContain("missing required field: engines");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("skips non-directory entries in packages dir", () => {
    const rootDir = createTempWorkspace();

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
        engines: { node: ">=42.0.0" },
      });
      mkdirSync(join(rootDir, "packages"), { recursive: true });
      // Create a file (not a directory) in packages dir
      writeFileSync(join(rootDir, "packages", "not-a-dir.txt"), "text");
      createValidWorkspacePackage(rootDir, "alpha");

      const result = checkPackageMetadata({ rootDir });

      expect(result.packageFiles).toHaveLength(1);
      expect(result.packageFiles[0]).toContain("alpha");
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("skips package directories without package.json", () => {
    const rootDir = createTempWorkspace();

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
        engines: { node: ">=42.0.0" },
      });
      // Create a directory without package.json
      mkdirSync(join(rootDir, "packages", "no-package-json"), {
        recursive: true,
      });
      createValidWorkspacePackage(rootDir, "alpha");

      const result = checkPackageMetadata({ rootDir });

      expect(result.packageFiles).toHaveLength(1);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });
});

describe("formatPackageMetadataSuccess", () => {
  it("returns a formatted success message", () => {
    const result = {
      packageFiles: ["/path/a/package.json", "/path/b/package.json"],
      rootDir: "/workspace",
      nodeEngineBaseline: ">=20.19.0",
      issues: [],
    };

    const msg = formatPackageMetadataSuccess(result);

    expect(msg).toContain("2 package.json file(s)");
    expect(msg).toContain("/workspace");
    expect(msg).toContain(">=20.19.0");
  });
});

describe("runCheckPackageMetadataCli", () => {
  it("returns 0 and logs success when all packages are valid", () => {
    const rootDir = createTempWorkspace();
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
        engines: { node: ">=42.0.0" },
      });
      createValidWorkspacePackage(rootDir, "alpha");

      // Mock process.cwd to point to our temp workspace
      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(rootDir);

      try {
        const exitCode = runCheckPackageMetadataCli();
        expect(exitCode).toBe(0);
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("package.json file(s)")
        );
      } finally {
        cwdSpy.mockRestore();
      }
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
      consoleSpy.mockRestore();
    }
  });

  it("returns 1 and logs error when packages have issues", () => {
    const rootDir = createTempWorkspace();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      writeJsonFile(join(rootDir, "package.json"), {
        name: "workspace",
        private: true,
        workspaces: ["packages/*"],
        engines: { node: ">=42.0.0" },
      });
      // Package with wrong node version
      writeJsonFile(join(rootDir, "packages", "bad", "package.json"), {
        name: "@acme/bad",
        version: "1.0.0",
        files: ["dist"],
        scripts: { build: "tsc", clean: "rm -rf dist" },
        engines: { node: ">=18.0.0" },
      });

      const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(rootDir);

      try {
        const exitCode = runCheckPackageMetadataCli();
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
