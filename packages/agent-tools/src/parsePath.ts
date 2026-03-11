import { parseFileReference } from "./parseFileReference.js";

/**
 * Parse a file path with optional line range into its components.
 *
 * Wraps `parseFileReference` to return the `{ filePath, startLine, endLine }`
 * shape expected by the agent tools.
 */
export function parsePath(pathSpec: string): {
  filePath: string;
  startLine: number | undefined;
  endLine: number | undefined;
} {
  const ref = parseFileReference(pathSpec);
  return {
    filePath: ref.path,
    startLine: ref.lines?.start,
    endLine: ref.lines?.end,
  };
}
