import { describe, expect, it, vi } from "vitest";

import { Channel, type ChannelOperations } from "../src/Channel.js";
import { Message } from "../src/Message.js";
import type { MessageData } from "../src/types.js";

function createMockOperations(): ChannelOperations {
  return {
    postMessage: vi.fn().mockResolvedValue({
      id: "msg-1",
      channelId: "channel-1",
      platform: "slack",
    }),
    updateMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    removeAllReactions: vi.fn().mockResolvedValue(undefined),
    subscribeToReactions: vi.fn().mockReturnValue(() => {}),
    subscribeToMessages: vi.fn().mockReturnValue(() => {}),
    sendTyping: vi.fn().mockResolvedValue(undefined),
    startThread: vi.fn().mockResolvedValue({
      id: "thread-1",
      channelId: "channel-1",
      platform: "slack",
    }),
    bulkDelete: vi.fn().mockResolvedValue(0),
    getMessages: vi.fn().mockResolvedValue([]),
    getThreads: vi.fn().mockResolvedValue([]),
    deleteThread: vi.fn().mockResolvedValue(undefined),
    getMembers: vi.fn().mockResolvedValue([]),
    onDisconnect: vi.fn().mockReturnValue(() => {}),
    onError: vi.fn().mockReturnValue(() => {}),
    subscribeToThread: vi.fn().mockReturnValue(() => {}),
    postToThread: vi.fn().mockResolvedValue({
      id: "reply-1",
      channelId: "channel-1",
      platform: "slack",
    }),
  };
}

describe("Channel feature helpers", () => {
  it("resolveMention() matches username/display name/email queries", async () => {
    const operations = createMockOperations();
    vi.mocked(operations.getMembers).mockResolvedValue([
      {
        id: "U1",
        username: "nick",
        displayName: "Nick Mancuso",
        mention: "<@U1>",
        email: "nick@example.com",
      },
    ]);
    const channel = new Channel("channel-1", "slack", operations);

    await expect(channel.resolveMention("@nick")).resolves.toBe("<@U1>");
    await expect(channel.resolveMention("Nick Mancuso")).resolves.toBe("<@U1>");
    await expect(channel.resolveMention("nick@example.com")).resolves.toBe(
      "<@U1>"
    );
  });

  it("resolveMention() returns null for ambiguous fuzzy matches", async () => {
    const operations = createMockOperations();
    vi.mocked(operations.getMembers).mockResolvedValue([
      {
        id: "U1",
        username: "mancuso",
        displayName: "Nick Mancuso",
        mention: "<@U1>",
      },
      {
        id: "U2",
        username: "thompson",
        displayName: "Nick Thompson",
        mention: "<@U2>",
      },
    ]);
    const channel = new Channel("channel-1", "slack", operations);

    await expect(channel.resolveMention("Nick")).resolves.toBeNull();
  });

  it("getMessages() resolves author queries to member IDs", async () => {
    const operations = createMockOperations();
    vi.mocked(operations.getMembers).mockResolvedValue([
      {
        id: "U1",
        username: "alice",
        displayName: "Alice Adams",
        mention: "<@U1>",
      },
    ]);
    vi.mocked(operations.getMessages).mockResolvedValue([
      {
        id: "111.111",
        channelId: "channel-1",
        platform: "slack",
        content: "hello",
      },
    ]);
    const channel = new Channel("channel-1", "slack", operations);

    const messages = await channel.getMessages({ author: "Alice" });

    expect(operations.getMessages).toHaveBeenCalledWith("channel-1", {
      author: "U1",
    });
    expect(messages).toHaveLength(1);
    expect(messages[0]).toBeInstanceOf(Message);
  });

  it("getRecentBotMessages() uses author=me filter", async () => {
    const operations = createMockOperations();
    const channel = new Channel("channel-1", "slack", operations);

    await channel.getRecentBotMessages(25);

    expect(operations.getMessages).toHaveBeenCalledWith("channel-1", {
      limit: 25,
      author: "me",
    });
  });

  it("pruneMessages() keeps newest N and deletes the rest", async () => {
    const operations = createMockOperations();
    const history: MessageData[] = [
      { id: "m1", channelId: "channel-1", platform: "slack", content: "one" },
      { id: "m2", channelId: "channel-1", platform: "slack", content: "two" },
      {
        id: "m3",
        channelId: "channel-1",
        platform: "slack",
        content: "three",
      },
    ];
    vi.mocked(operations.getMessages).mockResolvedValue(history);
    const channel = new Channel("channel-1", "slack", operations);

    const deleted = await channel.pruneMessages({
      keep: 1,
      cascadeReplies: false,
    });

    expect(deleted).toBe(2);
    expect(operations.deleteMessage).toHaveBeenNthCalledWith(1, "m2", "channel-1", {
      cascadeReplies: false,
    });
    expect(operations.deleteMessage).toHaveBeenNthCalledWith(2, "m3", "channel-1", {
      cascadeReplies: false,
    });
  });
});
