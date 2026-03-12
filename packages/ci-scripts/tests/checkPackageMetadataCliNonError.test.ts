/**
 * Tests the non-Error throw branch in CLI functions:
 * `error instanceof Error ? error.message : String(error)`
 * This requires mocking the fs module at the module level.
 */
import { describe, expect, it, vi } from "vitest";

// Mock fs module so we can control readdirSync behavior
vi.mock("fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("fs")>();
  return {
    ...actual,
    readdirSync: vi.fn(actual.readdirSync),
    existsSync: vi.fn(actual.existsSync),
  };
});

import * as fsMock from "fs";
import {
  runCheckPackageMetadataCli,
} from "../src/check-package-metadata.js";
import {
  runCheckPinnedDependenciesCli,
} from "../src/check-pinned-deps.js";

describe("CLI non-Error error handling", () => {
  it("runCheckPackageMetadataCli: String(error) when non-Error is thrown", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Make readdirSync throw a non-Error string
    vi.mocked(fsMock.readdirSync).mockImplementationOnce((() => {
      throw "non-error string value from metadata";
    }) as typeof fsMock.readdirSync);

    try {
      const exitCode = runCheckPackageMetadataCli();
      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "non-error string value from metadata"
      );
    } finally {
      errorSpy.mockRestore();
    }
  });

  it("runCheckPinnedDependenciesCli: String(error) when non-Error is thrown", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Make readdirSync throw a non-Error string
    vi.mocked(fsMock.readdirSync).mockImplementationOnce((() => {
      throw "non-error string value from pinned";
    }) as typeof fsMock.readdirSync);

    try {
      const exitCode = runCheckPinnedDependenciesCli();
      expect(exitCode).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        "non-error string value from pinned"
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
