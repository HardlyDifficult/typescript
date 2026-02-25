/**
 * Factory for creating custom argument parsers with less boilerplate.
 *
 * Most commands follow the same pattern:
 *   1. Match `!?<prefix> <rest>` on the normalized input
 *   2. Return a usage error when the prefix is given with no arguments
 *   3. Extract args from the original (case-preserved) input
 *   4. Call a domain-specific parser on the extracted string
 *
 * `createPrefixParser` handles steps 1–3 and delegates step 4 to `parseArgs`.
 */

import type { ParseResult } from "./types.js";

/** Escape special regex characters in a string */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Create a custom `ArgShape.parse` function for a prefixed command.
 *
 * @param prefix   - The command prefix (e.g. `'scan'`, `'refresh-readme'`).
 * @param parseArgs - Receives the raw argument string (case-preserved) and returns
 *                    either a `Record` of parsed args (success) or a `string`
 *                    error message (validation failure).
 * @param usage    - Shown when the prefix is typed with no arguments.
 *                   Defaults to `Usage: <prefix> <args>`.
 */
export function createPrefixParser(
  prefix: string,
  parseArgs: (argsStr: string) => Record<string, unknown> | string,
  usage?: string
): (normalizedInput: string, originalInput: string) => ParseResult | null {
  const lowerPrefix = prefix.toLowerCase();
  const escaped = escapeRegExp(lowerPrefix);

  // Pre-compile patterns
  const matchPattern = new RegExp(`^!?${escaped}\\s+(.+)$`, "s");
  const originalPattern = new RegExp(
    `^!?${escapeRegExp(prefix)}\\s+(.+)$`,
    "is"
  );

  return (
    normalizedInput: string,
    originalInput: string
  ): ParseResult | null => {
    // Exact prefix with no args → show usage
    if (
      normalizedInput === lowerPrefix ||
      normalizedInput === `!${lowerPrefix}`
    ) {
      return {
        valid: false,
        error: usage ?? `Usage: ${prefix} <args>`,
      };
    }

    // Try to match prefix + whitespace + rest
    const normalizedMatch = matchPattern.exec(normalizedInput);
    if (!normalizedMatch) {
      return null;
    }

    // Extract args from original input to preserve case
    const originalMatch = originalPattern.exec(originalInput);
    const argsStr = (originalMatch?.[1] ?? normalizedMatch[1]).trim();

    // Delegate to domain-specific parser
    const result = parseArgs(argsStr);

    if (typeof result === "string") {
      return { valid: false, error: result };
    }

    return { valid: true, args: result };
  };
}
