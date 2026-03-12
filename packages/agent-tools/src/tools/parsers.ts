/**
 * Output parsers for tool summary formatters.
 * Extract structured metadata from tool output strings.
 */

/**
 * Parse read_file output to extract metadata.
 * Handles both single-file and batched output formats.
 * Single: "[path: N lines]" or "[path: lines X-Y of Z]"
 * Batched: "[N files read]" footer
 */
export function parseReadFileOutput(output: string): {
  filename: string;
  lines: number;
  bytes: number;
  fileCount?: number;
} | null {
  // Check for batched footer
  const batchMatch = /\[(\d+)(?: of \d+)? files? read/.exec(output);
  if (batchMatch) {
    return {
      filename: "batch",
      lines: 0,
      bytes: output.length,
      fileCount: parseInt(batchMatch[1], 10),
    };
  }

  const firstLine = output.split("\n")[0];

  // Match "[path: N lines]" or "[path: lines X-Y of Z]"
  const wholeFileMatch = /^\[(.+?):\s*(\d+)\s+lines\]/.exec(firstLine);
  if (wholeFileMatch) {
    const filename = wholeFileMatch[1];
    const lines = parseInt(wholeFileMatch[2], 10);
    return { filename, lines, bytes: output.length };
  }

  const rangeMatch = /^\[(.+?):\s*lines\s+\d+-\d+\s+of\s+(\d+)\]/.exec(
    firstLine
  );
  if (rangeMatch) {
    const filename = rangeMatch[1];
    const lines = parseInt(rangeMatch[2], 10);
    return { filename, lines, bytes: output.length };
  }

  // Batched header: "--- [1/N] path: ..."
  const batchHeaderMatch = /^--- \[\d+\/(\d+)\]/.exec(firstLine);
  if (batchHeaderMatch) {
    return {
      filename: "batch",
      lines: 0,
      bytes: output.length,
      fileCount: parseInt(batchHeaderMatch[1], 10),
    };
  }

  return null;
}

/**
 * Parse search_files output to extract match counts.
 */
export function parseSearchFilesOutput(output: string): {
  matches: number;
  files: number;
  contentSearch: boolean;
} | null {
  const contentMatch = /^Found\s+(\d+)\s+matches\s+in\s+(\d+)\s+files/.exec(
    output
  );
  if (contentMatch) {
    return {
      matches: parseInt(contentMatch[1], 10),
      files: parseInt(contentMatch[2], 10),
      contentSearch: true,
    };
  }

  const globMatch = /^Found\s+(\d+)\s+files:/.exec(output);
  if (globMatch) {
    const count = parseInt(globMatch[1], 10);
    return { matches: count, files: count, contentSearch: false };
  }

  return null;
}

/**
 * Parse explore output to count files.
 */
export function parseExploreOutput(
  output: string
): { fileCount: number } | null {
  const match = /\[(\d+) files\]/.exec(output);
  if (match) {
    return { fileCount: parseInt(match[1], 10) };
  }

  const lines = output.split("\n");
  let count = 0;
  for (const line of lines) {
    if (line.trim() !== "" && /[a-zA-Z0-9]/.exec(line)) {
      count++;
    }
  }
  return { fileCount: count };
}

/**
 * Parse write_file output to extract metadata.
 */
export function parseWriteFileOutput(output: string): {
  filename: string;
  editCount?: number;
  totalLines?: number;
  chars?: number;
  lines?: string;
} | null {
  const updatedMultiMatch =
    /^Updated\s+(.+?)\s+\((\d+)\s+edits?,\s+now\s+(\d+)\s+lines?\)/.exec(
      output
    );
  if (updatedMultiMatch) {
    return {
      filename: updatedMultiMatch[1],
      editCount: parseInt(updatedMultiMatch[2], 10),
      totalLines: parseInt(updatedMultiMatch[3], 10),
    };
  }

  const wroteLineMatch = /^Wrote\s+(.+?)\s+\((\d+)\s+lines?\)/.exec(output);
  if (wroteLineMatch) {
    return {
      filename: wroteLineMatch[1],
      totalLines: parseInt(wroteLineMatch[2], 10),
    };
  }

  const wroteMatch = /^Wrote\s+(.+?)\s+\((\d+)\s+chars\)/.exec(output);
  if (wroteMatch) {
    return {
      filename: wroteMatch[1],
      chars: parseInt(wroteMatch[2], 10),
    };
  }

  const updatedMatch = /^Updated\s+(.+?)\s+lines\s+(\d+-\d+)/.exec(output);
  if (updatedMatch) {
    return {
      filename: updatedMatch[1],
      lines: updatedMatch[2],
    };
  }

  return null;
}

/**
 * Parse agent-browser command input to extract action.
 */
export function parseAgentBrowserCommand(input: Record<string, unknown>): {
  action: string;
  target?: string;
} {
  const command = typeof input.command === "string" ? input.command : "";
  const parts = command.split(" ");
  const action = parts[0];
  const target = parts[1];
  return { action, target };
}
