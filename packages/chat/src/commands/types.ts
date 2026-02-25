/**
 * Bot framework types — Agent, Command, Context, and State interfaces
 *
 * Commands declare their argument shape via the `args` field rather than
 * writing a manual `parse()` function. The framework auto-generates the
 * parser based on the declared shape.
 */

import type { Channel } from "../Channel.js";
import type { Message } from "../Message.js";
import type { Thread } from "../Thread.js";

/**
 * Minimal shared state required by the framework.
 * Extend this in your app with domain-specific fields.
 */
export interface CoreBotState {
  /** Commands currently being processed (for de-dupe and typing indicator) */
  inFlightCommands: Set<string>;
}

/**
 * Result of parsing a command.
 */
export type ParseResult =
  | { valid: true; args: Record<string, unknown> }
  | { valid: false; error: string };

/**
 * Argument shape declaration for auto-parsing.
 *
 * - `'none'` — no arguments (exact prefix match). Parse returns `{}`.
 * - `'rest'` — single string arg = everything after the prefix.
 *    Requires `argName` to name the key. Parse returns `{ [argName]: string }`.
 * - `'custom'` — full control for complex multi-arg parsing.
 */
export type ArgShape =
  | { type: "none" }
  | { type: "rest"; argName: string; optional?: boolean }
  | {
      type: "custom";
      parse: (
        normalizedInput: string,
        originalInput: string
      ) => ParseResult | null;
    };

/**
 * Context passed to command execute() — everything a command needs
 * to interact with the chat channel.
 */
export interface CommandContext<TState extends CoreBotState = CoreBotState> {
  readonly channelId: string;
  readonly state: TState;
  readonly channel: Channel;
  /** The incoming user message that triggered this command */
  readonly incomingMessage: Message;
  /** Send a message (fire and forget) */
  send(content: string): Promise<void>;
  /** Send a message and return the Message object (for editing, reactions) */
  sendMessage(content: string): Promise<Message>;
  /** Send a dismissable informative message (adds dismiss reaction) */
  sendDismissable(content: string): Promise<Message>;
  /** Send a file as an attachment */
  sendFile(
    content: string | Buffer,
    filename: string,
    message?: string
  ): Promise<void>;
  /** Start a thread and return a Thread for posting into it */
  startThread(name: string, autoArchiveDuration?: number): Promise<Thread>;
}

/**
 * A single command definition.
 *
 * When `args` is 'none' or 'rest', the framework auto-generates the parser.
 * When `args` is 'custom', the provided parse function is used directly.
 */
export interface Command<TState extends CoreBotState = CoreBotState> {
  /** Command prefix for matching (e.g., "prs", "merge all") */
  readonly prefix: string;
  /** Human-readable description for help */
  readonly description: string;
  /** Optional usage example for help */
  readonly usage?: string;
  /** Argument shape — determines how input is parsed */
  readonly args: ArgShape;
  /**
   * Execute the command.
   * The user's command message is automatically deleted on completion.
   */
  execute(
    ctx: CommandContext<TState>,
    args: Record<string, unknown>
  ): Promise<void>;
}

/**
 * An agent is a named group of related commands.
 */
export interface Agent<TState extends CoreBotState = CoreBotState> {
  readonly name: string;
  readonly commands: readonly Command<TState>[];
}
