import { describe, expect, it } from "vitest";

import { parsePipelineStatus } from "../src/parsePipelineStatus.js";

describe("parsePipelineStatus", () => {
  it("parses terminal statuses", () => {
    expect(parsePipelineStatus("completed")).toEqual({ phase: "completed" });
  });

  it("parses active statuses", () => {
    expect(parsePipelineStatus("running:create_plan")).toEqual({
      phase: "running",
      step: "create_plan",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parsePipelineStatus("  gate:approve  ")).toEqual({
      phase: "gate",
      step: "approve",
    });
  });

  it("omits empty step values", () => {
    expect(parsePipelineStatus("running:")).toEqual({ phase: "running" });
  });
});
