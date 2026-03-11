import { describe, it, expect } from "vitest";
import { createFallbackSummary } from "../src/scan/aggregation.js";
import type { RepoScanSummary } from "../src/scan/types.js";

describe("createFallbackSummary", () => {
  it("returns empty use cases when no repos have findings", () => {
    const result = createFallbackSummary("webhooks", []);
    expect(result.useCases).toEqual([]);
    expect(result.analysis).toContain("0 repositories");
    expect(result.analysis).toContain("0 unique use cases");
  });

  it("aggregates use cases across repos", () => {
    const summaries: RepoScanSummary[] = [
      {
        repo: "repo-a",
        filesScanned: 10,
        findingsCount: 2,
        uniqueUseCases: ["API integration", "Event handling"],
        findings: [],
      },
      {
        repo: "repo-b",
        filesScanned: 5,
        findingsCount: 1,
        uniqueUseCases: ["API integration"],
        findings: [],
      },
    ];

    const result = createFallbackSummary("webhooks", summaries);
    expect(result.useCases.length).toBe(2);

    // "API integration" appears in both repos, should have higher priority
    const apiUseCase = result.useCases.find(
      (uc) => uc.description === "API integration"
    );
    expect(apiUseCase).toBeDefined();
    expect(apiUseCase!.instanceCount).toBe(2);
    expect(apiUseCase!.repos).toEqual(["repo-a", "repo-b"]);

    // Should be sorted by priority score (descending)
    expect(result.useCases[0].description).toBe("API integration");
  });

  it("calculates priority score correctly", () => {
    const summaries: RepoScanSummary[] = [
      {
        repo: "repo-a",
        filesScanned: 5,
        findingsCount: 1,
        uniqueUseCases: ["common"],
        findings: [],
      },
      {
        repo: "repo-b",
        filesScanned: 5,
        findingsCount: 1,
        uniqueUseCases: ["common"],
        findings: [],
      },
    ];

    const result = createFallbackSummary("topic", summaries);
    const uc = result.useCases[0];
    // count=2, repos=2 => priorityScore = 2*10 + 2*5 = 30
    expect(uc.priorityScore).toBe(30);
  });

  it("counts repos with findings in analysis text", () => {
    const summaries: RepoScanSummary[] = [
      {
        repo: "repo-a",
        filesScanned: 10,
        findingsCount: 3,
        uniqueUseCases: ["use-case-1"],
        findings: [],
      },
      {
        repo: "repo-b",
        filesScanned: 8,
        findingsCount: 0,
        uniqueUseCases: [],
        findings: [],
      },
    ];

    const result = createFallbackSummary("caching", summaries);
    expect(result.analysis).toContain('1 repositories with "caching" usage');
    expect(result.analysis).toContain("1 unique use cases");
  });

  it("deduplicates same use case within same repo", () => {
    const summaries: RepoScanSummary[] = [
      {
        repo: "repo-a",
        filesScanned: 10,
        findingsCount: 2,
        uniqueUseCases: ["logging", "logging"],
        findings: [],
      },
    ];

    const result = createFallbackSummary("topic", summaries);
    const loggingUseCase = result.useCases.find(
      (uc) => uc.description === "logging"
    );
    expect(loggingUseCase!.instanceCount).toBe(2);
    // Same repo mentioned twice but Set ensures unique
    expect(loggingUseCase!.repos).toEqual(["repo-a"]);
  });
});
