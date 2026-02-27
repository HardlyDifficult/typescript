import type { TextChannel, ThreadChannel } from "discord.js";

/** Discord API error code for a message that no longer exists */
const UNKNOWN_MESSAGE_CODE = 10008;

function isUnknownMessageError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === UNKNOWN_MESSAGE_CODE
  );
}

/** Add a reaction to a message, ignoring errors if the message was deleted */
export async function addReaction(
  channel: TextChannel | ThreadChannel,
  messageId: string,
  emoji: string
): Promise<void> {
  try {
    const message = await channel.messages.fetch(messageId);
    await message.react(emoji);
  } catch (error: unknown) {
    if (isUnknownMessageError(error)) {
      return;
    }
    throw error;
  }
}

/** Remove the bot's own reaction from a message, ignoring errors if the message was deleted */
export async function removeReaction(
  channel: TextChannel | ThreadChannel,
  messageId: string,
  emoji: string
): Promise<void> {
  try {
    const message = await channel.messages.fetch(messageId);
    const reaction = message.reactions.resolve(emoji);
    if (reaction) {
      await reaction.users.remove();
    }
  } catch (error: unknown) {
    if (isUnknownMessageError(error)) {
      return;
    }
    throw error;
  }
}

/** Remove all reactions from a message, ignoring errors if the message was deleted */
export async function removeAllReactions(
  channel: TextChannel | ThreadChannel,
  messageId: string
): Promise<void> {
  try {
    const message = await channel.messages.fetch(messageId);
    await message.reactions.removeAll();
  } catch (error: unknown) {
    if (isUnknownMessageError(error)) {
      return;
    }
    throw error;
  }
}
