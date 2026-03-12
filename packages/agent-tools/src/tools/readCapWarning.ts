/**
 * Read-cap warning middleware — nudges AI agents to start writing
 * when they read too many files without making any edits.
 *
 * Wraps `read_file` and `write_file` tools with a counter.
 * After `threshold` consecutive reads without a write, the
 * read_file output is prefixed with a warning.
 */

import type { ToolMap } from "@hardlydifficult/ai";

/** Default number of reads before warning. */
const DEFAULT_THRESHOLD = 8;

/**
 * Wrap a ToolMap so that `read_file` produces a warning after
 * `threshold` consecutive reads without a `write_file` call.
 *
 * Returns a new ToolMap — the original is not modified.
 */
export function withReadCapWarning(
  tools: ToolMap,
  threshold: number = DEFAULT_THRESHOLD,
): ToolMap {
  const readTool = tools.read_file;
  const writeTool = tools.write_file;

  if (!readTool || !writeTool) {
    return tools;
  }

  let readsSinceLastWrite = 0;

  const originalReadExecute = readTool.execute;
  const originalWriteExecute = writeTool.execute;

  return {
    ...tools,
    read_file: {
      ...readTool,
      execute: async (input: Record<string, unknown>) => {
        readsSinceLastWrite++;
        let result = await originalReadExecute(input);
        if (
          readsSinceLastWrite >= threshold &&
          typeof result === "string"
        ) {
          result = `[Warning: You have read ${String(readsSinceLastWrite)} files without making any edits. Start writing code now.]\n\n${result}`;
        }
        return result;
      },
    },
    write_file: {
      ...writeTool,
      execute: async (input: Record<string, unknown>) => {
        readsSinceLastWrite = 0;
        return originalWriteExecute(input);
      },
    },
  };
}
