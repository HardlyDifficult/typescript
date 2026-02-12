import type { TextChannel } from "discord.js";

import type { Member } from "../types.js";

/**
 * Fetch all guild members who can view the given channel.
 * Uses the REST API with pagination (1000 members per request).
 */
export async function fetchChannelMembers(
  channel: TextChannel
): Promise<Member[]> {
  const members: Member[] = [];
  let after: string | undefined;

  for (;;) {
    const batch = await channel.guild.members.list({ limit: 1000, after });
    if (batch.size === 0) break;

    for (const [, member] of batch) {
      if (channel.permissionsFor(member).has("ViewChannel")) {
        members.push({
          id: member.id,
          username: member.user.username,
          displayName: member.displayName,
          mention: `<@${member.id}>`,
        });
      }
    }

    if (batch.size < 1000) break;
    after = batch.lastKey();
  }

  return members;
}
