import { type Client, ThreadChannel } from "discord.js";

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
