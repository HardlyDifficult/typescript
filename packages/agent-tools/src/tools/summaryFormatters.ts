/**
 * Tool summary formatters for activity log display.
 * Generates informative summaries with key parameters and result metadata.
 */

import path from "node:path";

import {
  parseAgentBrowserCommand,
  parseExploreOutput,
  parseReadFileOutput,
  parseSearchFilesOutput,
  parseWriteFileOutput,
} from "./parsers.js";

// Re-export parsers for backwards compatibility
export {
  parseAgentBrowserCommand,
  parseExploreOutput,
  parseReadFileOutput,
  parseSearchFilesOutput,
  parseWriteFileOutput,
} from "./parsers.js";

/**
 * Format byte count as human-readable size.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Extract filename from path for cleaner display.
 */
export function extractFilename(filePath: string): string {
  return path.basename(filePath);
}

/**
 * Tool summary formatter function signature.
 */
type ToolSummaryFormatter = (
  toolName: string,
  input: Record<string, unknown>,
  output: string,
  phase: "starting" | "success" | "error",
  errorMessage?: string
) => string;

function formatReadFileSummary(
  _toolName: string,
  input: Record<string, unknown>,
  output: string,
  phase: "starting" | "success" | "error",
  errorMessage?: string
): string {
  const pathInput = input.path;
  const isBatch = Array.isArray(pathInput);
  const displayName = isBatch
    ? `${String((pathInput as string[]).length)} files`
    : extractFilename(typeof pathInput === "string" ? pathInput : "unknown");

  if (phase === "error") {
    return `Tool: read_file(${displayName}) - ${errorMessage ?? "error"}`;
  }
  if (phase === "starting") {
    return `Tool: read_file(${displayName})`;
  }

  const parsed = parseReadFileOutput(output);
  if (parsed) {
    if (parsed.fileCount !== undefined && parsed.fileCount !== 0) {
      return `Tool: read_file - ${String(parsed.fileCount)} files read (${formatBytes(parsed.bytes)})`;
    }
    const size = formatBytes(parsed.bytes);
    return `Tool: read_file(${parsed.filename}) - ${size} (${String(parsed.lines)} lines)`;
  }

  return `Tool: read_file(${displayName})`;
}

function formatExploreSummary(
  _toolName: string,
  input: Record<string, unknown>,
  output: string,
  phase: "starting" | "success" | "error",
  errorMessage?: string
): string {
  const pathInput = input.path;
  const isBatch = Array.isArray(pathInput);
  let dirPath: string;
  if (isBatch) {
    dirPath = `${String((pathInput as string[]).length)} dirs`;
  } else {
    dirPath = typeof pathInput === "string" ? pathInput : ".";
  }

  if (phase === "error") {
    return `Tool: explore(${dirPath}) - ${errorMessage ?? "error"}`;
  }
  if (phase === "starting") {
    return `Tool: explore(${dirPath})`;
  }

  if (output.includes("empty or does not exist")) {
    return `Tool: explore(${dirPath}) - empty`;
  }

  const parsed = parseExploreOutput(output);
  if (parsed && parsed.fileCount > 0) {
    return `Tool: explore(${dirPath}) - ${String(parsed.fileCount)} files`;
  }

  return `Tool: explore(${dirPath})`;
}

function formatSearchFilesSummary(
  _toolName: string,
  input: Record<string, unknown>,
  output: string,
  phase: "starting" | "success" | "error",
  errorMessage?: string
): string {
  if (phase === "error") {
    return `Tool: search_files - ${errorMessage ?? "error"}`;
  }

  if (phase === "starting") {
    const parts: string[] = [];
    if (typeof input.glob === "string") {
      parts.push(`glob=${input.glob}`);
    }
    if (typeof input.regex === "string") {
      parts.push(`regex=${input.regex}`);
    }
    if (typeof input.name === "string") {
      parts.push(`name=${input.name}`);
    }
    return `Tool: search_files(${parts.join(", ")})`;
  }

  const parsed = parseSearchFilesOutput(output);
  if (parsed) {
    if (parsed.contentSearch) {
      return `Tool: search_files - ${String(parsed.matches)} matches in ${String(parsed.files)} files`;
    }
    return `Tool: search_files - ${String(parsed.files)} files`;
  }

  if (
    output.includes("No matches found") ||
    output.includes("No files found")
  ) {
    return `Tool: search_files - no matches`;
  }

  return `Tool: search_files`;
}

