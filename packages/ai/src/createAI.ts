import { generateText, type LanguageModel, Output } from "ai";
import type { z } from "zod";

import type {
  AI,
  AIOptions,
  AITracker,
  ChatCall,
  ChatMessage,
  StructuredChatMessage,
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
  maxTokens: number,
  messages: CoreMessage[],
  systemPrompt: string | undefined
): ChatCall {
  let zodSchema: z.ZodType | undefined;

  async function execute(): Promise<ChatMessage> {
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
    };

    tracker.record(usage);

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
    zod<TSchema extends z.ZodType>(
      schema: TSchema
    ): PromiseLike<StructuredChatMessage<z.infer<TSchema>>> {
      zodSchema = schema;
      return call as unknown as PromiseLike<
        StructuredChatMessage<z.infer<TSchema>>
      >;
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

/** Creates an AI client with required usage tracking. Throws if tracker is not provided. */
export function createAI(
  model: LanguageModel,
  tracker: AITracker,
  options?: AIOptions
): AI {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for JS callers
  if (tracker === undefined || tracker === null) {
    throw new Error("AITracker is required — all AI usage must be tracked");
  }

  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;

  return {
    chat(prompt: string, systemPrompt?: string): ChatCall {
      return createChatCall(
        model,
        tracker,
        maxTokens,
        [{ role: "user", content: prompt }],
        systemPrompt
      );
    },
  };
}
