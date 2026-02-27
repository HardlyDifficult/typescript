import type { TextChannel, ThreadChannel } from "discord.js";

import { MESSAGE_LIMITS } from "../constants.js";
import { toDiscordEmbed } from "../outputters/discord.js";
import type {
  DeleteMessageOptions,
  FileAttachment,
  MessageContent,
  MessageData,
} from "../types.js";
import { isDocument } from "../utils.js";

import { buildMessagePayload } from "./buildMessagePayload.js";

/**
 * Post a message to a Discord channel or thread.
 */
export async function postMessage(
  channel: TextChannel | ThreadChannel,
  channelId: string,
  content: MessageContent,
  options?: {
    threadTs?: string;
    files?: FileAttachment[];
    linkPreviews?: boolean;
  }
): Promise<MessageData> {
  const payload = buildMessagePayload(content, options);
  const message = await channel.send(payload);
  return { id: message.id, channelId, platform: "discord" };
}

/**
 * Edit an existing message's content.
 */
export async function updateMessage(
  channel: TextChannel | ThreadChannel,
  messageId: string,
  content: MessageContent
): Promise<void> {
  const message = await channel.messages.fetch(messageId);

  if (isDocument(content)) {
    const embed = toDiscordEmbed(content.getBlocks());
    await message.edit({ embeds: [embed] });
  } else {
    const limit = MESSAGE_LIMITS.discord;
    const text =
      content.length > limit ? `${content.slice(0, limit - 1)}\u2026` : content;
    await message.edit({ content: text, embeds: [] });
  }
}

/**
 * Delete a message and optionally its thread replies.
 */
export async function deleteMessage(
  channel: TextChannel | ThreadChannel,
  messageId: string,
  options?: DeleteMessageOptions
): Promise<void> {
  const message = await channel.messages.fetch(messageId);
  if (options?.cascadeReplies !== false && message.thread) {
    await message.thread.delete();
  }
  await message.delete();
}

/**
 * Add an emoji reaction to a message.
 */
export async function addReaction(
  channel: TextChannel | ThreadChannel,
  messageId: string,
  emoji: string
): Promise<void> {
  const message = await channel.messages.fetch(messageId);
  await message.react(emoji);
}

/**
 * Remove the bot's own reaction from a message.
 */
export async function removeReaction(
  channel: TextChannel | ThreadChannel,
  messageId: string,
  emoji: string
): Promise<void> {
  const message = await channel.messages.fetch(messageId);
  const reaction = message.reactions.resolve(emoji);
  if (reaction) {
    await reaction.users.remove();
  }
}

/**
 * Remove all reactions from a message.
 */
export async function removeAllReactions(
  channel: TextChannel | ThreadChannel,
  messageId: string
): Promise<void> {
  const message = await channel.messages.fetch(messageId);
  await message.reactions.removeAll();
}
