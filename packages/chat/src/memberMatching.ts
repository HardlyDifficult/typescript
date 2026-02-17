import type { Member } from "./types.js";

const MENTION_ID_REGEX = /^<@([^>|]+)(?:\|[^>]+)?>$/;

function normalizeLookup(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Extract a user ID from a mention string like "<@U123>".
 */
export function extractMentionId(input: string): string | null {
  const trimmed = input.trim();
  const match = MENTION_ID_REGEX.exec(trimmed);
  if (match?.[1] !== undefined && match[1] !== "") {
    return match[1];
  }
  return null;
}

interface MemberAlias {
  value: string;
  weight: number;
}

function buildMemberAliases(member: Member): MemberAlias[] {
  const aliases: MemberAlias[] = [
    { value: member.id, weight: 0 },
    { value: member.mention, weight: 0 },
    { value: member.username, weight: 1 },
    { value: member.displayName, weight: 2 },
  ];

  if (member.email !== undefined && member.email !== "") {
    aliases.push({ value: member.email, weight: 1 });
    const localPart = member.email.split("@")[0];
    if (localPart !== "") {
      aliases.push({ value: localPart, weight: 2 });
    }
  }

  const normalizedUsername = member.username.replace(/^@/, "");
  if (normalizedUsername !== "") {
    aliases.push({ value: normalizedUsername, weight: 1 });
    for (const part of normalizedUsername.split(/[._-]/)) {
      if (part !== "") {
        aliases.push({ value: part, weight: 3 });
      }
    }
  }

  const firstName = member.displayName.trim().split(/\s+/)[0] ?? "";
  if (firstName !== "") {
    aliases.push({ value: firstName, weight: 3 });
  }

  return aliases;
}

/**
 * Find the best fuzzy match for a member query.
 * Returns null when no match or an ambiguous tie exists.
 */
export function findBestMemberMatch(
  members: Member[],
  rawQuery: string
): Member | null {
  const query = rawQuery.trim();
  if (query === "") {
    return null;
  }

  const mentionId = extractMentionId(query);
  const directIdQuery = mentionId ?? query.replace(/^@/, "");
  const directMatch = members.find((member) => member.id === directIdQuery);
  if (directMatch !== undefined) {
    return directMatch;
  }

  const normalizedQuery = normalizeLookup(query.replace(/^@/, ""));
  if (normalizedQuery === "") {
    return null;
  }

  let bestScore = Number.POSITIVE_INFINITY;
  let bestMember: Member | null = null;
  let isAmbiguous = false;

  for (const member of members) {
    const aliases = buildMemberAliases(member);
    let memberScore = Number.POSITIVE_INFINITY;
    const queryLongEnoughForPrefix = normalizedQuery.length >= 2;
    const queryLongEnoughForContains = normalizedQuery.length >= 3;

    for (const alias of aliases) {
      const normalizedAlias = normalizeLookup(alias.value);
      if (normalizedAlias === "") {
        continue;
      }
      if (normalizedAlias === normalizedQuery) {
        memberScore = Math.min(memberScore, alias.weight);
        continue;
      }
      if (
        queryLongEnoughForPrefix &&
        normalizedAlias.startsWith(normalizedQuery)
      ) {
        memberScore = Math.min(memberScore, alias.weight + 10);
        continue;
      }
      if (
        queryLongEnoughForContains &&
        normalizedAlias.includes(normalizedQuery)
      ) {
        memberScore = Math.min(memberScore, alias.weight + 20);
      }
    }

    if (!Number.isFinite(memberScore)) {
      continue;
    }

    if (memberScore < bestScore) {
      bestScore = memberScore;
      bestMember = member;
      isAmbiguous = false;
    } else if (
      memberScore === bestScore &&
      bestMember !== null &&
      bestMember.id !== member.id
    ) {
      isAmbiguous = true;
    }
  }

  if (isAmbiguous) {
    return null;
  }
  return bestMember;
}
