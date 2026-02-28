import { describe, expect, it, vi, type Mock } from "vitest";

import { Channel, type ChannelOperations } from "../src/Channel.js";
import { resetBatchStore } from "../src/BatchStore.js";
import {
  parseDuplicateCount,
  tryDeduplicateMessage,
} from "../src/duplicateCounter.js";
import type { MessageData } from "../src/types.js";
import { Thread, type ThreadOperations } from "../src/Thread.js";

// ---------------------------------------------------------------------------
// Unit tests for parseDuplicateCount
// ---------------------------------------------------------------------------

describe("parseDuplicateCount", () => {
  it("returns count 1 for plain text", () => {
    expect(parseDuplicateCount("hello")).toEqual({
      baseContent: "hello",
      count: 1,
    });
  });

  it("parses x2 suffix", () => {
    expect(parseDuplicateCount("hello x2")).toEqual({
      baseContent: "hello",
      count: 2,
    });
  });

  it("parses x10 suffix", () => {
    expect(parseDuplicateCount("hello x10")).toEqual({
      baseContent: "hello",
      count: 10,
    });
  });

  it("does not match mid-string x2", () => {
    expect(parseDuplicateCount("x2 at the start")).toEqual({
      baseContent: "x2 at the start",
      count: 1,
    });
  });

  it("handles multiline content with trailing counter", () => {
    expect(parseDuplicateCount("line1\nline2 x3")).toEqual({
      baseContent: "line1\nline2",
      count: 3,
    });
  });

  it("handles empty string", () => {
    expect(parseDuplicateCount("")).toEqual({ baseContent: "", count: 1 });
  });
});

// ---------------------------------------------------------------------------
// Unit tests for tryDeduplicateMessage
// ---------------------------------------------------------------------------

describe("tryDeduplicateMessage", () => {
  it("returns null when content is a Document", async () => {
    const doc = { getBlocks: () => [{ type: "text" as const, content: "hi" }] };
    const result = await tryDeduplicateMessage(
      doc,
      vi.fn().mockResolvedValue([]),
      vi.fn()
    );
    expect(result).toBeNull();
  });

  it("returns null when files are attached", async () => {
    const result = await tryDeduplicateMessage(
      "hello",
      vi.fn().mockResolvedValue([]),
      vi.fn(),
      { files: [{ content: "data", name: "file.txt" }] }
    );
    expect(result).toBeNull();
  });

  it("returns null when there is no previous message", async () => {
    const result = await tryDeduplicateMessage(
      "hello",
      vi.fn().mockResolvedValue([]),
      vi.fn()
    );
    expect(result).toBeNull();
  });

  it("returns null when last message content differs", async () => {
    const lastMsg: MessageData = {
      id: "msg-1",
      channelId: "ch-1",
      platform: "slack",
      content: "goodbye",
    };
    const result = await tryDeduplicateMessage(
      "hello",
      vi.fn().mockResolvedValue([lastMsg]),
      vi.fn()
    );
    expect(result).toBeNull();
  });

  it("edits to x2 on first duplicate", async () => {
    const lastMsg: MessageData = {
      id: "msg-1",
      channelId: "ch-1",
      platform: "slack",
      content: "hello",
    };
    const update = vi.fn().mockResolvedValue(undefined);
    const result = await tryDeduplicateMessage(
      "hello",
      vi.fn().mockResolvedValue([lastMsg]),
      update
    );

    expect(update).toHaveBeenCalledWith("msg-1", "ch-1", "hello x2");
    expect(result).toEqual({ ...lastMsg, content: "hello x2" });
  });

  it("increments from x2 to x3", async () => {
    const lastMsg: MessageData = {
      id: "msg-1",
      channelId: "ch-1",
      platform: "slack",
      content: "hello x2",
    };
    const update = vi.fn().mockResolvedValue(undefined);
    const result = await tryDeduplicateMessage(
      "hello",
      vi.fn().mockResolvedValue([lastMsg]),
      update
    );

    expect(update).toHaveBeenCalledWith("msg-1", "ch-1", "hello x3");
    expect(result).toEqual({ ...lastMsg, content: "hello x3" });
  });

  it("increments from x9 to x10", async () => {
    const lastMsg: MessageData = {
      id: "msg-1",
      channelId: "ch-1",
      platform: "slack",
      content: "hello x9",
    };
    const update = vi.fn().mockResolvedValue(undefined);
    const result = await tryDeduplicateMessage(
      "hello",
      vi.fn().mockResolvedValue([lastMsg]),
      update
    );

    expect(update).toHaveBeenCalledWith("msg-1", "ch-1", "hello x10");
    expect(result).toEqual({ ...lastMsg, content: "hello x10" });
  });

  it("queries with limit 1 and author me", async () => {
    const getMessages = vi.fn().mockResolvedValue([]);
    await tryDeduplicateMessage("hello", getMessages, vi.fn());

    expect(getMessages).toHaveBeenCalledWith({ limit: 1, author: "me" });
  });
});

