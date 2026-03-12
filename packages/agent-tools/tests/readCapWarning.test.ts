import { describe, it, expect } from "vitest";
import type { ToolMap } from "@hardlydifficult/ai";
import { withReadCapWarning } from "../src/tools/readCapWarning.js";

function createMockTools(): ToolMap {
  return {
    read_file: {
      description: "Read a file",
      parameters: {},
      execute: async () => "file contents",
    },
    write_file: {
      description: "Write a file",
      parameters: {},
      execute: async () => "ok",
    },
    search_files: {
      description: "Search files",
      parameters: {},
      execute: async () => "results",
    },
  };
}

describe("withReadCapWarning", () => {
  it("returns tools unchanged when read_file is missing", () => {
    const tools: ToolMap = {
      write_file: {
        description: "Write",
        parameters: {},
        execute: async () => "ok",
      },
    };
    const result = withReadCapWarning(tools);
    expect(result).toBe(tools);
  });

  it("returns tools unchanged when write_file is missing", () => {
    const tools: ToolMap = {
      read_file: {
        description: "Read",
        parameters: {},
        execute: async () => "contents",
      },
    };
    const result = withReadCapWarning(tools);
    expect(result).toBe(tools);
  });

  it("preserves other tools in the map", () => {
    const tools = createMockTools();
    const wrapped = withReadCapWarning(tools);
    expect(wrapped.search_files).toBeDefined();
    expect(wrapped.search_files?.description).toBe("Search files");
  });

  it("does not add warning before threshold", async () => {
    const wrapped = withReadCapWarning(createMockTools(), 3);
    const result1 = await wrapped.read_file?.execute({});
    const result2 = await wrapped.read_file?.execute({});
    expect(result1).toBe("file contents");
    expect(result2).toBe("file contents");
  });

  it("adds warning at threshold", async () => {
    const wrapped = withReadCapWarning(createMockTools(), 3);
    await wrapped.read_file?.execute({});
    await wrapped.read_file?.execute({});
    const result = await wrapped.read_file?.execute({});
    expect(result).toContain("[Warning:");
    expect(result).toContain("3 files");
    expect(result).toContain("file contents");
  });

  it("increments count past threshold", async () => {
    const wrapped = withReadCapWarning(createMockTools(), 2);
    await wrapped.read_file?.execute({});
    await wrapped.read_file?.execute({});
    await wrapped.read_file?.execute({});
    const result = await wrapped.read_file?.execute({});
    expect(result).toContain("4 files");
  });

  it("resets counter after write", async () => {
    const wrapped = withReadCapWarning(createMockTools(), 2);
    await wrapped.read_file?.execute({});
    await wrapped.read_file?.execute({});
    // At threshold — would warn
    await wrapped.write_file?.execute({});
    // Reset — should not warn
    const result = await wrapped.read_file?.execute({});
    expect(result).toBe("file contents");
  });

  it("does not warn when result is not a string", async () => {
    const tools: ToolMap = {
      read_file: {
        description: "Read",
        parameters: {},
        execute: async () => ({ binary: true }),
      },
      write_file: {
        description: "Write",
        parameters: {},
        execute: async () => "ok",
      },
    };
    const wrapped = withReadCapWarning(tools, 1);
    const result = await wrapped.read_file?.execute({});
    expect(result).toEqual({ binary: true });
  });

  it("uses default threshold of 8", async () => {
    const wrapped = withReadCapWarning(createMockTools());
    for (let i = 0; i < 7; i++) {
      const r = await wrapped.read_file?.execute({});
      expect(r).toBe("file contents");
    }
    const result = await wrapped.read_file?.execute({});
    expect(result).toContain("[Warning:");
    expect(result).toContain("8 files");
  });

  it("passes input through to original execute", async () => {
    let capturedInput: Record<string, unknown> | undefined;
    const tools: ToolMap = {
      read_file: {
        description: "Read",
        parameters: {},
        execute: async (input) => {
          capturedInput = input;
          return "ok";
        },
      },
      write_file: {
        description: "Write",
        parameters: {},
        execute: async () => "ok",
      },
    };
    const wrapped = withReadCapWarning(tools);
    await wrapped.read_file?.execute({ path: "test.ts" });
    expect(capturedInput).toEqual({ path: "test.ts" });
  });
});
