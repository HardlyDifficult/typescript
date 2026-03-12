import { describe, it, expect, vi } from "vitest";
import {
  createRepoSummary,
  createOverallSummary,
} from "../src/scan/aggregation.js";
import type { AggregationDeps } from "../src/scan/aggregation.js";
import type { RepoScanSummary, ScanFinding } from "../src/scan/types.js";

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * A real extractTyped implementation that parses JSON from text and calls
 * schema.parse on each result. This exercises the inline schema lambdas in
 * aggregation.ts so V8 counts those lines as covered.
 */
function realExtractTyped<T>(
  text: string,
  schema: { parse(v: unknown): T }
): T[] {
  try {
    const parsed: unknown = JSON.parse(text);
    return [schema.parse(parsed)];
  } catch {
    return [];
  }
}

function makeDeps(overrides: Partial<AggregationDeps> = {}): AggregationDeps {
  return {
    ai: {
      chat: vi.fn().mockReturnValue({
        text: vi.fn().mockResolvedValue("{}"),
      }),
    },
    templates: {
      fileAnalysis: "analyze: {{topic}} {{filePath}} {{fileContent}}",
      repoSummary: "repo: {{topic}} {{repoName}} {{findings}}",
      overallSummary: "overall: {{topic}} {{repoSummaries}}",
    },
    fillTemplate: vi.fn((template: string, vars: Record<string, string>) => {
      let result = template;
      for (const [key, value] of Object.entries(vars)) {
        result = result.replace(`{{${key}}}`, value);
      }
      return result;
    }),
    extractTyped: vi.fn(),
    ...overrides,
  };
}

const sampleFinding: ScanFinding = {
  repo: "owner/repo",
  filePath: "src/index.ts",
  description: "Uses webhooks for event processing",
};

// ── schema.parse coverage ─────────────────────────────────────────────────────

describe("createRepoSummary with real extractTyped (exercises schema.parse)", () => {
  it("uses real extractTyped to invoke schema.parse lambda in createRepoSummary", async () => {
    const aiResponse = JSON.stringify({ uniqueUseCases: ["Use case from AI"] });
    const deps = makeDeps({
      ai: {
        chat: vi.fn().mockReturnValue({
          text: vi.fn().mockResolvedValue(aiResponse),
        }),
      },
      extractTyped: realExtractTyped as AggregationDeps["extractTyped"],
    });

    const findings = [sampleFinding];
    const result = await createRepoSummary(
      deps,
      "webhooks",
      "owner/repo",
      findings,
      5
    );

    expect(result.uniqueUseCases).toEqual(["Use case from AI"]);
  });

  it("uses real extractTyped to invoke schema.parse lambda in createOverallSummary", async () => {
    const aiResponse = JSON.stringify({
      useCases: [
        {
          description: "Event-driven",
          instanceCount: 2,
          repos: ["owner/repo"],
          priorityScore: 50,
        },
      ],
      analysis: "Summary analysis",
    });
    const deps = makeDeps({
      ai: {
        chat: vi.fn().mockReturnValue({
          text: vi.fn().mockResolvedValue(aiResponse),
        }),
      },
      extractTyped: realExtractTyped as AggregationDeps["extractTyped"],
    });

    const repoSummaries: RepoScanSummary[] = [
      {
        repo: "owner/repo",
        filesScanned: 10,
        findingsCount: 2,
        uniqueUseCases: ["Event-driven"],
        findings: [],
      },
    ];

    const result = await createOverallSummary(deps, "webhooks", repoSummaries);

    expect(result.useCases).toHaveLength(1);
    expect(result.useCases[0].description).toBe("Event-driven");
    expect(result.analysis).toBe("Summary analysis");
  });

  it("uses real extractTyped: createOverallSummary falls back to empty useCases when AI omits useCases", async () => {
    // AI returns result with analysis but NO useCases field → triggers the ?? [] branch
    const aiResponse = JSON.stringify({
      analysis: "Analysis without use cases",
    });
    const deps = makeDeps({
      ai: {
        chat: vi.fn().mockReturnValue({
          text: vi.fn().mockResolvedValue(aiResponse),
        }),
      },
      extractTyped: realExtractTyped as AggregationDeps["extractTyped"],
    });

    const repoSummaries: RepoScanSummary[] = [
      {
        repo: "owner/repo",
        filesScanned: 10,
        findingsCount: 2,
        uniqueUseCases: ["Some use case"],
        findings: [],
      },
    ];

    const result = await createOverallSummary(deps, "webhooks", repoSummaries);

    // useCases should fall back to [] since parsed.useCases is undefined
    expect(result.useCases).toEqual([]);
    expect(result.analysis).toBe("Analysis without use cases");
  });
});

