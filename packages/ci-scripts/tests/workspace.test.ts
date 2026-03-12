import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import { describe, expect, it } from "vitest";

import { findWorkspaceRoot } from "../src/workspace.js";

describe("findWorkspaceRoot", () => {
  it("finds workspace root by walking up directories", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "ci-scripts-workspace-"));

    try {
      // Root package.json with workspaces field
      writeFileSync(
        join(rootDir, "package.json"),
        JSON.stringify({ name: "root", workspaces: ["packages/*"] })
      );
      // Nested directory
      mkdirSync(join(rootDir, "packages", "alpha"), { recursive: true });
      writeFileSync(
        join(rootDir, "packages", "alpha", "package.json"),
        JSON.stringify({ name: "@acme/alpha" })
      );

      const result = findWorkspaceRoot(join(rootDir, "packages", "alpha"));

      expect(result).toBe(rootDir);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("returns startDir when no workspace root is found (reaches filesystem root)", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "ci-scripts-workspace-"));

    try {
      // Create a directory with a package.json but NO workspaces field
      mkdirSync(join(rootDir, "subdir"), { recursive: true });
      writeFileSync(
        join(rootDir, "subdir", "package.json"),
        JSON.stringify({ name: "no-workspace" })
      );

      const startDir = join(rootDir, "subdir");
      const result = findWorkspaceRoot(startDir);

      // Should fall back to startDir since no package.json with workspaces was found
      // (it will eventually walk all the way up and return the resolved startDir)
      expect(result).toBe(startDir);
    } finally {
      rmSync(rootDir, { recursive: true, force: true });
    }
  });

  it("uses process.cwd() as default startDir", () => {
    // This test just verifies the function doesn't throw when called with no args
    expect(() => findWorkspaceRoot()).not.toThrow();
  });
});
