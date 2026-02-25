/**
 * Message dispatcher — routes messages to commands, handles typing indicators,
 * and cleans up user messages after processing.
 *
 * Application-specific behavior (e.g., AI command suggestions for unrecognized
 * input) is plugged in via the `onUnrecognized` callback.
 */

import type { Channel } from "../Channel.js";
import type { Message } from "../Message.js";

import type { CommandRegistry } from "./CommandRegistry.js";
import type { CommandContext, CoreBotState } from "./types.js";

export interface DispatcherOptions<TState extends CoreBotState = CoreBotState> {
  /** Channel to dispatch messages for */
  channel: Channel;
  /** Command registry */
  registry: CommandRegistry<TState>;
  /** Shared mutable bot state */
  state: TState;
  /** Only handle messages from this username (if set) */
  ownerUsername?: string;
  /** Owner user ID for dismissable messages */
  ownerUserId?: string;
  /** Called when the owner's user ID is first captured from an incoming message */
  onOwnerIdCaptured?: (userId: string) => void;
  /** Called when no command matches. Receives a CommandContext for executing suggestions. If not provided, sends a dismissable error. */
  onUnrecognized?: (
    input: string,
    ctx: CommandContext<TState>
  ) => Promise<void>;
  /** Called when a parse fails (invalid args). Default: post dismissable error. */
  onParseError?: (error: string) => void;
}

/** Message dispatcher — routes messages to commands, handles typing indicators, and cleans up user messages after processing. */
export class CommandDispatcher<TState extends CoreBotState = CoreBotState> {
  /** Messages that have threads created on them — skip deletion in finally block */
  private readonly messagesWithThreads = new Set<string>();

  constructor(private readonly options: DispatcherOptions<TState>) {}

  /**
   * Handle an incoming message from the chat library.
   */
  async handleMessage(message: Message): Promise<void> {
    const { channel, registry, state, ownerUsername } = this.options;
    const content = message.content ?? "";
    const { author } = message;

    // Only respond to the owner (if configured)
    if (ownerUsername !== undefined && author?.username !== ownerUsername) {
      return;
    }

    // Capture owner's user ID on first message
    if (author?.id !== undefined && this.options.ownerUserId === undefined) {
      this.options.ownerUserId = author.id;
      this.options.onOwnerIdCaptured?.(author.id);
    }

    const input = content.trim();
    const normalizedInput = input.toLowerCase();

    // De-dupe check: if this command is already in-flight, skip it
    if (state.inFlightCommands.has(normalizedInput)) {
      return;
    }

    // Track this command as in-flight and manage typing indicator
    const wasEmpty = state.inFlightCommands.size === 0;
    state.inFlightCommands.add(normalizedInput);
    if (wasEmpty) {
      channel.beginTyping();
    }

    // Skip empty messages (e.g., voice messages handled elsewhere)
    if (!input) {
      this.completeInFlight(normalizedInput);
      return;
    }

    try {
      const match = registry.match(input);
      const ctx = this.createContext(message);

      if (!match) {
        if (this.options.onUnrecognized) {
          await this.options.onUnrecognized(input, ctx);
        } else {
          this.sendDismissable(
            `Unrecognized command: \`${input}\`. Type \`help\` for available commands.`
          );
        }
      } else if (!match.parsed.valid) {
        const errorMsg = match.parsed.error;
        if (this.options.onParseError) {
          this.options.onParseError(errorMsg);
        } else {
          this.sendDismissable(errorMsg);
        }
      } else {
        await match.command.execute(ctx, match.parsed.args);
      }
    } catch (err) {
      // Surface command execution errors rather than silently dropping them
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.sendDismissable(`Command failed: ${errorMsg}`);
    } finally {
      // Delete the user's command message unless a thread was created on it
      if (!this.messagesWithThreads.delete(message.id)) {
        message.delete().catch(() => {
          /* swallow */
        });
      }

      // Remove from in-flight commands and stop typing if all done
      this.completeInFlight(normalizedInput);
    }
  }

  private sendDismissable(content: string): void {
    const { channel } = this.options;
    const ownerId = this.options.ownerUserId;
    if (ownerId !== undefined) {
      void channel.postDismissable(content, ownerId);
    } else {
      void channel.postMessage(content);
    }
  }

  private createContext(incomingMessage: Message): CommandContext<TState> {
    const { channel, state } = this.options;
    return {
      channelId: incomingMessage.channelId,
      state,
      channel,
      incomingMessage,
      send: (content: string) => {
        void channel.postMessage(content);
        return Promise.resolve();
      },
      sendMessage: async (content: string) => {
        return await channel.postMessage(content);
      },
      sendDismissable: async (content: string) => {
        const ownerId = this.options.ownerUserId;
        if (ownerId !== undefined) {
          return await channel.postDismissable(content, ownerId);
        }
        return await channel.postMessage(content);
      },
      sendFile: (content: string | Buffer, filename: string, msg?: string) => {
        const buffer =
          typeof content === "string" ? Buffer.from(content, "utf-8") : content;
        void channel.postMessage(msg ?? "", {
          files: [{ content: buffer, name: filename }],
        });
        return Promise.resolve();
      },
      startThread: async (name: string, autoArchiveDuration?: number) => {
        const thread = await incomingMessage.startThread(
          name,
          autoArchiveDuration
        );
        this.messagesWithThreads.add(incomingMessage.id);
        return thread;
      },
    };
  }

  /** Remove a command from in-flight tracking and stop typing if all commands are done */
  private completeInFlight(normalizedInput: string): void {
    const { state, channel } = this.options;
    state.inFlightCommands.delete(normalizedInput);
    if (state.inFlightCommands.size === 0) {
      channel.endTyping();
    }
  }
}
