/**
 * Aggregation helpers for scan results.
 * Extracted from ScanService to keep the main service file focused on
 * orchestration (cloning, walking files, calling AI for per-file analysis).
 */

import type {
  ExtractTypedFn,
  ScanAI,
  ScanTemplates,
  TemplateFiller,
} from "./service.js";
import type {
  RepoScanSummary,
  ScanFinding,
  ScanOverallSummary,
} from "./types.js";

/** Dependencies needed by the aggregation helpers. */
export interface AggregationDeps {
  ai: ScanAI;
  templates: ScanTemplates;
  fillTemplate: TemplateFiller;
  extractTyped: ExtractTypedFn;
}

/**
 * Build a per-repo summary by asking the AI to distil unique use-cases
 * from the raw findings list. Falls back to a simple slice when the AI
 * call fails.
 */
export async function createRepoSummary(
  deps: AggregationDeps,
  topic: string,
  repoName: string,
  findings: ScanFinding[],
  filesScanned: number
): Promise<RepoScanSummary> {
  if (findings.length === 0) {
    return {
      repo: repoName,
      filesScanned,
      findingsCount: 0,
      uniqueUseCases: [],
      findings: [],
    };
  }

  const findingsText = findings
    .map((f, i) => `${String(i + 1)}. ${f.filePath}: ${f.description}`)
    .join("\n");
  const prompt = deps.fillTemplate(deps.templates.repoSummary, {
    topic,
    repoName,
    findings: findingsText,
  });

  try {
    const response = await deps.ai.chat(prompt).text();
    const schema = {
      parse: (v: unknown) => v as { uniqueUseCases: string[] },
    };
    const results = deps.extractTyped(response, schema);
    return {
      repo: repoName,
      filesScanned,
      findingsCount: findings.length,
      uniqueUseCases:
        results[0]?.uniqueUseCases ??
        findings.slice(0, 5).map((f) => f.description),
      findings,
    };
  } catch {
    return {
      repo: repoName,
      filesScanned,
      findingsCount: findings.length,
      uniqueUseCases: findings.slice(0, 5).map((f) => f.description),
      findings,
    };
  }
}

/**
 * Build the cross-repo overall summary by asking the AI to identify
 * high-level use-case categories. Falls back to {@link createFallbackSummary}
 * when the AI call fails or returns nothing.
 */
export async function createOverallSummary(
  deps: AggregationDeps,
  topic: string,
  repoSummaries: RepoScanSummary[]
): Promise<ScanOverallSummary> {
  const reposWithFindings = repoSummaries.filter((s) => s.findingsCount > 0);

  if (reposWithFindings.length === 0) {
    return {
      useCases: [],
      analysis: `No instances of "${topic}" were found in the scanned repositories.`,
    };
  }

  const summaryText = reposWithFindings
    .map((s) => {
      const useCases = s.uniqueUseCases
        .map((uc: string) => `  - ${uc}`)
        .join("\n");
      return `Repository: ${s.repo} (${String(s.findingsCount)} instances)\n${useCases}`;
    })
    .join("\n\n");
  const prompt = deps.fillTemplate(deps.templates.overallSummary, {
    topic,
    repoSummaries: summaryText,
  });

  try {
    const response = await deps.ai.chat(prompt).text();
    const schema = {
      parse: (v: unknown) =>
        v as {
          useCases?: {
            description: string;
            instanceCount: number;
            repos: string[];
            priorityScore: number;
          }[];
          analysis?: string;
        },
    };
    const results = deps.extractTyped(response, schema);
    if (results.length === 0) {
      return createFallbackSummary(topic, repoSummaries);
    }

    const parsed = results[0];
    return {
      useCases: parsed.useCases ?? [],
      analysis:
        parsed.analysis ??
        `Found ${String(reposWithFindings.length)} repositories with "${topic}" usage.`,
    };
  } catch {
    return createFallbackSummary(topic, repoSummaries);
  }
}

/**
 * Pure-data fallback that produces a summary without calling the AI,
 * used when the AI-based overall summary fails.
 */
export function createFallbackSummary(
  topic: string,
  repoSummaries: RepoScanSummary[]
): ScanOverallSummary {
  const allUseCases = new Map<string, { count: number; repos: Set<string> }>();

  for (const summary of repoSummaries) {
    for (const useCase of summary.uniqueUseCases) {
      const existing = allUseCases.get(useCase) ?? {
        count: 0,
        repos: new Set(),
      };
      existing.count += 1;
      existing.repos.add(summary.repo);
      allUseCases.set(useCase, existing);
    }
  }

  const useCases = Array.from(allUseCases.entries())
    .map(([desc, data]) => ({
      description: desc,
      instanceCount: data.count,
      repos: Array.from(data.repos),
      priorityScore: data.count * 10 + data.repos.size * 5,
    }))
    .sort((a, b) => b.priorityScore - a.priorityScore);

  return {
    useCases,
    analysis: `Found ${String(repoSummaries.filter((s) => s.findingsCount > 0).length)} repositories with "${topic}" usage. ${String(useCases.length)} unique use cases identified.`,
  };
}
