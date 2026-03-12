import { describe, it, expect } from "vitest";
import {
  extractMentionId,
  findBestMemberMatch,
} from "../src/memberMatching.js";
import type { Member } from "../src/types.js";

const makeMember = (overrides: Partial<Member> = {}): Member => ({
  id: "U123",
  username: "jsmith",
  displayName: "John Smith",
  mention: "<@U123>",
  ...overrides,
});

describe("extractMentionId", () => {
  it("extracts user ID from a mention string", () => {
    expect(extractMentionId("<@U123ABC>")).toBe("U123ABC");
  });

  it("extracts user ID from a mention with display name", () => {
    expect(extractMentionId("<@U123|jsmith>")).toBe("U123");
  });

  it("returns null for non-mention strings", () => {
    expect(extractMentionId("jsmith")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractMentionId("")).toBeNull();
  });

  it("returns null for whitespace", () => {
    expect(extractMentionId("   ")).toBeNull();
  });
});

describe("findBestMemberMatch", () => {
  it("returns null for empty query", () => {
    const members = [makeMember()];
    expect(findBestMemberMatch(members, "")).toBeNull();
  });

  it("returns null for whitespace query", () => {
    const members = [makeMember()];
    expect(findBestMemberMatch(members, "   ")).toBeNull();
  });

  it("matches by user ID directly", () => {
    const member = makeMember({ id: "U123" });
    const result = findBestMemberMatch([member], "U123");
    expect(result).toBe(member);
  });

  it("matches by mention", () => {
    const member = makeMember({ id: "U123", mention: "<@U123>" });
    const result = findBestMemberMatch([member], "<@U123>");
    expect(result).toBe(member);
  });

  it("matches by @username", () => {
    const member = makeMember({ username: "@alice" });
    const result = findBestMemberMatch([member], "@alice");
    expect(result).toBe(member);
  });

  it("returns null when query normalizes to empty string", () => {
    const member = makeMember();
    // Query has only special chars that get stripped in normalization
    const result = findBestMemberMatch([member], "@");
    expect(result).toBeNull();
  });

  it("matches by email local part", () => {
    const member = makeMember({ email: "john@example.com" });
    const result = findBestMemberMatch([member], "john@example.com");
    expect(result).toBe(member);
  });

  it("matches by email address", () => {
    const member = makeMember({ email: "john@example.com" });
    const result = findBestMemberMatch([member], "john");
    expect(result).toBe(member);
  });

  it("matches by username part (prefix)", () => {
    const member = makeMember({ username: "john.doe" });
    const result = findBestMemberMatch([member], "jo");
    expect(result).toBe(member);
  });

  it("matches by first name from displayName", () => {
    const member = makeMember({ displayName: "Jane Doe" });
    const result = findBestMemberMatch([member], "jan");
    expect(result).toBe(member);
  });

  it("returns null when ambiguous (two equal-score matches)", () => {
    const m1 = makeMember({
      id: "U1",
      username: "alice",
      displayName: "Alice A",
    });
    const m2 = makeMember({
      id: "U2",
      username: "alice",
      displayName: "Alice B",
    });
    const result = findBestMemberMatch([m1, m2], "alice");
    expect(result).toBeNull();
  });

  it("returns null when no member matches", () => {
    const member = makeMember({
      id: "U999",
      username: "zz_nobody",
      displayName: "Nobody Z",
    });
    const result = findBestMemberMatch([member], "xyznotfound");
    expect(result).toBeNull();
  });

  it("matches by partial username (contains)", () => {
    const member = makeMember({ username: "john.smith.jr" });
    const result = findBestMemberMatch([member], "smi");
    expect(result).toBe(member);
  });

  it("skips alias with empty normalized value (mention that normalizes to empty)", () => {
    // The member has a mention of "@---" which normalizes to "" (all non-alphanumeric)
    // This exercises the `if (normalizedAlias === "") continue` branch (line 98)
    const member = makeMember({
      id: "u_test",
      username: "testuser",
      displayName: "Test User",
      mention: "@---",
    });
    const result = findBestMemberMatch([member], "testuser");
    expect(result).toBe(member);
  });
});
