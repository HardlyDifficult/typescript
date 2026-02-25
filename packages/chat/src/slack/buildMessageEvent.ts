import { secondsToMilliseconds } from "@hardlydifficult/date-time";

import type { Attachment, MessageEvent, User } from "../types.js";

/** Subset of Slack message event fields used for building a MessageEvent */
export interface SlackMessagePayload {
  channel: string;
  user?: string;
  ts?: string;
  text?: string;
  thread_ts?: string;
  bot_id?: string;
  files?: SlackFile[];
}

interface SlackFile {
  url_private?: string;
  name?: string;
  mimetype?: string | null;
  size?: number;
}

/**
 * Build a platform-agnostic MessageEvent from a Slack event payload.
 */
export function buildMessageEvent(event: SlackMessagePayload): MessageEvent {
  const channelId = event.channel;

  const user: User = {
    id: event.user ?? "",
    username: undefined,
  };

  const attachments: Attachment[] = [];
  if (event.files) {
    for (const file of event.files) {
      const url = file.url_private ?? "";
      const name = file.name ?? "";

      if (url === "" || name === "") {
        continue;
      }

      attachments.push({
        url,
        name,
        contentType:
          file.mimetype !== null &&
          file.mimetype !== undefined &&
          file.mimetype !== ""
            ? file.mimetype
            : undefined,
        size: file.size,
      });
    }
  }

  return {
    id: event.ts ?? "",
    content: event.text ?? "",
    author: user,
    channelId,
    timestamp:
      event.ts !== undefined
        ? new Date(secondsToMilliseconds(parseFloat(event.ts)))
        : new Date(),
    attachments,
  };
}
