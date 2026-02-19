import type { Logger } from "@hardlydifficult/logger";
import { type LanguageModel, streamText } from "ai";

import { addCacheControl } from "./addCacheControl.js";
import type { AgentResult, AITracker, Message, Usage } from "./types.js";

const DEFAULT_MAX_TOKENS = 4096;

/** Stream a response, calling onText for each text delta. */
export async function runStream(
  model: LanguageModel,
  tracker: AITracker,
  logger: Logger,
  messages: Message[],
  onText: (text: string) => void,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  temperature?: number
): Promise<AgentResult> {
  const startMs = Date.now();

  logger.debug("AI stream start", {
    messageCount: messages.length,
  });

  const result = streamText({
    model,
    messages: addCacheControl(messages),
    maxOutputTokens: maxTokens,
    ...(temperature !== undefined && { temperature }),
  });

  let accumulated = "";

  for await (const chunk of result.textStream) {
    accumulated += chunk;
    onText(chunk);
  }

  const resultUsage = await result.usage;
  const durationMs = Date.now() - startMs;

  const usage: Usage = {
    inputTokens: resultUsage.inputTokens ?? 0,
    outputTokens: resultUsage.outputTokens ?? 0,
    durationMs,
    prompt: messages[messages.length - 1].content,
    response: accumulated,
    cacheCreationTokens:
      resultUsage.inputTokenDetails?.cacheWriteTokens ?? undefined,
    cacheReadTokens:
      resultUsage.inputTokenDetails?.cacheReadTokens ?? undefined,
  };

  tracker.record(usage);

  logger.debug("AI stream complete", {
    responseLength: accumulated.length,
    durationMs,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    ...(usage.cacheCreationTokens !== undefined && {
      cacheCreationTokens: usage.cacheCreationTokens,
    }),
    ...(usage.cacheReadTokens !== undefined && {
      cacheReadTokens: usage.cacheReadTokens,
    }),
  });

  return { text: accumulated, usage };
}
