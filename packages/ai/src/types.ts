import type { z } from "zod";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  prompt: string;
  response: string;
  systemPrompt?: string;
}

export interface AITracker {
  record(usage: Usage): void;
}

export interface AIOptions {
  maxTokens?: number;
  temperature?: number;
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

/** A conversation message. */
export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Tool definition — consumers define tools as plain objects, no SDK import needed. */
export interface ToolDefinition<TInput extends z.ZodType = z.ZodType> {
  description: string;
  inputSchema: TInput;
  execute: (input: z.infer<TInput>) => Promise<string>;
}

/** Named set of tools. Each tool may have a different input schema. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolMap = Record<string, ToolDefinition<any>>;

/** Callbacks for agent streaming. Tool calls are auto-logged via Logger. */
export interface AgentCallbacks {
  onText: (text: string) => void;
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: string) => void;
}

/** Options for creating an agent. */
export interface AgentOptions {
  maxSteps?: number;
  temperature?: number;
  maxTokens?: number;
}

/** Result of a stream or agent run. */
export interface AgentResult {
  text: string;
  usage: Usage;
}

/** Tool-calling agent bound to a model and tool set. */
export interface Agent {
  run(messages: Message[]): Promise<AgentResult>;
  stream(
    messages: Message[],
    handler: ((text: string) => void) | AgentCallbacks
  ): Promise<AgentResult>;
}

export interface AI {
  chat(prompt: string, systemPrompt?: string): ChatCall;
  stream(
    messages: Message[],
    onText: (text: string) => void
  ): Promise<AgentResult>;
  agent(tools: ToolMap, options?: AgentOptions): Agent;
}
