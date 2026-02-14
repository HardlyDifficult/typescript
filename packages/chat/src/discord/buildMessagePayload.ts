import { AttachmentBuilder, MessageFlags } from "discord.js";

import { type DiscordEmbed, toDiscordEmbed } from "../outputters/discord.js";
import type { FileAttachment, MessageContent } from "../types.js";
import { isDocument } from "../utils.js";

export interface DiscordMessagePayload {
  content?: string;
  embeds?: DiscordEmbed[];
  messageReference?: { messageId: string };
  files?: AttachmentBuilder[];
  flags?: typeof MessageFlags.SuppressEmbeds;
}

/**
 * Build a Discord message payload from content and options.
 * Handles Document-to-embed conversion, file attachments, reply references,
 * and link preview suppression.
 */
export function buildMessagePayload(
  content: MessageContent,
  options?: {
    threadTs?: string;
    files?: FileAttachment[];
    linkPreviews?: boolean;
  }
): DiscordMessagePayload {
  let payload: DiscordMessagePayload;

  if (isDocument(content)) {
    const embed = toDiscordEmbed(content.getBlocks());
    const hasEmbedContent =
      embed.title !== undefined ||
      embed.description !== undefined ||
      embed.footer !== undefined ||
      embed.image !== undefined;

    payload = hasEmbedContent ? { embeds: [embed] } : { content: "\u200B" };
  } else {
    payload = { content };
  }

  // If threadTs is provided (non-empty), use it as a reply reference
  if (options?.threadTs !== undefined && options.threadTs !== "") {
    payload.messageReference = { messageId: options.threadTs };
  }

  // Add file attachments
  if (options?.files && options.files.length > 0) {
    payload.files = options.files.map(
      (file) =>
        new AttachmentBuilder(
          typeof file.content === "string"
            ? Buffer.from(file.content)
            : file.content,
          { name: file.name }
        )
    );
  }

  // Suppress link preview embeds by default
  if (options?.linkPreviews !== true) {
    payload.flags = MessageFlags.SuppressEmbeds;
  }

  return payload;
}