function formatWriteFileSummary(
  _toolName: string,
  input: Record<string, unknown>,
  output: string,
  phase: "starting" | "success" | "error",
  errorMessage?: string
): string {
  const displayName = extractFilename(
    typeof input.path === "string" ? input.path : "unknown"
  );
  const editsInput = input.edits;
  let editCount: number | undefined;
  if (Array.isArray(editsInput)) {
    editCount = editsInput.length;
  } else if (editsInput !== undefined) {
    editCount = 1;
  }

  if (phase === "error") {
    return `Tool: write_file(${displayName}) - ${errorMessage ?? "error"}`;
  }
  if (phase === "starting") {
    if (editCount !== undefined) {
      return `Tool: write_file(${displayName}) - ${String(editCount)} op${editCount !== 1 ? "s" : ""}`;
    }
    return `Tool: write_file(${displayName})`;
  }

  const parsed = parseWriteFileOutput(output);
  if (parsed) {
    if (parsed.editCount !== undefined && parsed.editCount !== 0) {
      return `Tool: write_file(${parsed.filename}) - ${String(parsed.editCount)} edits, ${String(parsed.totalLines)} lines`;
    }
    if (parsed.totalLines !== undefined) {
      return `Tool: write_file(${parsed.filename}) - ${String(parsed.totalLines)} lines`;
    }
    if (parsed.chars !== undefined) {
      return `Tool: write_file(${parsed.filename}) - ${formatBytes(parsed.chars)}`;
    }
    if (parsed.lines !== undefined) {
      return `Tool: write_file(${parsed.filename}) - lines ${parsed.lines}`;
    }
  }

  return `Tool: write_file(${displayName})`;
}

function formatAgentBrowserSummary(
  _toolName: string,
  input: Record<string, unknown>,
  output: string,
  phase: "starting" | "success" | "error",
  errorMessage?: string
): string {
  if (phase === "error") {
    return `Tool: agent-browser - ${errorMessage ?? "error"}`;
  }
  const parsed = parseAgentBrowserCommand(input);
  if (phase === "starting") {
    return parsed.target !== undefined && parsed.target !== ""
      ? `Tool: agent-browser ${parsed.action} ${parsed.target}`
      : `Tool: agent-browser ${parsed.action}`;
  }
  const outputPreview = output.slice(0, 50).replace(/\n/g, " ").trim();
  const truncated = output.length > 50 ? "..." : "";
  return `Tool: agent-browser ${parsed.action} - ${outputPreview}${truncated}`;
}

function formatDiffSummary(
  _toolName: string,
  input: Record<string, unknown>,
  output: string,
  phase: "starting" | "success" | "error",
  errorMessage?: string
): string {
  const against = typeof input.against === "string" ? input.against : "main";
  const diffPath = typeof input.path === "string" ? ` ${input.path}` : "";

  if (phase === "error") {
    return `Tool: diff(${against}${diffPath}) - ${errorMessage ?? "error"}`;
  }
  if (phase === "starting") {
    return `Tool: diff(${against}${diffPath})`;
  }
  if (output.includes("No differences found")) {
    return `Tool: diff(${against}${diffPath}) - no changes`;
  }

  const statMatch = /(\d+) files? changed/.exec(output);
  if (statMatch) {
    return `Tool: diff(${against}${diffPath}) - ${statMatch[0]}`;
  }

  return `Tool: diff(${against}${diffPath})`;
}

function formatRevertSummary(
  _toolName: string,
  input: Record<string, unknown>,
  _output: string,
  phase: "starting" | "success" | "error",
  errorMessage?: string
): string {
  const to = typeof input.to === "string" ? input.to : "last_commit";
  const revertPath = typeof input.path === "string" ? input.path : "repo";

  if (phase === "error") {
    return `Tool: revert(${revertPath} → ${to}) - ${errorMessage ?? "error"}`;
  }
  return `Tool: revert(${revertPath} → ${to})`;
}

function formatCommitSummary(
  _toolName: string,
  input: Record<string, unknown>,
  output: string,
  phase: "starting" | "success" | "error",
  errorMessage?: string
): string {
  const title = (typeof input.title === "string" ? input.title : "").slice(
    0,
    50
  );

  if (phase === "error") {
    return `Tool: commit - ${errorMessage ?? "error"}`;
  }
  if (phase === "starting") {
    return `Tool: commit("${title}")`;
  }

  if (output.includes("Commit aborted")) {
    return `Tool: commit("${title}") - verification failed`;
  }
  if (output.includes("No changes to commit")) {
    return `Tool: commit - no changes`;
  }

  const lastLine = output.split("\n").at(-1) as string;
  const filesMatch = /^(\d+) files?:/.exec(lastLine);
  if (filesMatch) {
    return `Tool: commit("${title}") - ${filesMatch[1]} files`;
  }

  return `Tool: commit("${title}")`;
}

/**
 * Tool formatter registry mapping tool names to their formatters.
 */
const TOOL_FORMATTERS: Record<string, ToolSummaryFormatter> = {
  read_file: formatReadFileSummary,
  explore: formatExploreSummary,
  list_directory: formatExploreSummary,
  search_files: formatSearchFilesSummary,
  write_file: formatWriteFileSummary,
  diff: formatDiffSummary,
  revert: formatRevertSummary,
  commit: formatCommitSummary,
  "agent-browser": formatAgentBrowserSummary,
};

/**
 * Get formatted summary for a tool call.
 */
export function getToolSummary(
  toolName: string,
  input: Record<string, unknown>,
  output: string,
  phase: "starting" | "success" | "error",
  errorMessage?: string
): string {
  const formatter: ToolSummaryFormatter | undefined = TOOL_FORMATTERS[
    toolName
  ] as ToolSummaryFormatter | undefined;
  if (formatter !== undefined) {
    return formatter(toolName, input, output, phase, errorMessage);
  }

  if (phase === "error") {
    return `Tool: ${toolName} (failed)`;
  }
  return `Tool: ${toolName}`;
}
