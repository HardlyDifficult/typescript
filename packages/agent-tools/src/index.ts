// Config constants
export {
  MAX_CONTEXT_LINES,
  MAX_GREP_FILE_SIZE,
  MAX_READ_BYTES,
  MAX_SEARCH_RESULTS,
  VERIFY_TIMEOUT,
} from "./config.js";

// MCP tool loader
export {
  registerMcpTools,
  type McpServerLike,
  type McpTool,
  type McpToolLoaderLogger,
} from "./mcpToolLoader.js";

// File reference parsing
export {
  parseFileReference,
  type FileReference,
} from "./parseFileReference.js";

// Path parsing adapter (used by tools)
export { parsePath } from "./parsePath.js";

// Repo manager
export { RepoManager, type RepoConfig, type RepositoryInfo } from "./repo";

// Agent runner
export { runAgent } from "./runAgent.js";

// Scan service
export {
  ScanService,
  type ExtractTypedFn,
  type ProgressCallback,
  type ScanAI,
  type ScanRepoManager,
  type ScanServiceConfig,
  type ScanTemplates,
  type TemplateFiller,
} from "./scan";
export type {
  RepoScanSummary,
  ScanFinding,
  ScanInput,
  ScanOutput,
  ScanOverallSummary,
  ScanPhase,
  ScanProgressInfo,
  ScanRepoInfo,
} from "./scan";

// Agent server
export { shutdownAgentServer } from "./server.js";

// Skill loader
export { loadAllSkills, loadSkillsFromCategory, type Skill } from "./skills.js";

// Summarize service
export {
  SummarizeService,
  type LineNumberFormatter,
  type SummarizeAI,
  type SummarizeServiceConfig,
  type SummarizeTemplates,
  type YamlHealer,
} from "./summarize";

// AI coding tools
export {
  createCommitTools,
  type CommitToolOptions,
  createGeneralTools,
  createGitTools,
  type GitToolOptions,
  createReadTools,
  createSearchTools,
  createWriteTools,
  runVerification,
  type AnnotationProvider,
  type FileSystem,
  formatBytes,
  extractFilename,
  getToolSummary,
  parseAgentBrowserCommand,
  parseExploreOutput,
  parseReadFileOutput,
  parseSearchFilesOutput,
  parseWriteFileOutput,
} from "./tools";

// Agent runner types
export type { AgentEvent, RunAgentOptions, RunAgentResult } from "./types.js";

// Utilities
export {
  executeWithErrorHandling,
  formatArrayResult,
  toArray,
} from "./utils.js";
