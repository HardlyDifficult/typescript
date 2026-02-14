import { type Client, type TextChannel, ThreadChannel } from "discord.js";

import type { ThreadData } from "../types.js";

/**
 * Create a thread from a message in a Discord text channel.
 */
export async function startThread(
  channel: TextChannel | ThreadChannel,
  messageId: string,
  channelId: string,
  name: string,
  autoArchiveDuration?: number
): Promise<ThreadData> {
  const message = await channel.messages.fetch(messageId);
  const thread = await message.startThread({
    name,
    autoArchiveDuration: autoArchiveDuration as
      | 60
      | 1440
      | 4320
      | 10080
      | undefined,
  });

  return {
    id: thread.id,
    channelId,
    platform: "discord",
  };
}

/**
 * Get all threads (active and archived) in a Discord text channel.
 */
export async function getThreads(
  channel: TextChannel,
  channelId: string
): Promise<ThreadData[]> {
  const threads: ThreadData[] = [];

  const activeThreads = await channel.threads.fetchActive();
  for (const [threadId] of activeThreads.threads) {
    threads.push({ id: threadId, channelId, platform: "discord" });
  }

  const archivedThreads = await channel.threads.fetchArchived();
  for (const [threadId] of archivedThreads.threads) {
    threads.push({ id: threadId, channelId, platform: "discord" });
  }

  return threads;
}

/**
 * Delete a thread by its ID.
 * Fetches the thread channel and calls delete().
 */
export async function deleteThread(
  client: Client,
  threadId: string
): Promise<void> {
  const thread = await client.channels.fetch(threadId);
  if (!thread || !(thread instanceof ThreadChannel)) {
    throw new Error(`Thread ${threadId} not found`);
  }
  await thread.delete();
}
