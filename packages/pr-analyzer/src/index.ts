/**
 * PR Analyzer
 *
 * Analyzes and classifies GitHub PRs.
 * See workflow.ts for single-PR scanning.
 */

export { scanSinglePR } from "./workflow.js";
export { analyzePR, analyzeAll } from "./analysis.js";
export { classifyPRs } from "./classification.js";
export { getAvailableActions, PR_ACTIONS } from "./actions.js";
export { createPRAnalyzer, DEFAULT_BOT_MENTION } from "./createPRAnalyzer.js";
export type {
  ActionContext,
  CorePRStatus,
  ScannedPR,
  ScanResult,
  CIStatus,
  DiscoveredPR,
  Logger,
  PRAnalyzerClient,
  PullRequestActivitySnapshot,
  AnalysisDetails,
  AnalyzerHooks,
  ClassificationConfig,
  ActionDefinition,
} from "./types.js";
export type { CorePRActionType, PRActionDescriptor } from "./actions.js";
export type {
  ActionablePR,
  PRAnalyzer,
  PRAnalyzerConfig,
  PRInbox,
  PRReference,
} from "./createPRAnalyzer.js";
