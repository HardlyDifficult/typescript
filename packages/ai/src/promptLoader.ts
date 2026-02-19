/**
 * Prompt template loader with lazy caching
 *
 * Provides a factory for creating cached prompt loaders that read
 * markdown templates from a prompts directory.
 */

import { readFileSync } from "fs";
import { join } from "path";

/**
 * Create a lazily-loaded, cached prompt template reader.
 *
 * @param promptsDir - Absolute path to the prompts directory
 * @param relativePath - Path relative to the prompts directory (e.g. 'ask/ask.md')
 * @returns A function that returns the cached template string
 *
 * @example
 * ```typescript
 * const getAskPrompt = createPromptLoader('/path/to/prompts', 'ask/ask.md');
 * const template = getAskPrompt(); // reads from disk on first call, cached after
 * ```
 */
export function createPromptLoader(
  promptsDir: string,
  relativePath: string
): () => string {
  let cached: string | undefined;
  return () => {
    cached ??= readFileSync(join(promptsDir, relativePath), "utf-8");
    return cached;
  };
}
