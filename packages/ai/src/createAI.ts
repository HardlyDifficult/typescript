import { generateText, type LanguageModel, Output } from "ai";
import type { z } from "zod";

import { createAgent } from "./createAgent.js";
import { runStream } from "./createStream.js";
import type {
  Agent,
  AgentOptions,
  AgentResult,
  AI,
  CreateAIConfig,
  AIOptions,
  AITracker,
  ChatCall,
  ChatMessage,
  LoggerLike,
  Message,
  PromptInput,
  PromptOptions,
  ToolMap,
  Usage,
} from "./types.js";

interface CoreMessage {
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_MAX_TOKENS = 4096;
const NOOP_LOGGER: LoggerLike = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

function resolveSystemPrompt(
  defaultSystemPrompt: string | undefined,
  systemPromptOrOptions?: string | PromptOptions
): string | undefined {
  if (typeof systemPromptOrOptions === "string") {
    return systemPromptOrOptions;
  }

  return systemPromptOrOptions?.systemPrompt ?? defaultSystemPrompt;
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

  return (
    lastUserMessage?.content ?? messages[messages.length - 1]?.content ?? ""
  );
}

function isCreateAIConfig(
  value: LanguageModel | CreateAIConfig
): value is CreateAIConfig {
  return (
    typeof value === "object" &&
    value !== null &&
    "model" in value &&
    "tracker" in value
  );
}

function createChatCall(
  model: LanguageModel,
  tracker: AITracker,
  logger: LoggerLike,
  maxTokens: number,
  messages: CoreMessage[],
  systemPrompt: string | undefined
): ChatCall {
  let zodSchema: z.ZodType | undefined;

  async function execute(): Promise<ChatMessage> {
    const promptLength = messages.reduce((n, m) => n + m.content.length, 0);
    logger.debug("AI request", {
      promptLength,
      hasSystemPrompt: systemPrompt !== undefined,
      hasSchema: zodSchema !== undefined,
    });

    const startMs = Date.now();

    const result = await generateText({
      model,
      messages,
      maxOutputTokens: maxTokens,
      ...(systemPrompt !== undefined && {
        system: {
          role: "system" as const,
          content: systemPrompt,
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" } },
          },
        },
      }),
      ...(zodSchema !== undefined && {
        output: Output.object({ schema: zodSchema }),
      }),
    });

    const durationMs = Date.now() - startMs;

    const resultUsage = result.usage;
    const usage: Usage = {
      inputTokens: resultUsage.inputTokens ?? 0,
      outputTokens: resultUsage.outputTokens ?? 0,
      durationMs,
      prompt: messages[messages.length - 1]?.content ?? "",
      response: result.text,
      systemPrompt,
      cacheCreationTokens:
        resultUsage.inputTokenDetails.cacheWriteTokens ?? undefined,
      cacheReadTokens:
        resultUsage.inputTokenDetails.cacheReadTokens ?? undefined,
    };

    tracker.record(usage);

    logger.debug("AI response", {
      responseLength: ((result.text as string | undefined) ?? "").length,
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

    const responseMessages: CoreMessage[] = [
      ...messages,
      { role: "assistant", content: result.text },
    ];

    const msg: ChatMessage = {
      text: result.text,
      usage,
      reply(prompt: string): ChatCall {
        return createChatCall(
          model,
          tracker,
          logger,
          maxTokens,
          [...responseMessages, { role: "user", content: prompt }],
          systemPrompt
        );
      },
    };

    if (zodSchema !== undefined) {
      return { ...msg, data: result.output } as ChatMessage;
    }

    return msg;
  }

  const call: ChatCall = {
    text(): PromiseLike<string> {
      return {
        then<TResult1 = string, TResult2 = never>(
          onfulfilled?:
            | ((value: string) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null
        ): PromiseLike<TResult1 | TResult2> {
          return execute().then((msg) => {
            return onfulfilled
              ? onfulfilled(msg.text)
              : (msg.text as unknown as TResult1);
          }, onrejected);
        },
      };
    },
    zod<TSchema extends z.ZodType>(
      schema: TSchema
    ): PromiseLike<z.infer<TSchema>> {
      zodSchema = schema;
      return {
        then<TResult1 = z.infer<TSchema>, TResult2 = never>(
          onfulfilled?:
            | ((value: z.infer<TSchema>) => TResult1 | PromiseLike<TResult1>)
            | null,
          onrejected?:
            | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
            | null
        ): PromiseLike<TResult1 | TResult2> {
          return execute().then((msg) => {
            const data = (msg as ChatMessage & { data: unknown })
              .data as z.infer<TSchema>;
            return onfulfilled
              ? onfulfilled(data)
              : (data as unknown as TResult1);
          }, onrejected);
        },
      };
    },
    then<TResult1 = ChatMessage, TResult2 = never>(
      onfulfilled?:
        | ((value: ChatMessage) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null
    ): PromiseLike<TResult1 | TResult2> {
      return execute().then(onfulfilled, onrejected);
    },
  };

  return call;
}

/** Creates an AI client with required usage tracking and logging. */
export function createAI(config: CreateAIConfig): AI;
export function createAI(
  modelOrConfig: LanguageModel | CreateAIConfig,
  tracker?: AITracker,
  logger?: LoggerLike,
  options?: AIOptions
): AI {
  const config = isCreateAIConfig(modelOrConfig)
    ? modelOrConfig
    : {
        model: modelOrConfig,
        tracker,
        logger,
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
        systemPrompt: undefined,
      };

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for JS callers
  if (config.tracker === undefined || config.tracker === null) {
    throw new Error("AITracker is required — all AI usage must be tracked");
  }

  const modelInstance = config.model;
  const trackerInstance = config.tracker;
  const loggerInstance = config.logger ?? NOOP_LOGGER;
  const maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = config.temperature;
  const defaultSystemPrompt = config.systemPrompt;
  const chat = (
    prompt: string,
    systemPromptOrOptions?: string | PromptOptions
  ): ChatCall =>
    createChatCall(
      modelInstance,
      trackerInstance,
      loggerInstance,
      maxTokens,
      [{ role: "user", content: prompt }],
      resolveSystemPrompt(defaultSystemPrompt, systemPromptOrOptions)
    );

  return {
    ask(prompt: string, options?: PromptOptions): Promise<string> {
      return Promise.resolve(
        chat(prompt, resolveSystemPrompt(defaultSystemPrompt, options)).text()
      );
    },

    askFor<TSchema extends z.ZodType>(
      prompt: string,
      schema: TSchema,
      options?: PromptOptions
    ): Promise<z.infer<TSchema>> {
      return Promise.resolve(
        chat(prompt, resolveSystemPrompt(defaultSystemPrompt, options)).zod(
          schema
        )
      );
    },

    chat(
      prompt: string,
      systemPromptOrOptions?: string | PromptOptions
    ): ChatCall {
      return chat(prompt, systemPromptOrOptions);
    },

    stream(
      input: PromptInput,
      onText: (text: string) => void,
      options?: PromptOptions
    ): Promise<AgentResult> {
      const messages = normalizeMessages(
        input,
        resolveSystemPrompt(defaultSystemPrompt, options)
      );

      return runStream(
        modelInstance,
        trackerInstance,
        loggerInstance,
        messages,
        onText,
        maxTokens,
        temperature,
        getTrackedPrompt(messages),
        messages.find((message) => message.role === "system")?.content
      );
    },

    agent(tools: ToolMap, agentOptions?: AgentOptions): Agent {
      return createAgent(
        modelInstance,
        tools,
        trackerInstance,
        loggerInstance,
        {
          maxSteps: agentOptions?.maxSteps,
          maxTokens: agentOptions?.maxTokens ?? maxTokens,
          temperature: agentOptions?.temperature ?? temperature,
          systemPrompt: agentOptions?.systemPrompt ?? defaultSystemPrompt,
        }
      );
    },

    withSystemPrompt(systemPrompt: string): AI {
      return createAI({
        model: modelInstance,
        tracker: trackerInstance,
        logger: loggerInstance,
        maxTokens,
        temperature,
        systemPrompt,
      });
    },
  };
}