// ── createRepoSummary ─────────────────────────────────────────────────────────

describe("createRepoSummary", () => {
  it("returns empty summary when there are no findings", async () => {
    const deps = makeDeps();
    const result = await createRepoSummary(
      deps,
      "webhooks",
      "owner/repo",
      [],
      10
    );
    expect(result).toEqual({
      repo: "owner/repo",
      filesScanned: 10,
      findingsCount: 0,
      uniqueUseCases: [],
      findings: [],
    });
    // AI should NOT be called when there are no findings
    expect(deps.ai.chat).not.toHaveBeenCalled();
  });

  it("returns summary with AI-extracted use cases on success", async () => {
    const uniqueUseCases = ["Event-driven updates", "Async processing"];
    const deps = makeDeps({
      extractTyped: vi.fn().mockReturnValue([{ uniqueUseCases }]),
    });

    const findings = [sampleFinding];
    const result = await createRepoSummary(
      deps,
      "webhooks",
      "owner/repo",
      findings,
      5
    );

    expect(result.repo).toBe("owner/repo");
    expect(result.filesScanned).toBe(5);
    expect(result.findingsCount).toBe(1);
    expect(result.uniqueUseCases).toEqual(uniqueUseCases);
    expect(result.findings).toBe(findings);
  });

  it("falls back to first 5 findings descriptions when AI returns empty uniqueUseCases", async () => {
    const deps = makeDeps({
      // extractTyped returns a result but no uniqueUseCases
      extractTyped: vi.fn().mockReturnValue([{}]),
    });

    const findings: ScanFinding[] = Array.from({ length: 7 }, (_, i) => ({
      ...sampleFinding,
      description: `Finding ${String(i + 1)}`,
    }));

    const result = await createRepoSummary(
      deps,
      "webhooks",
      "owner/repo",
      findings,
      20
    );

    // Should fall back to first 5 descriptions
    expect(result.uniqueUseCases).toHaveLength(5);
    expect(result.uniqueUseCases[0]).toBe("Finding 1");
    expect(result.uniqueUseCases[4]).toBe("Finding 5");
  });

  it("falls back gracefully when AI call throws", async () => {
    const deps = makeDeps({
      ai: {
        chat: vi.fn().mockReturnValue({
          text: vi.fn().mockRejectedValue(new Error("Network error")),
        }),
      },
    });

    const findings = [
      sampleFinding,
      { ...sampleFinding, description: "Other finding" },
    ];
    const result = await createRepoSummary(
      deps,
      "webhooks",
      "owner/repo",
      findings,
      5
    );

    expect(result.uniqueUseCases).toEqual(
      findings.slice(0, 5).map((f) => f.description)
    );
    expect(result.findingsCount).toBe(2);
    expect(result.findings).toBe(findings);
  });

  it("constructs prompt with fillTemplate", async () => {
    const deps = makeDeps({
      extractTyped: vi.fn().mockReturnValue([{ uniqueUseCases: ["Use case"] }]),
    });

    await createRepoSummary(deps, "webhooks", "owner/repo", [sampleFinding], 3);

    expect(deps.fillTemplate).toHaveBeenCalledWith(
      deps.templates.repoSummary,
      expect.objectContaining({
        topic: "webhooks",
        repoName: "owner/repo",
      })
    );
  });
});

// ── createOverallSummary ─────────────────────────────────────────────────────

