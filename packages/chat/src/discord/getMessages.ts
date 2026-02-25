import { secondsToMilliseconds } from "@hardlydifficult/date-time";
import type { TextChannel, ThreadChannel } from "discord.js";

import type {
  Attachment,
  MessageData,
  MessageQueryOptions,
  TimestampInput,
} from "../types.js";

/**
 * Fetch and normalize recent Discord messages with optional filters.
 */
export async function getMessages(
  channel: TextChannel | ThreadChannel,
  channelId: string,
  options: MessageQueryOptions = {},
  meId?: string
): Promise<MessageData[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const messages = await channel.messages.fetch({ limit });
  const afterDate = toDate(options.after);
  const beforeDate = toDate(options.before);

  let authorFilter: string | undefined;
  if (options.author === "me") {
    authorFilter = meId;
  } else if (options.author !== undefined) {
    authorFilter = normalizeAuthorFilter(options.author);
  }

  const output: MessageData[] = [];
  for (const [, message] of messages) {
    if (afterDate !== undefined && message.createdAt <= afterDate) {
      continue;
    }
    if (beforeDate !== undefined && message.createdAt >= beforeDate) {
      continue;
    }

    const authorId = message.author.id;
    const authorUsername = message.author.username;
    if (authorFilter !== undefined) {
      const normalizedUsername = authorUsername.toLowerCase();
      if (
        authorId !== authorFilter &&
        normalizedUsername !== authorFilter.toLowerCase()
      ) {
        continue;
      }
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

    output.push({
      id: message.id,
      channelId,
      platform: "discord",
      content: message.content,
      author: { id: authorId, username: authorUsername },
      timestamp: message.createdAt,
      attachments,
    });
  }

  return output;
}

function toDate(input: TimestampInput | undefined): Date | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? undefined : input;
  }
  if (typeof input === "number") {
    const ms = input > 10_000_000_000 ? input : secondsToMilliseconds(input);
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const trimmed = input.trim();
  if (trimmed === "") {
    return undefined;
  }
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return toDate(Number(trimmed));
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeAuthorFilter(author: string): string {
  const trimmed = author.trim();
  const mentionMatch = /^<@([^>]+)>$/.exec(trimmed);
  if (mentionMatch?.[1] !== undefined && mentionMatch[1] !== "") {
    return mentionMatch[1];
  }
  return trimmed.replace(/^@/, "").toLowerCase();
}
