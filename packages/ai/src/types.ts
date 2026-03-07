import type { LanguageModel } from "ai";
import type { z } from "zod";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  prompt: string;
  response: string;
  systemPrompt?: string;
  /** Tokens written to the prompt cache (Anthropic: 1.25× input price). */
  cacheCreationTokens?: number;
  /** Tokens read from the prompt cache (Anthropic: 0.1× input price). */
  cacheReadTokens?: number;
}

export interface AITracker {
  record(usage: Usage): void;
}

export interface AIOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface LoggerLike {
  debug(message: string, context?: Readonly<Record<string, unknown>>): void;
  info(message: string, context?: Readonly<Record<string, unknown>>): void;
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}

export interface PromptOptions {
  systemPrompt?: string;
}

export interface CreateAIConfig extends AIOptions, PromptOptions {
  model: LanguageModel;
  tracker: AITracker;
  logger?: LoggerLike;
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

export type PromptInput = string | Message[];

/** Tool definition — consumers define tools as plain objects, no SDK import needed. */
export interface ToolDefinition<TInput extends z.ZodType = z.ZodType> {
  description: string;
  inputSchema: TInput;
  execute: (input: z.infer<TInput>) => unknown | Promise<unknown>;
}

/** Named set of tools. Each tool may have a different input schema. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ToolMap = Record<string, ToolDefinition<any>>;

/** Callbacks for agent streaming. Tool calls are auto-logged via Logger. */
export interface AgentCallbacks {
  onText: (text: string) => void;
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  onToolResult?: (name: string, result: unknown) => void;
}

/** Options for creating an agent. */
export interface AgentOptions extends PromptOptions {
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
  run(input: PromptInput, options?: PromptOptions): Promise<AgentResult>;
  stream(
    input: PromptInput,
    handler: ((text: string) => void) | AgentCallbacks,
    options?: PromptOptions
  ): Promise<AgentResult>;
}

export interface AI {
  ask(prompt: string, options?: PromptOptions): Promise<string>;
  askFor<TSchema extends z.ZodType>(
    prompt: string,
    schema: TSchema,
    options?: PromptOptions
  ): Promise<z.infer<TSchema>>;
  chat(prompt: string, systemPrompt?: string | PromptOptions): ChatCall;
  stream(
    input: PromptInput,
    onText: (text: string) => void,
    options?: PromptOptions
  ): Promise<AgentResult>;
  agent(tools: ToolMap, options?: AgentOptions): Agent;
  withSystemPrompt(systemPrompt: string): AI;
}
