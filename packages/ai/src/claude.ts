import { createAnthropic } from "@ai-sdk/anthropic";
import type { LanguageModel } from "ai";

/** Anthropic aliases — auto-resolve to the latest snapshot. */
const MODELS = {
  sonnet: "claude-sonnet-4-5",
  haiku: "claude-haiku-4-5",
  opus: "claude-opus-4-6",
} as const;

/** Creates an Anthropic language model from a short variant name. */
export function claude(variant: keyof typeof MODELS): LanguageModel {
  return createAnthropic()(MODELS[variant]);
}
