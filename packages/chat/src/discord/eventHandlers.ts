import type {
  Client,
  Message as DiscordMessage,
  User as DiscordUser,
  MessageReaction,
  PartialMessage,
  PartialMessageReaction,
  PartialUser,
} from "discord.js";

import type {
  Attachment,
  DisconnectCallback,
  ErrorCallback,
  MessageCallback,
  MessageEvent,
  ReactionCallback,
  ReactionEvent,
} from "../types.js";

/**
 * Wire the discord.js `messageReactionAdd` event to per-channel callbacks.
 */
export function setupReactionListener(
  client: Client,
  listeners: Map<string, Set<ReactionCallback>>
): void {
  client.on(
    "messageReactionAdd",
    (
      reaction: MessageReaction | PartialMessageReaction,
      user: DiscordUser | PartialUser
    ): void => {
      void (async (): Promise<void> => {
        if (reaction.partial) {
          try {
            await reaction.fetch();
          } catch (error) {
            console.error("Failed to fetch partial reaction:", error);
            return;
          }
        }

        const { channelId } = reaction.message;
        const callbacks = listeners.get(channelId);
        if (!callbacks || callbacks.size === 0) {
          return;
        }

        const event: ReactionEvent = {
          emoji: reaction.emoji.name ?? reaction.emoji.id ?? "",
          user: { id: user.id, username: user.username ?? undefined },
          messageId: reaction.message.id,
          channelId,
          timestamp: new Date(),
        };

        for (const callback of callbacks) {
          try {
            await callback(event);
          } catch (error) {
            console.error("Reaction callback error:", error);
          }
        }
      })();
    }
  );
}

/**
 * Wire the discord.js `messageCreate` event to per-channel callbacks.
 * Messages from the bot itself are ignored.
 */
export function setupMessageListener(
  client: Client,
  listeners: Map<string, Set<MessageCallback>>
): void {
  client.on(
    "messageCreate",
    (message: DiscordMessage | PartialMessage): void => {
      void (async (): Promise<void> => {
        if (message.author?.id === client.user?.id) {
          return;
        }

        const { channelId } = message;
        const callbacks = listeners.get(channelId);
        if (!callbacks || callbacks.size === 0) {
          return;
        }

        const attachments: Attachment[] = [];
        for (const [, attachment] of message.attachments) {
          attachments.push({
            url: attachment.url,
            name: attachment.name,
            contentType: attachment.contentType ?? undefined,
            size: attachment.size,
          });
        }

        const event: MessageEvent = {
          id: message.id,
          content: message.cleanContent ?? message.content ?? "",
          author: {
            id: message.author?.id ?? "",
            username: message.author?.username ?? undefined,
          },
          channelId,
          timestamp: message.createdAt,
          attachments,
        };

        for (const callback of callbacks) {
          try {
            await callback(event);
          } catch (error) {
            console.error("Message callback error:", error);
          }
        }
      })();
    }
  );
}

/**
 * Forward discord.js shard disconnect / error events to the provided callbacks.
 */
export function setupConnectionResilience(
  client: Client,
  disconnectCallbacks: Set<DisconnectCallback>,
  errorCallbacks: Set<ErrorCallback>
): void {
  client.on("shardDisconnect", (_event, shardId) => {
    const reason = `Shard ${String(shardId)} disconnected`;
    for (const callback of disconnectCallbacks) {
      void Promise.resolve(callback(reason)).catch((err: unknown) => {
        console.error("Disconnect callback error:", err);
      });
    }
  });

  client.on("shardError", (error, shardId) => {
    const wrappedError =
      error instanceof Error
        ? error
        : new Error(`Shard ${String(shardId)} error: ${String(error)}`);
    for (const callback of errorCallbacks) {
      void Promise.resolve(callback(wrappedError)).catch((err: unknown) => {
        console.error("Error callback error:", err);
      });
    }
  });
}
