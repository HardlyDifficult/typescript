import type { Logger } from "@hardlydifficult/logger";
import {
  generateText,
  type LanguageModel,
  tool as sdkTool,
  stepCountIs,
  streamText,
  type Tool,
} from "ai";

import type {
  Agent,
  AgentCallbacks,
  AgentOptions,
  AgentResult,
  AITracker,
  Message,
  ToolMap,
  Usage,
} from "./types.js";

const DEFAULT_MAX_STEPS = 10;
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;

/** Normalize the handler arg into AgentCallbacks. */
function toCallbacks(
  handler: ((text: string) => void) | AgentCallbacks
): AgentCallbacks {
  return typeof handler === "function" ? { onText: handler } : handler;
}

type AnyToolRecord = Record<string, Tool>;

/** Convert ToolMap entries to AI SDK tool() calls, wrapping execute with logging + callbacks. */
function convertTools(
  tools: ToolMap,
  logger: Logger,
  callbacks?: AgentCallbacks
): AnyToolRecord {
  const result: AnyToolRecord = {};

  for (const [name, def] of Object.entries(tools)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK tool() requires explicit generic params for heterogeneous ToolMap
    result[name] = sdkTool<any, any>({
      description: def.description,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- ToolMap uses any to support heterogeneous schemas
      inputSchema: def.inputSchema,
      execute: async (args: Record<string, unknown>) => {
        logger.debug("Tool call", { tool: name, input: args });
        callbacks?.onToolCall?.(name, args);

        const output = await def.execute(args);

        logger.debug("Tool result", {
          tool: name,
          outputLength: output.length,
        });
        callbacks?.onToolResult?.(name, output);

        return output;
      },
    });
  }

  return result;
}

/** Create a tool-calling Agent bound to a model, tools, and tracker. */
export function createAgent(
  model: LanguageModel,
  tools: ToolMap,
  tracker: AITracker,
  logger: Logger,
  options?: AgentOptions
): Agent {
  const maxSteps = options?.maxSteps ?? DEFAULT_MAX_STEPS;
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;

  return {
    async run(messages: Message[]): Promise<AgentResult> {
      const startMs = Date.now();
      const sdkTools = convertTools(tools, logger);

      logger.debug("Agent run start", {
        messageCount: messages.length,
        toolCount: Object.keys(tools).length,
        maxSteps,
      });

      const result = await generateText({
        model,
        messages,
        tools: sdkTools,
        stopWhen: stepCountIs(maxSteps),
        maxOutputTokens: maxTokens,
        temperature,
      });

      const durationMs = Date.now() - startMs;
      const resultUsage = result.usage;
      const usage: Usage = {
        inputTokens: resultUsage.inputTokens ?? 0,
        outputTokens: resultUsage.outputTokens ?? 0,
        durationMs,
      };

      tracker.record(usage);

      logger.debug("Agent run complete", {
        responseLength: result.text.length,
        durationMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });

      return { text: result.text, usage };
    },

    async stream(
      messages: Message[],
      handler: ((text: string) => void) | AgentCallbacks
    ): Promise<AgentResult> {
      const callbacks = toCallbacks(handler);
      const startMs = Date.now();
      const sdkTools = convertTools(tools, logger, callbacks);

      logger.debug("Agent stream start", {
        messageCount: messages.length,
        toolCount: Object.keys(tools).length,
        maxSteps,
      });

      const result = streamText({
        model,
        messages,
        tools: sdkTools,
        stopWhen: stepCountIs(maxSteps),
        maxOutputTokens: maxTokens,
        temperature,
      });

      let accumulated = "";

      for await (const part of result.fullStream) {
        if (part.type === "text-delta") {
          accumulated += part.text;
          callbacks.onText(part.text);
        }
      }

      const resultUsage = await result.usage;
      const durationMs = Date.now() - startMs;
      const usage: Usage = {
        inputTokens: resultUsage.inputTokens ?? 0,
        outputTokens: resultUsage.outputTokens ?? 0,
        durationMs,
      };

      tracker.record(usage);

      logger.debug("Agent stream complete", {
        responseLength: accumulated.length,
        durationMs,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
      });

      return { text: accumulated, usage };
    },
  };
}
