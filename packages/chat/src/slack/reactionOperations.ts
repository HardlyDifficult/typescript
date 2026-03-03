import type { App } from "@slack/bolt";

function stripColons(emoji: string): string {
  return emoji.replace(/^:|:$/g, "");
}

/**
 *
 */
/** Add a reaction emoji to a Slack message. */
export async function addReaction(
  app: App,
  messageId: string,
  channelId: string,
  emoji: string
): Promise<void> {
  await app.client.reactions.add({
    channel: channelId,
    timestamp: messageId,
    name: stripColons(emoji),
  });
}

/**
 *
 */
/** Remove a reaction emoji from a Slack message. */
export async function removeReaction(
  app: App,
  messageId: string,
  channelId: string,
  emoji: string
): Promise<void> {
  await app.client.reactions.remove({
    channel: channelId,
    timestamp: messageId,
    name: stripColons(emoji),
  });
}
