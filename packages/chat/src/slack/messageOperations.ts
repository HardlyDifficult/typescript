import { convertMarkdown } from "@hardlydifficult/document-generator";
import type { App } from "@slack/bolt";

import { MESSAGE_LIMITS } from "../constants.js";
import { type SlackBlock, toSlackBlocks } from "../outputters/slack.js";
import type { FileAttachment, MessageContent, MessageData } from "../types.js";
import { isDocument } from "../utils.js";

/**
 * Convert MessageContent to Slack's text + optional blocks.
 * Shared by postMessage and updateMessage.
 */
function convertContent(content: MessageContent): {
  text: string;
  blocks?: SlackBlock[];
} {
  if (isDocument(content)) {
    const plainText = content.toPlainText().trim();
    return {
      text: plainText !== "" ? plainText : "Message",
      blocks: toSlackBlocks(content.getBlocks()),
    };
  }
  return { text: convertMarkdown(content, "slack") };
}

/**
 * Post a message to a Slack channel.
 * Handles file attachments, oversized text (auto-uploads as file),
 * Document-to-blocks conversion, and link preview suppression.
 */
export async function postMessage(
  app: App,
  channelId: string,
  content: MessageContent,
  options?: {
    threadTs?: string;
    files?: FileAttachment[];
    linkPreviews?: boolean;
  }
): Promise<MessageData> {
  const { text, blocks } = convertContent(content);

  // Suppress link preview unfurling by default
  const unfurl =
    options?.linkPreviews === true
      ? {}
      : { unfurl_links: false, unfurl_media: false };

  // If files are provided, upload them and attach to the message
  if (options?.files && options.files.length > 0) {
    for (let i = 0; i < options.files.length; i++) {
      const file = options.files[i];

      // Build arguments conditionally - use separate calls for type safety
      const threadTs = options.threadTs;
      const hasThreadTs = threadTs !== undefined && threadTs !== "";

      if (typeof file.content === "string") {
        // String content case
        if (hasThreadTs) {
          await app.client.filesUploadV2({
            channel_id: channelId,
            filename: file.name,
            ...(i === 0 ? { initial_comment: text } : {}),
            thread_ts: threadTs,
            content: file.content,
          });
          continue;
        }
        await app.client.filesUploadV2({
          channel_id: channelId,
          filename: file.name,
          ...(i === 0 ? { initial_comment: text } : {}),
          content: file.content,
        });
        continue;
      }

      // Buffer content case
      if (hasThreadTs) {
        await app.client.filesUploadV2({
          channel_id: channelId,
          filename: file.name,
          ...(i === 0 ? { initial_comment: text } : {}),
          thread_ts: threadTs,
          file: file.content,
        });
        continue;
      }
      await app.client.filesUploadV2({
        channel_id: channelId,
        filename: file.name,
        ...(i === 0 ? { initial_comment: text } : {}),
        file: file.content,
      });
    }

    // Post the text message separately if there are also blocks (rich document)
    if (blocks) {
      const result = await app.client.chat.postMessage({
        channel: channelId,
        text,
        blocks,
        thread_ts: options.threadTs,
        ...unfurl,
      });
      if (result.ts === undefined) {
        throw new Error("Slack API did not return a message timestamp");
      }
      return { id: result.ts, channelId, platform: "slack" };
    }

    // File uploads create messages implicitly; the Slack API doesn't reliably
    // return a message timestamp from filesUploadV2, so return empty ID.
    return { id: "", channelId, platform: "slack" };
  }

  // If text exceeds Slack's limit, upload as a file instead
  if (text.length > MESSAGE_LIMITS.slack) {
    const threadTs = options?.threadTs;
    if (threadTs !== undefined && threadTs !== "") {
      await app.client.filesUploadV2({
        channel_id: channelId,
        filename: "message.txt",
        initial_comment: "(Message too long \u2014 see attached file)",
        thread_ts: threadTs,
        content: text,
      });
      return { id: "", channelId, platform: "slack" };
    }
    await app.client.filesUploadV2({
      channel_id: channelId,
      filename: "message.txt",
      initial_comment: "(Message too long \u2014 see attached file)",
      content: text,
    });
    return { id: "", channelId, platform: "slack" };
  }

  const result = await app.client.chat.postMessage({
    channel: channelId,
    text,
    blocks,
    thread_ts: options?.threadTs,
    ...unfurl,
  });

  if (result.ts === undefined) {
    throw new Error("Slack API did not return a message timestamp");
  }
  return {
    id: result.ts,
    channelId,
    platform: "slack",
  };
}

/**
 * Update an existing message. Truncates with "…" if content exceeds Slack's
 * limit, since edits cannot attach files.
 */
export async function updateMessage(
  app: App,
  messageId: string,
  channelId: string,
  content: MessageContent
): Promise<void> {
  const converted = convertContent(content);
  let { text } = converted;
  const { blocks } = converted;

  // Truncate if over limit (edits cannot attach files)
  const limit = MESSAGE_LIMITS.slack;
  if (text.length > limit) {
    text = `${text.slice(0, limit - 1)}\u2026`;
  }

  await app.client.chat.update({
    channel: channelId,
    ts: messageId,
    text,
    blocks,
  });
}

/**
 * Delete a message and its thread replies.
 */
export async function deleteMessage(
  app: App,
  messageId: string,
  channelId: string
): Promise<void> {
  // Fetch and delete thread replies first
  const replies = await app.client.conversations.replies({
    channel: channelId,
    ts: messageId,
  });

  if (replies.messages && replies.messages.length > 1) {
    // First message is the parent — delete replies (rest) in reverse order
    for (const reply of replies.messages.slice(1).reverse()) {
      if (reply.ts !== undefined && reply.ts !== "") {
        await app.client.chat.delete({
          channel: channelId,
          ts: reply.ts,
        });
      }
    }
  }

  // Delete the parent message
  await app.client.chat.delete({
    channel: channelId,
    ts: messageId,
  });
}
