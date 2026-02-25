import type { App } from "@slack/bolt";

import type {
  MessageData,
  MessageQueryOptions,
  TimestampInput,
} from "../types.js";

interface SlackFileAttachment {
  url_private?: string;
  name?: string;
  mimetype?: string | null;
  size?: number;
}

interface SlackHistoryMessage {
  ts?: string;
  text?: string;
  user?: string;
  username?: string;
  bot_id?: string;
  files?: SlackFileAttachment[];
}

interface MessageFilterContext {
  meId?: string;
  botId?: string | null;
}

/**
 * Fetch and normalize recent Slack messages with optional filters.
 */
export async function getMessages(
  app: App,
  channelId: string,
  options: MessageQueryOptions = {},
  context: MessageFilterContext = {}
): Promise<MessageData[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const oldest = toSlackTimestamp(options.after);
  const latest = toSlackTimestamp(options.before);
  const afterDate = toDate(options.after);
  const beforeDate = toDate(options.before);

  const history = await app.client.conversations.history({
    channel: channelId,
    limit,
    ...(oldest !== undefined ? { oldest } : {}),
    ...(latest !== undefined ? { latest } : {}),
    ...(oldest !== undefined || latest !== undefined
      ? { inclusive: false }
      : {}),
  });

  const messages: MessageData[] = [];
  for (const rawMessage of history.messages ?? []) {
    const message = rawMessage as SlackHistoryMessage;
    if (message.ts === undefined || message.ts === "") {
      continue;
    }

    const timestamp = new Date(parseFloat(message.ts) * 1000);
    if (!Number.isFinite(timestamp.getTime())) {
      continue;
    }
    if (afterDate !== undefined && timestamp <= afterDate) {
      continue;
    }
    if (beforeDate !== undefined && timestamp >= beforeDate) {
      continue;
    }
    if (!matchesAuthorFilter(message, options.author, context)) {
      continue;
    }

    const authorId = message.user ?? message.bot_id;
    messages.push({
      id: message.ts,
      channelId,
      platform: "slack",
      content: message.text ?? "",
      author:
        authorId !== undefined
          ? {
              id: authorId,
              username:
                message.username !== undefined && message.username !== ""
                  ? message.username
                  : undefined,
            }
          : undefined,
      timestamp,
      attachments: extractSlackAttachments(message),
    });
  }

  return messages;
}

function matchesAuthorFilter(
  message: SlackHistoryMessage,
  author: MessageQueryOptions["author"],
  context: MessageFilterContext
): boolean {
  if (author === undefined) {
    return true;
  }
  if (author === "me") {
    return (
      (context.meId !== undefined &&
        context.meId !== "" &&
        message.user === context.meId) ||
      (context.botId !== undefined &&
        context.botId !== null &&
        context.botId !== "" &&
        message.bot_id === context.botId)
    );
  }

  const normalizedAuthor = normalizeAuthorFilter(author);
  return (
    (message.user !== undefined && message.user === normalizedAuthor) ||
    (message.bot_id !== undefined && message.bot_id === normalizedAuthor)
  );
}

function toSlackTimestamp(
  input: TimestampInput | undefined
): string | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (input instanceof Date) {
    return String(input.getTime() / 1000);
  }
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      return undefined;
    }
    return String(input);
  }
  const trimmed = input.trim();
  if (trimmed === "") {
    return undefined;
  }
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return trimmed;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return String(date.getTime() / 1000);
}

function toDate(input: TimestampInput | undefined): Date | undefined {
  if (input === undefined) {
    return undefined;
  }
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? undefined : input;
  }
  if (typeof input === "number") {
    const ms = input > 10_000_000_000 ? input : input * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  const trimmed = input.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return toDate(Number(trimmed));
  }
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function normalizeAuthorFilter(author: string): string {
  const mentionMatch = /^<@([^>|]+)(?:\|[^>]+)?>$/.exec(author.trim());
  if (mentionMatch?.[1] !== undefined && mentionMatch[1] !== "") {
    return mentionMatch[1];
  }
  return author.trim().replace(/^@/, "");
}

function extractSlackAttachments(message: SlackHistoryMessage) {
  const attachments: NonNullable<MessageData["attachments"]> = [];
  for (const file of message.files ?? []) {
    const { url_private: url, name, mimetype, size } = file;
    if (url === undefined || url === "" || name === undefined || name === "") {
      continue;
    }
    attachments.push({
      url,
      name,
      contentType:
        mimetype !== undefined && mimetype !== null && mimetype !== ""
          ? mimetype
          : undefined,
      size,
    });
  }
  return attachments;
}
