import type { App } from "@slack/bolt";

import type { Member } from "../types.js";

/**
 * Fetch all members of a Slack channel via conversations.members + users.info.
 * Handles pagination for both the member list and user info lookups.
 */
export async function fetchChannelMembers(
  app: App,
  channelId: string
): Promise<Member[]> {
  const memberIds: string[] = [];
  let cursor: string | undefined;

  do {
    const result = await app.client.conversations.members({
      channel: channelId,
      limit: 200,
      cursor,
    });

    if (result.members) {
      memberIds.push(...result.members);
    }

    const nextCursor = result.response_metadata?.next_cursor;
    cursor =
      nextCursor !== undefined && nextCursor !== "" ? nextCursor : undefined;
  } while (cursor !== undefined);

  const members: Member[] = [];
  for (const userId of memberIds) {
    const info = await app.client.users.info({ user: userId });
    if (info.user) {
      const u = info.user;
      const profile = u.profile as { display_name?: string } | undefined;
      const name = u.name ?? userId;
      const rawDisplayName = profile?.display_name;
      const rawRealName = u.real_name;
      const displayName =
        (rawDisplayName !== undefined && rawDisplayName !== ""
          ? rawDisplayName
          : undefined) ??
        (rawRealName !== undefined && rawRealName !== ""
          ? rawRealName
          : undefined) ??
        name;
      members.push({
        id: userId,
        username: name,
        displayName,
        mention: `<@${userId}>`,
      });
    }
  }

  return members;
}
