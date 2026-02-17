import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetBatchStore } from "../src/BatchStore.js";
import { Channel, type ChannelOperations } from "../src/Channel.js";
import { Message } from "../src/Message.js";
import { MessageBatch } from "../src/MessageBatch.js";
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
  beforeEach(() => {
    resetBatchStore();
  });

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
    expect(operations.deleteMessage).toHaveBeenNthCalledWith(
      1,
      "m2",
      "channel-1",
      {
        cascadeReplies: false,
      }
    );
    expect(operations.deleteMessage).toHaveBeenNthCalledWith(
      2,
      "m3",
      "channel-1",
      {
        cascadeReplies: false,
      }
    );
  });

  it("beginBatch() tracks posted messages and can be retrieved", async () => {
    const operations = createMockOperations();
    vi.mocked(operations.postMessage)
      .mockResolvedValueOnce({
        id: "b1",
        channelId: "channel-batch-1",
        platform: "slack",
      })
      .mockResolvedValueOnce({
        id: "b2",
        channelId: "channel-batch-1",
        platform: "slack",
      });

    const channel = new Channel("channel-batch-1", "slack", operations);
    const batch = await channel.beginBatch({ key: "sprint-update" });
    await batch.post("first");
    await batch.post("second");
    await batch.finish();

    expect(batch).toBeInstanceOf(MessageBatch);
    expect(batch.messages.map((message) => message.id)).toEqual(["b1", "b2"]);
    expect(batch.isFinished).toBe(true);
    expect(batch.closedAt).toBeInstanceOf(Date);

    const listed = await channel.getBatches({
      key: "sprint-update",
      author: "me",
      limit: 5,
    });
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(batch.id);
    expect((await channel.getBatch(batch.id))?.id).toBe(batch.id);
  });

  it("withBatch() auto-finishes in finally even when callback throws", async () => {
    const operations = createMockOperations();
    vi.mocked(operations.postMessage).mockResolvedValue({
      id: "wf-1",
      channelId: "channel-batch-2",
      platform: "slack",
    });
    const channel = new Channel("channel-batch-2", "slack", operations);

    await expect(
      channel.withBatch({ key: "fail-run" }, async (batch) => {
        await batch.post("before throw");
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    const [stored] = await channel.getBatches({ key: "fail-run", limit: 1 });
    expect(stored).toBeDefined();
    expect(stored.isFinished).toBe(true);
  });

  it("deleteAll() deletes tracked messages and reports failures", async () => {
    const operations = createMockOperations();
    vi.mocked(operations.postMessage)
      .mockResolvedValueOnce({
        id: "d1",
        channelId: "channel-batch-3",
        platform: "slack",
      })
      .mockResolvedValueOnce({
        id: "d2",
        channelId: "channel-batch-3",
        platform: "slack",
      });
    vi.mocked(operations.deleteMessage)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("cannot delete"));

    const channel = new Channel("channel-batch-3", "slack", operations);
    const batch = await channel.beginBatch({ key: "cleanup" });
    await batch.post("one");
    await batch.post("two");

    const summary = await batch.deleteAll({ cascadeReplies: false });
    expect(summary).toEqual({ deleted: 1, failed: 1 });
    expect(operations.deleteMessage).toHaveBeenNthCalledWith(
      1,
      "d1",
      "channel-batch-3",
      { cascadeReplies: false }
    );
    expect(operations.deleteMessage).toHaveBeenNthCalledWith(
      2,
      "d2",
      "channel-batch-3",
      { cascadeReplies: false }
    );
  });

  it("keepLatest(n) retains newest refs and deletes older ones", async () => {
    const operations = createMockOperations();
    vi.mocked(operations.postMessage)
      .mockResolvedValueOnce({
        id: "k1",
        channelId: "channel-batch-4",
        platform: "slack",
      })
      .mockResolvedValueOnce({
        id: "k2",
        channelId: "channel-batch-4",
        platform: "slack",
      })
      .mockResolvedValueOnce({
        id: "k3",
        channelId: "channel-batch-4",
        platform: "slack",
      });

    const channel = new Channel("channel-batch-4", "slack", operations);
    const batch = await channel.beginBatch({ key: "keep-latest" });
    await batch.post("one");
    await batch.post("two");
    await batch.post("three");

    const summary = await batch.keepLatest(1);
    expect(summary.deleted).toBe(2);
    expect(summary.failed).toBe(0);
    expect(summary.kept).toBe(1);
    expect(batch.messages).toHaveLength(1);
  });
});
