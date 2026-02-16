import type { Logger } from "@hardlydifficult/logger";
import { generateText, type LanguageModel, Output } from "ai";
import type { z } from "zod";

import { createAgent } from "./createAgent.js";
import { runStream } from "./createStream.js";
import type {
  Agent,
  AgentOptions,
  AgentResult,
  AI,
  AIOptions,
  AITracker,
  ChatCall,
  ChatMessage,
  Message,
  ToolMap,
  Usage,
} from "./types.js";

interface CoreMessage {
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_MAX_TOKENS = 4096;

function createChatCall(
  model: LanguageModel,
  tracker: AITracker,
  logger: Logger,
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
      ...(systemPrompt !== undefined && { system: systemPrompt }),
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
      prompt: messages[messages.length - 1].content,
      response: result.text,
      systemPrompt,
    };

    tracker.record(usage);

    logger.debug("AI response", {
      responseLength: result.text.length,
      durationMs,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
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
export function createAI(
  model: LanguageModel,
  tracker: AITracker,
  logger: Logger,
  options?: AIOptions
): AI {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for JS callers
  if (tracker === undefined || tracker === null) {
    throw new Error("AITracker is required — all AI usage must be tracked");
  }

  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;
  const temperature = options?.temperature;

  return {
    chat(prompt: string, systemPrompt?: string): ChatCall {
      return createChatCall(
        model,
        tracker,
        logger,
        maxTokens,
        [{ role: "user", content: prompt }],
        systemPrompt
      );
    },

    stream(
      messages: Message[],
      onText: (text: string) => void
    ): Promise<AgentResult> {
      return runStream(
        model,
        tracker,
        logger,
        messages,
        onText,
        maxTokens,
        temperature
      );
    },

    agent(tools: ToolMap, agentOptions?: AgentOptions): Agent {
      return createAgent(model, tools, tracker, logger, {
        maxSteps: agentOptions?.maxSteps,
        maxTokens: agentOptions?.maxTokens ?? maxTokens,
        temperature: agentOptions?.temperature ?? temperature,
      });
    },
  };
}
