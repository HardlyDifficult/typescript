/**
 * Domain types for repository scanning.
 * These are self-contained — no WebSocket or transport coupling.
 */

/** Information about a repository to scan. */
export interface ScanRepoInfo {
  owner: string;
  name: string;
  cloneUrl: string;
  defaultBranch?: string;
}

/** A single finding from a scan. */
export interface ScanFinding {
  repo: string;
  filePath: string;
  description: string;
  codeSnippet?: string;
  lineNumber?: number;
}

/** Summary of findings for a single repository. */
export interface RepoScanSummary {
  repo: string;
  filesScanned: number;
  findingsCount: number;
  uniqueUseCases: string[];
  findings: ScanFinding[];
}

/** Scan progress phase. */
export type ScanPhase = "cloning" | "scanning" | "analyzing" | "aggregating";

/** Progress update during a scan operation. */
export interface ScanProgressInfo {
  phase: ScanPhase;
  message: string;
  currentRepo?: string;
  currentFile?: string;
  reposCompleted: number;
  totalRepos: number;
  filesScanned: number;
  findingsCount: number;
}

/** Overall summary of use cases across all repos. */
export interface ScanOverallSummary {
  useCases: {
    description: string;
    instanceCount: number;
    repos: string[];
    priorityScore: number;
  }[];
  analysis: string;
}

/** Input for a scan operation. */
export interface ScanInput {
  requestId: string;
  topic: string;
  model: string;
  repositories: ScanRepoInfo[];
  includePatterns?: string[];
  excludePatterns?: string[];
}

/** Final result of a scan operation. */
export interface ScanOutput {
  requestId: string;
  success: boolean;
  error?: string;
  topic: string;
  reposScanned: number;
  filesScanned: number;
  totalFindings: number;
  repoSummaries: RepoScanSummary[];
  overallSummary: ScanOverallSummary;
  durationMs: number;
  errors?: { context: string; message: string; code?: string }[];
}
