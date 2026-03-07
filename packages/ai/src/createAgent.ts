import {
  generateText,
  type LanguageModel,
  tool as sdkTool,
  stepCountIs,
  streamText,
  type Tool,
} from "ai";

import { addCacheControl } from "./addCacheControl.js";
import type {
  Agent,
  AgentCallbacks,
  AgentOptions,
  AgentResult,
  AITracker,
  LoggerLike,
  Message,
  PromptInput,
  PromptOptions,
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

function normalizeMessages(
  input: PromptInput,
  systemPrompt?: string
): Message[] {
  const messages =
    typeof input === "string"
      ? [{ role: "user" as const, content: input }]
      : [...input];

  if (
    systemPrompt === undefined ||
    systemPrompt === "" ||
    messages.some((message) => message.role === "system")
  ) {
    return messages;
  }

  return [{ role: "system", content: systemPrompt }, ...messages];
}

function getTrackedPrompt(messages: Message[]): string {
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (lastUserMessage !== undefined) {
    return lastUserMessage.content;
  }
  if (messages.length > 0) {
    return messages[messages.length - 1].content;
  }
  return "";
}

type AnyToolRecord = Record<string, Tool>;

/** Convert ToolMap entries to AI SDK tool() calls, wrapping execute with logging + callbacks. */
function convertTools(
  tools: ToolMap,
  logger: LoggerLike,
  callbacks?: AgentCallbacks
): AnyToolRecord {
  const result: AnyToolRecord = {};

  for (const [name, def] of Object.entries(tools)) {
    /* eslint-disable @typescript-eslint/no-explicit-any -- SDK tool() requires explicit generic params for heterogeneous ToolMap */
    result[name] = sdkTool<any, any>({
      description: def.description,
      inputSchema: def.inputSchema,
      execute: async (args: Record<string, unknown>) => {
        logger.debug("Tool call", { tool: name, input: args });
        callbacks?.onToolCall?.(name, args);

        const output = await def.execute(args);

        logger.debug("Tool result", {
          tool: name,
          outputType: (() => {
            if (output === null) {
              return "null";
            }
            if (Array.isArray(output)) {
              return "array";
            }
            return typeof output;
          })(),
          ...(typeof output === "string" && { outputLength: output.length }),
        });
        callbacks?.onToolResult?.(name, output);

        return output;
      },
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  return result;
}

/** Create a tool-calling Agent bound to a model, tools, and tracker. */
export function createAgent(
  model: LanguageModel,
  tools: ToolMap,
  tracker: AITracker,
  logger: LoggerLike,
  options?: AgentOptions
): Agent {
  const maxSteps = options?.maxSteps ?? DEFAULT_MAX_STEPS;
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;
  const defaultSystemPrompt = options?.systemPrompt;

  return {
    async run(
      input: PromptInput,
      runOptions?: PromptOptions
    ): Promise<AgentResult> {
      const startMs = Date.now();
      const sdkTools = convertTools(tools, logger);
      const messages = normalizeMessages(
        input,
        runOptions?.systemPrompt ?? defaultSystemPrompt
      );

      logger.debug("Agent run start", {
        messageCount: messages.length,
        toolCount: Object.keys(tools).length,
        maxSteps,
      });

      const result = await generateText({
        model,
        messages: addCacheControl(messages),
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
        prompt: getTrackedPrompt(messages),
        response: result.text,
        systemPrompt: messages.find((message) => message.role === "system")
          ?.content,
        cacheCreationTokens:
          resultUsage.inputTokenDetails.cacheWriteTokens ?? undefined,
        cacheReadTokens:
          resultUsage.inputTokenDetails.cacheReadTokens ?? undefined,
      };

      tracker.record(usage);

      logger.debug("Agent run complete", {
        responseLength: result.text.length,
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

      return { text: result.text, usage };
    },

    async stream(
      input: PromptInput,
      handler: ((text: string) => void) | AgentCallbacks,
      streamOptions?: PromptOptions
    ): Promise<AgentResult> {
      const callbacks = toCallbacks(handler);
      const startMs = Date.now();
      const sdkTools = convertTools(tools, logger, callbacks);
      const messages = normalizeMessages(
        input,
        streamOptions?.systemPrompt ?? defaultSystemPrompt
      );

      logger.debug("Agent stream start", {
        messageCount: messages.length,
        toolCount: Object.keys(tools).length,
        maxSteps,
      });

      const result = streamText({
        model,
        messages: addCacheControl(messages),
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
        prompt: getTrackedPrompt(messages),
        response: accumulated,
        systemPrompt: messages.find((message) => message.role === "system")
          ?.content,
        cacheCreationTokens:
          resultUsage.inputTokenDetails.cacheWriteTokens ?? undefined,
        cacheReadTokens:
          resultUsage.inputTokenDetails.cacheReadTokens ?? undefined,
      };

      tracker.record(usage);

      logger.debug("Agent stream complete", {
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
    },
  };
}
