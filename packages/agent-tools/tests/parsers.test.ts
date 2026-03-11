import { describe, it, expect } from "vitest";
import {
  parseReadFileOutput,
  parseSearchFilesOutput,
  parseExploreOutput,
  parseWriteFileOutput,
  parseAgentBrowserCommand,
} from "../src/tools/parsers.js";

describe("parseReadFileOutput", () => {
  it("parses whole-file format", () => {
    const output = "[src/index.ts: 42 lines]\nline 1\nline 2";
    expect(parseReadFileOutput(output)).toEqual({
      filename: "src/index.ts",
      lines: 42,
      bytes: output.length,
    });
  });

  it("parses range format", () => {
    const output = "[src/index.ts: lines 10-20 of 100]\nsome content";
    expect(parseReadFileOutput(output)).toEqual({
      filename: "src/index.ts",
      lines: 100,
      bytes: output.length,
    });
  });

  it("parses batched footer format", () => {
    const output = "content\n[3 files read]";
    expect(parseReadFileOutput(output)).toEqual({
      filename: "batch",
      lines: 0,
      bytes: output.length,
      fileCount: 3,
    });
  });

  it("parses batched footer with total", () => {
    const output = "content\n[3 of 5 files read]";
    expect(parseReadFileOutput(output)).toEqual({
      filename: "batch",
      lines: 0,
      bytes: output.length,
      fileCount: 3,
    });
  });

  it("parses single file read in batch footer", () => {
    const output = "content\n[1 file read]";
    expect(parseReadFileOutput(output)).toEqual({
      filename: "batch",
      lines: 0,
      bytes: output.length,
      fileCount: 1,
    });
  });

  it("parses batched header format", () => {
    const output = "--- [1/3] src/a.ts: ...\ncontent";
    expect(parseReadFileOutput(output)).toEqual({
      filename: "batch",
      lines: 0,
      bytes: output.length,
      fileCount: 3,
    });
  });

  it("returns null for unrecognized format", () => {
    expect(parseReadFileOutput("just some text")).toBeNull();
  });
});

describe("parseSearchFilesOutput", () => {
  it("parses content search results", () => {
    expect(
      parseSearchFilesOutput("Found 15 matches in 4 files\nresults...")
    ).toEqual({
      matches: 15,
      files: 4,
      contentSearch: true,
    });
  });

  it("parses glob search results", () => {
    expect(parseSearchFilesOutput("Found 8 files:\nfile1\nfile2")).toEqual({
      matches: 8,
      files: 8,
      contentSearch: false,
    });
  });

  it("returns null for unrecognized format", () => {
    expect(parseSearchFilesOutput("no matches")).toBeNull();
  });
});

describe("parseExploreOutput", () => {
  it("parses bracketed file count", () => {
    expect(parseExploreOutput("[12 files]")).toEqual({ fileCount: 12 });
  });

  it("counts non-empty lines when no bracket format", () => {
    const output = "src/\n  index.ts\n  utils.ts\n\n";
    const result = parseExploreOutput(output);
    expect(result).toEqual({ fileCount: 3 });
  });

  it("skips blank lines and non-alphanumeric lines", () => {
    const output = "\n\nsrc/index.ts\n\n";
    expect(parseExploreOutput(output)).toEqual({ fileCount: 1 });
  });
});

describe("parseWriteFileOutput", () => {
  it("parses multi-edit update format", () => {
    expect(
      parseWriteFileOutput("Updated src/index.ts (3 edits, now 120 lines)")
    ).toEqual({
      filename: "src/index.ts",
      editCount: 3,
      totalLines: 120,
    });
  });

  it("parses single-edit update format", () => {
    expect(
      parseWriteFileOutput("Updated src/index.ts (1 edit, now 50 lines)")
    ).toEqual({
      filename: "src/index.ts",
      editCount: 1,
      totalLines: 50,
    });
  });

  it("parses wrote with lines format", () => {
    expect(parseWriteFileOutput("Wrote src/new.ts (25 lines)")).toEqual({
      filename: "src/new.ts",
      totalLines: 25,
    });
  });

  it("parses wrote with chars format", () => {
    expect(parseWriteFileOutput("Wrote config.json (512 chars)")).toEqual({
      filename: "config.json",
      chars: 512,
    });
  });

  it("parses updated lines range format", () => {
    expect(parseWriteFileOutput("Updated src/index.ts lines 10-20")).toEqual({
      filename: "src/index.ts",
      lines: "10-20",
    });
  });

  it("returns null for unrecognized format", () => {
    expect(parseWriteFileOutput("something else")).toBeNull();
  });
});

describe("parseAgentBrowserCommand", () => {
  it("extracts action and target from command", () => {
    expect(
      parseAgentBrowserCommand({ command: "navigate https://example.com" })
    ).toEqual({
      action: "navigate",
      target: "https://example.com",
    });
  });

  it("returns action only when no target", () => {
    expect(parseAgentBrowserCommand({ command: "screenshot" })).toEqual({
      action: "screenshot",
      target: undefined,
    });
  });

  it("returns empty action when command is missing", () => {
    expect(parseAgentBrowserCommand({})).toEqual({
      action: "",
      target: undefined,
    });
  });

  it("returns empty action when command is not a string", () => {
    expect(parseAgentBrowserCommand({ command: 123 })).toEqual({
      action: "",
      target: undefined,
    });
  });

  it("returns empty action for empty command string", () => {
    expect(parseAgentBrowserCommand({ command: "" })).toEqual({
      action: "",
      target: undefined,
    });
  });
});
