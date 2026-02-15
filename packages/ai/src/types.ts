import type { z } from "zod";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

export interface AITracker {
  record(usage: Usage): void;
}

export interface AIOptions {
  maxTokens?: number;
}

export interface ChatMessage {
  text: string;
  usage: Usage;
  reply(prompt: string): ChatCall;
}

export interface ChatCall extends PromiseLike<ChatMessage> {
  text(): PromiseLike<string>;
  zod<TSchema extends z.ZodType>(
    schema: TSchema
  ): PromiseLike<z.infer<TSchema>>;
}

export interface AI {
  chat(prompt: string, systemPrompt?: string): ChatCall;
}
