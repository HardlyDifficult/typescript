import type { MessageContent, MessageData, MessageQueryOptions } from "./types.js";
import { isDocument } from "./utils.js";

const DUPLICATE_SUFFIX_RE = / x(\d+)$/;

/**
 * Parse a message's content to extract the base text and duplicate count.
 * "hello"    → { baseContent: "hello", count: 1 }
 * "hello x2" → { baseContent: "hello", count: 2 }
 * "hello x5" → { baseContent: "hello", count: 5 }
 */
export function parseDuplicateCount(content: string): {
  baseContent: string;
  count: number;
} {
  const match = content.match(DUPLICATE_SUFFIX_RE);
  if (match) {
    return {
      baseContent: content.slice(0, -match[0].length),
      count: parseInt(match[1], 10),
    };
  }
  return { baseContent: content, count: 1 };
}

/**
 * Try to deduplicate a message against the most recent bot message.
 *
 * If the last bot message has the same base content, edits it to increment
 * the counter (e.g. "hello" → "hello x2" → "hello x3") and returns
 * the original message data so that threading still points at the right place.
 *
 * Returns null when no dedup occurred and the caller should post normally.
 */
export async function tryDeduplicateMessage(
  content: MessageContent,
  getLastBotMessage: (
    options: MessageQueryOptions
  ) => Promise<MessageData[]>,
  updateMessage: (
    messageId: string,
    channelId: string,
    content: MessageContent
  ) => Promise<void>,
  options?: { files?: { content: Buffer | string; name: string }[] }
): Promise<MessageData | null> {
  // Only dedupe plain-string messages with no file attachments
  if (isDocument(content) || (options?.files && options.files.length > 0)) {
    return null;
  }

  const recent = await getLastBotMessage({ limit: 1, author: "me" });
  if (recent.length === 0) {
    return null;
  }

  const lastMsg = recent[0];
  if (lastMsg.content === undefined || lastMsg.content === "") {
    return null;
  }

  const { baseContent, count } = parseDuplicateCount(lastMsg.content);
  if (baseContent !== content) {
    return null;
  }

  const newContent = `${content} x${count + 1}`;
  await updateMessage(lastMsg.id, lastMsg.channelId, newContent);
  return { ...lastMsg, content: newContent };
}
