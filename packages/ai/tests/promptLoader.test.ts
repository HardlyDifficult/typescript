import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { createPromptLoader } from "../src/promptLoader.js";

describe("createPromptLoader", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "prompt-loader-test-"));
    mkdirSync(join(tmpDir, "subdir"), { recursive: true });
    writeFileSync(join(tmpDir, "hello.md"), "Hello, world!");
    writeFileSync(join(tmpDir, "subdir", "nested.md"), "Nested content");
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("reads a prompt file from the given directory", () => {
    const load = createPromptLoader(tmpDir, "hello.md");
    expect(load()).toBe("Hello, world!");
  });

  it("reads nested prompt files", () => {
    const load = createPromptLoader(tmpDir, "subdir/nested.md");
    expect(load()).toBe("Nested content");
  });

  it("caches the result on repeated calls", () => {
    const load = createPromptLoader(tmpDir, "hello.md");
    const first = load();
    const second = load();
    expect(first).toBe(second);
  });

  it("throws when file does not exist", () => {
    const load = createPromptLoader(tmpDir, "nonexistent.md");
    expect(() => load()).toThrow();
  });
});