describe("createOverallSummary", () => {
  it("returns no-findings summary when all repos have 0 findings", async () => {
    const deps = makeDeps();
    const repoSummaries: RepoScanSummary[] = [
      {
        repo: "owner/repo-a",
        filesScanned: 5,
        findingsCount: 0,
        uniqueUseCases: [],
        findings: [],
      },
    ];

    const result = await createOverallSummary(deps, "webhooks", repoSummaries);

    expect(result.useCases).toEqual([]);
    expect(result.analysis).toContain('"webhooks"');
    // AI should NOT be called when there are no repos with findings
    expect(deps.ai.chat).not.toHaveBeenCalled();
  });

  it("returns AI-generated summary when repos have findings", async () => {
    const aiUseCases = [
      {
        description: "Event processing",
        instanceCount: 3,
        repos: ["owner/repo-a"],
        priorityScore: 90,
      },
    ];
    const deps = makeDeps({
      extractTyped: vi.fn().mockReturnValue([
        {
          useCases: aiUseCases,
          analysis: "AI analysis here",
        },
      ]),
    });

    const repoSummaries: RepoScanSummary[] = [
      {
        repo: "owner/repo-a",
        filesScanned: 10,
        findingsCount: 3,
        uniqueUseCases: ["Event processing"],
        findings: [],
      },
    ];

    const result = await createOverallSummary(deps, "webhooks", repoSummaries);

    expect(result.useCases).toEqual(aiUseCases);
    expect(result.analysis).toBe("AI analysis here");
  });

  it("uses default analysis text when AI returns result but no analysis field", async () => {
    const deps = makeDeps({
      extractTyped: vi.fn().mockReturnValue([
        {
          useCases: [],
        },
      ]),
    });

    const repoSummaries: RepoScanSummary[] = [
      {
        repo: "owner/repo-a",
        filesScanned: 10,
        findingsCount: 2,
        uniqueUseCases: ["Use case"],
        findings: [],
      },
    ];

    const result = await createOverallSummary(deps, "webhooks", repoSummaries);

    expect(result.useCases).toEqual([]);
    expect(result.analysis).toContain('"webhooks"');
    expect(result.analysis).toContain("1 repositories");
  });

  it("falls back to createFallbackSummary when extractTyped returns empty array", async () => {
    const deps = makeDeps({
      extractTyped: vi.fn().mockReturnValue([]),
    });

    const repoSummaries: RepoScanSummary[] = [
      {
        repo: "owner/repo-a",
        filesScanned: 10,
        findingsCount: 2,
        uniqueUseCases: ["Event handling"],
        findings: [],
      },
    ];

    const result = await createOverallSummary(deps, "webhooks", repoSummaries);

    // createFallbackSummary should produce a result with the use cases
    expect(result.useCases).toHaveLength(1);
    expect(result.useCases[0].description).toBe("Event handling");
  });

  it("falls back to createFallbackSummary when AI call throws", async () => {
    const deps = makeDeps({
      ai: {
        chat: vi.fn().mockReturnValue({
          text: vi.fn().mockRejectedValue(new Error("AI unavailable")),
        }),
      },
    });

    const repoSummaries: RepoScanSummary[] = [
      {
        repo: "owner/repo-a",
        filesScanned: 10,
        findingsCount: 2,
        uniqueUseCases: ["Async processing"],
        findings: [],
      },
    ];

    const result = await createOverallSummary(deps, "webhooks", repoSummaries);

    expect(result.useCases).toHaveLength(1);
    expect(result.useCases[0].description).toBe("Async processing");
  });

  it("constructs prompt with fillTemplate including repo summaries text", async () => {
    const deps = makeDeps({
      extractTyped: vi.fn().mockReturnValue([{ useCases: [], analysis: "ok" }]),
    });

    const repoSummaries: RepoScanSummary[] = [
      {
        repo: "owner/repo-a",
        filesScanned: 10,
        findingsCount: 2,
        uniqueUseCases: ["Use case A"],
        findings: [],
      },
    ];

    await createOverallSummary(deps, "webhooks", repoSummaries);

    expect(deps.fillTemplate).toHaveBeenCalledWith(
      deps.templates.overallSummary,
      expect.objectContaining({
        topic: "webhooks",
        repoSummaries: expect.stringContaining("owner/repo-a"),
      })
    );
  });
});
