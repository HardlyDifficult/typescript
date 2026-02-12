import type { App } from "@slack/bolt";

/**
 * Remove all of the bot's reactions from a message.
 * Slack only allows removing the authenticated user's own reactions,
 * so this fetches all reactions then removes the bot's for each emoji.
 */
export async function removeAllReactions(
  app: App,
  messageId: string,
  channelId: string
): Promise<void> {
  const result = await app.client.reactions.get({
    channel: channelId,
    timestamp: messageId,
  });

  const reactions = result.message?.reactions;
  if (reactions === undefined) {
    return;
  }

  for (const reaction of reactions) {
    if (reaction.name !== undefined && reaction.name !== "") {
      try {
        await app.client.reactions.remove({
          channel: channelId,
          timestamp: messageId,
          name: reaction.name,
        });
      } catch {
        // Bot may not have reacted with this emoji — ignore
      }
    }
  }
}
