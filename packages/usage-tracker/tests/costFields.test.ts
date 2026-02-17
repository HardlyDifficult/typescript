import { describe, it, expect } from "vitest";
import { findCostFieldPaths, extractCostFromDelta } from "../src/costFields.js";

describe("findCostFieldPaths", () => {
  it("finds top-level CostUsd fields", () => {
    const paths = findCostFieldPaths({ estimatedCostUsd: 0, requests: 0 });
    expect(paths).toEqual(["estimatedCostUsd"]);
  });

  it("finds nested CostUsd fields", () => {
    const paths = findCostFieldPaths({
      anthropic: { estimatedCostUsd: 0, tokens: 0 },
      claudeCode: { totalCostUsd: 0, sessions: 0 },
    });
    expect(paths).toEqual([
      "anthropic.estimatedCostUsd",
      "claudeCode.totalCostUsd",
    ]);
  });

  it("finds deeply nested CostUsd fields", () => {
    const paths = findCostFieldPaths({
      providers: {
        anthropic: { estimatedCostUsd: 0 },
        openai: { estimatedCostUsd: 0 },
      },
    });
    expect(paths).toEqual([
      "providers.anthropic.estimatedCostUsd",
      "providers.openai.estimatedCostUsd",
    ]);
  });

  it("returns empty array when no CostUsd fields exist", () => {
    const paths = findCostFieldPaths({ requests: 0, tokens: 0 });
    expect(paths).toEqual([]);
  });

  it("matches standalone costUsd field", () => {
    const paths = findCostFieldPaths({
      costUsd: 0,
      requests: 0,
    });
    expect(paths).toEqual(["costUsd"]);
  });

  it("ignores fields where costUsd is not the suffix", () => {
    const paths = findCostFieldPaths({
      costUsdTotal: 0,
      estimatedCostUsd: 0,
    });
    expect(paths).toEqual(["estimatedCostUsd"]);
  });
});

describe("extractCostFromDelta", () => {
  const paths = [
    "anthropic.estimatedCostUsd",
    "openai.estimatedCostUsd",
    "claudeCode.totalCostUsd",
  ];

  it("extracts cost from a full delta", () => {
    const cost = extractCostFromDelta(
      {
        anthropic: { estimatedCostUsd: 0.05 },
        openai: { estimatedCostUsd: 0.01 },
        claudeCode: { totalCostUsd: 1.5 },
      },
      paths
    );
    expect(cost).toBeCloseTo(1.56);
  });

  it("extracts cost from a partial delta", () => {
    const cost = extractCostFromDelta(
      { anthropic: { estimatedCostUsd: 0.03 } },
      paths
    );
    expect(cost).toBeCloseTo(0.03);
  });

  it("returns 0 for delta with no cost fields", () => {
    const cost = extractCostFromDelta(
      { anthropic: { requests: 1, tokens: 500 } },
      paths
    );
    expect(cost).toBe(0);
  });

  it("returns 0 for empty delta", () => {
    const cost = extractCostFromDelta({}, paths);
    expect(cost).toBe(0);
  });

  it("handles missing intermediate keys gracefully", () => {
    const cost = extractCostFromDelta(
      { nonexistent: { estimatedCostUsd: 0.05 } },
      paths
    );
    expect(cost).toBe(0);
  });
});
