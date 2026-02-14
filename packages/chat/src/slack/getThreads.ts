import type { App } from "@slack/bolt";

import type { ThreadData } from "../types.js";

/**
 * Get all threads (messages with replies) in a Slack channel.
 */
export async function getThreads(
  app: App,
  channelId: string
): Promise<ThreadData[]> {
  const threads: ThreadData[] = [];

  const history = await app.client.conversations.history({
    channel: channelId,
    limit: 200,
  });

  if (history.messages) {
    for (const msg of history.messages) {
      if (
        msg.reply_count !== undefined &&
        msg.reply_count > 0 &&
        msg.ts !== undefined &&
        msg.ts !== ""
      ) {
        threads.push({
          id: msg.ts,
          channelId,
          platform: "slack",
        });
      }
    }
  }

  return threads;
}
