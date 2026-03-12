/**
 * Anthropic API cost estimation from token counts.
 *
 * Includes pricing tables for Claude model families and cache token handling.
 */

/** Per-million-token pricing for an Anthropic model. */
export interface AnthropicModelPricing {
  input: number;
  output: number;
}

/** Built-in pricing table (as of 2026). */
const PRICING: Record<string, AnthropicModelPricing> = {
  // Claude 3 (legacy)
  haiku: { input: 0.25, output: 1.25 },
  sonnet: { input: 3.0, output: 15.0 },
  opus: { input: 15.0, output: 75.0 },
  // Claude 4.x
  "haiku-4": { input: 1.0, output: 5.0 },
  "opus-4": { input: 5.0, output: 25.0 },
};

/** Maps full model IDs to short pricing keys. */
const MODEL_ALIASES: Record<string, string> = {
  "claude-3-haiku-20240307": "haiku",
  "claude-sonnet-4-6": "sonnet",
  "claude-opus-4-20250514": "opus",
  "claude-haiku-4-5": "haiku-4",
  "claude-opus-4-6": "opus-4",
};

/**
 * Calculate estimated cost in USD for an Anthropic API call.
 *
 * When prompt caching is active, the SDK's `inputTokens` is the **total**
 * (non-cached + cache-write + cache-read). We decompose it here:
 * - Cache write tokens: 1.25× normal input price
 * - Cache read tokens:  0.1× normal input price
 * - Remaining tokens:   1× normal input price
 */
export function calculateAnthropicCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheWriteTokens?: number,
  cacheReadTokens?: number
): number {
  const shortName = MODEL_ALIASES[model] ?? model;
  const pricing = PRICING[shortName] ?? PRICING.sonnet;

  const cacheWrite = cacheWriteTokens ?? 0;
  const cacheRead = cacheReadTokens ?? 0;
  const baseInputTokens = inputTokens - cacheWrite - cacheRead;

  return (
    (baseInputTokens / 1_000_000) * pricing.input +
    (cacheWrite / 1_000_000) * pricing.input * 1.25 +
    (cacheRead / 1_000_000) * pricing.input * 0.1 +
    (outputTokens / 1_000_000) * pricing.output
  );
}