// ---------------------------------------------------------------------------
// Integration: Channel.postMessage dedup
// ---------------------------------------------------------------------------

function createMockOperations(): ChannelOperations {
  return {
    postMessage: vi.fn().mockResolvedValue({
      id: "new-1",
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
    getThreadMessages: vi.fn().mockResolvedValue([]),
  };
}

describe("Channel.postMessage dedup", () => {
  it("posts normally when no previous messages exist", async () => {
    const ops = createMockOperations();
    const channel = new Channel({
      id: "channel-1",
      platform: "slack",
      operations: ops,
    });

    const msg = await channel.postMessage("hello");

    expect(ops.postMessage).toHaveBeenCalledWith(
      "channel-1",
      "hello",
      undefined
    );
    expect(ops.updateMessage).not.toHaveBeenCalled();
    expect(msg.id).toBe("new-1");
  });

  it("edits previous message to x2 when content matches", async () => {
    const ops = createMockOperations();
    (ops.getMessages as Mock).mockResolvedValue([
      {
        id: "existing-1",
        channelId: "channel-1",
        platform: "slack",
        content: "hello",
      },
    ]);
    const channel = new Channel({
      id: "channel-1",
      platform: "slack",
      operations: ops,
    });

    const msg = await channel.postMessage("hello");

    expect(ops.updateMessage).toHaveBeenCalledWith(
      "existing-1",
      "channel-1",
      "hello x2"
    );
    expect(ops.postMessage).not.toHaveBeenCalled();
    expect(msg.id).toBe("existing-1");
  });

  it("increments counter on consecutive duplicates", async () => {
    const ops = createMockOperations();
    (ops.getMessages as Mock).mockResolvedValue([
      {
        id: "existing-1",
        channelId: "channel-1",
        platform: "slack",
        content: "hello x5",
      },
    ]);
    const channel = new Channel({
      id: "channel-1",
      platform: "slack",
      operations: ops,
    });

    const msg = await channel.postMessage("hello");

    expect(ops.updateMessage).toHaveBeenCalledWith(
      "existing-1",
      "channel-1",
      "hello x6"
    );
    expect(ops.postMessage).not.toHaveBeenCalled();
    expect(msg.id).toBe("existing-1");
  });

  it("posts new message when content differs", async () => {
    const ops = createMockOperations();
    (ops.getMessages as Mock).mockResolvedValue([
      {
        id: "existing-1",
        channelId: "channel-1",
        platform: "slack",
        content: "goodbye",
      },
    ]);
    const channel = new Channel({
      id: "channel-1",
      platform: "slack",
      operations: ops,
    });

    const msg = await channel.postMessage("hello");

    expect(ops.postMessage).toHaveBeenCalled();
    expect(ops.updateMessage).not.toHaveBeenCalled();
    expect(msg.id).toBe("new-1");
  });

  it("skips dedup for Document content", async () => {
    const ops = createMockOperations();
    (ops.getMessages as Mock).mockResolvedValue([
      {
        id: "existing-1",
        channelId: "channel-1",
        platform: "slack",
        content: "hello",
      },
    ]);
    const channel = new Channel({
      id: "channel-1",
      platform: "slack",
      operations: ops,
    });

    const doc = {
      getBlocks: () => [{ type: "text" as const, content: "hello" }],
    };
    const msg = await channel.postMessage(doc);

    expect(ops.postMessage).toHaveBeenCalled();
    expect(ops.updateMessage).not.toHaveBeenCalled();
    expect(msg.id).toBe("new-1");
  });

  it("skips dedup when files are attached", async () => {
    const ops = createMockOperations();
    (ops.getMessages as Mock).mockResolvedValue([
      {
        id: "existing-1",
        channelId: "channel-1",
        platform: "slack",
        content: "hello",
      },
    ]);
    const channel = new Channel({
      id: "channel-1",
      platform: "slack",
      operations: ops,
    });

    const msg = await channel.postMessage("hello", {
      files: [{ content: "data", name: "file.txt" }],
    });

    expect(ops.postMessage).toHaveBeenCalled();
    expect(ops.updateMessage).not.toHaveBeenCalled();
  });

  it("returned message supports reply() pointing to original thread", async () => {
    const ops = createMockOperations();
    (ops.getMessages as Mock).mockResolvedValue([
      {
        id: "existing-1",
        channelId: "channel-1",
        platform: "slack",
        content: "hello",
      },
    ]);
    const channel = new Channel({
      id: "channel-1",
      platform: "slack",
      operations: ops,
    });

    const msg = await channel.postMessage("hello");

    // msg.id should be the original message, so replies thread there
    expect(msg.id).toBe("existing-1");
    expect(msg.channelId).toBe("channel-1");
  });
});

// ---------------------------------------------------------------------------
// Integration: Thread.post dedup
// ---------------------------------------------------------------------------

function createMockThreadOps(): ThreadOperations {
  return {
    delete: vi.fn().mockResolvedValue(undefined),
    post: vi.fn().mockResolvedValue({
      id: "thread-msg-1",
      channelId: "channel-1",
      platform: "slack",
    }),
    getMessages: vi.fn().mockResolvedValue([]),
    subscribe: vi.fn().mockReturnValue(() => {}),
    createMessageOps: vi.fn().mockReturnValue({
      addReaction: vi.fn().mockResolvedValue(undefined),
      removeReaction: vi.fn().mockResolvedValue(undefined),
      removeAllReactions: vi.fn().mockResolvedValue(undefined),
      updateMessage: vi.fn().mockResolvedValue(undefined),
      deleteMessage: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue({
        id: "reply-1",
        channelId: "channel-1",
        platform: "slack",
      }),
      subscribeToReactions: vi.fn().mockReturnValue(() => {}),
      startThread: vi.fn().mockResolvedValue({
        id: "thread-1",
        channelId: "channel-1",
        platform: "slack",
      }),
    }),
  };
}

describe("Thread.post dedup", () => {
  it("posts normally when no previous messages exist", async () => {
    const ops = createMockThreadOps();
    const thread = new Thread(
      { id: "t1", channelId: "channel-1", platform: "slack" },
      ops
    );

    const msg = await thread.post("hello");

    expect(ops.post).toHaveBeenCalledWith("hello", undefined);
    expect(msg.id).toBe("thread-msg-1");
  });

  it("edits previous thread message to x2 on duplicate", async () => {
    const ops = createMockThreadOps();
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    (ops.createMessageOps as Mock).mockReturnValue({
      addReaction: vi.fn(),
      removeReaction: vi.fn(),
      removeAllReactions: vi.fn(),
      updateMessage: mockUpdate,
      deleteMessage: vi.fn(),
      reply: vi.fn(),
      subscribeToReactions: vi.fn().mockReturnValue(() => {}),
      startThread: vi.fn(),
    });
    (ops.getMessages as Mock).mockResolvedValue([
      {
        id: "thread-existing-1",
        channelId: "channel-1",
        platform: "slack",
        content: "hello",
      },
    ]);
    const thread = new Thread(
      { id: "t1", channelId: "channel-1", platform: "slack" },
      ops
    );

    const msg = await thread.post("hello");

    expect(mockUpdate).toHaveBeenCalledWith(
      "thread-existing-1",
      "channel-1",
      "hello x2"
    );
    expect(ops.post).not.toHaveBeenCalled();
    expect(msg.id).toBe("thread-existing-1");
  });

  it("posts new message in thread when content differs", async () => {
    const ops = createMockThreadOps();
    (ops.getMessages as Mock).mockResolvedValue([
      {
        id: "thread-existing-1",
        channelId: "channel-1",
        platform: "slack",
        content: "different",
      },
    ]);
    const thread = new Thread(
      { id: "t1", channelId: "channel-1", platform: "slack" },
      ops
    );

    const msg = await thread.post("hello");

    expect(ops.post).toHaveBeenCalled();
    expect(msg.id).toBe("thread-msg-1");
  });
});
