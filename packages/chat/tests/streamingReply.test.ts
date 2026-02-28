import { vi, describe, it, expect, afterEach } from "vitest";
import { StreamingReply } from "../src/StreamingReply.js";
import { Message } from "../src/Message.js";
import type { MessageOperations } from "../src/Message.js";
import { Thread } from "../src/Thread.js";
import type { ThreadOperations } from "../src/Thread.js";

describe("StreamingReply", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const createReplyFn = () => vi.fn().mockResolvedValue(undefined);

  describe("append and stop", () => {
    it("should flush accumulated text on stop", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "discord", 5000);

      stream.append("hello ");
      stream.append("world");
      await stream.stop();

      expect(replyFn).toHaveBeenCalledTimes(1);
      expect(replyFn).toHaveBeenCalledWith("hello world");
    });

    it("should not reply when buffer is empty", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "discord", 5000);

      await stream.stop();

      expect(replyFn).not.toHaveBeenCalled();
    });

    it("should not reply when buffer is whitespace-only", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "discord", 5000);

      stream.append("   \n\n  ");
      await stream.stop();

      expect(replyFn).not.toHaveBeenCalled();
    });
  });

  describe("content getter", () => {
    it("should return the full accumulated text", async () => {
      vi.useFakeTimers();
      const stream = new StreamingReply(createReplyFn(), "discord", 5000);

      stream.append("hello ");
      stream.append("world");

      expect(stream.content).toBe("hello world");

      await stream.stop();
    });

    it("should return empty string before any appends", async () => {
      vi.useFakeTimers();
      const stream = new StreamingReply(createReplyFn(), "discord", 5000);

      expect(stream.content).toBe("");

      await stream.stop();
    });

    it("should include text from previous flushes", async () => {
      vi.useFakeTimers();
      const stream = new StreamingReply(createReplyFn(), "discord", 60000);

      stream.append("first");
      await stream.flush();
      stream.append(" second");

      expect(stream.content).toBe("first second");

      await stream.stop();
    });

    it("should include unflushed text", async () => {
      vi.useFakeTimers();
      const stream = new StreamingReply(createReplyFn(), "discord", 60000);

      stream.append("pending");

      expect(stream.content).toBe("pending");

      await stream.stop();
    });
  });

  describe("automatic flush", () => {
    it("should flush on interval", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "discord", 1000);

      stream.append("first batch");
      await vi.advanceTimersByTimeAsync(1000);

      expect(replyFn).toHaveBeenCalledTimes(1);
      expect(replyFn).toHaveBeenCalledWith("first batch");

      stream.append("second batch");
      await vi.advanceTimersByTimeAsync(1000);

      expect(replyFn).toHaveBeenCalledTimes(2);
      expect(replyFn).toHaveBeenCalledWith("second batch");

      await stream.stop();
    });

    it("should skip flush when buffer is empty at interval", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "discord", 1000);

      await vi.advanceTimersByTimeAsync(1000);

      expect(replyFn).not.toHaveBeenCalled();

      await stream.stop();
    });

    it("should batch appends between intervals", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "discord", 2000);

      stream.append("line 1\n");
      stream.append("line 2\n");
      stream.append("line 3\n");
      await vi.advanceTimersByTimeAsync(2000);

      expect(replyFn).toHaveBeenCalledTimes(1);
      expect(replyFn).toHaveBeenCalledWith("line 1\nline 2\nline 3\n");

      await stream.stop();
    });
  });

  describe("stop", () => {
    it("should clear interval so no more auto-flushes occur", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "discord", 1000);

      stream.append("data");
      await stream.stop();

      expect(replyFn).toHaveBeenCalledTimes(1);

      // Advance past another interval — should not trigger another flush
      stream.append("more data");
      await vi.advanceTimersByTimeAsync(2000);

      expect(replyFn).toHaveBeenCalledTimes(1);
    });

    it("should be safe to call multiple times", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "discord", 1000);

      stream.append("data");
      await stream.stop();
      await stream.stop();

      expect(replyFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("manual flush", () => {
    it("should flush immediately without waiting for interval", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "discord", 60000);

      stream.append("urgent");
      await stream.flush();

      expect(replyFn).toHaveBeenCalledTimes(1);
      expect(replyFn).toHaveBeenCalledWith("urgent");

      await stream.stop();
    });

    it("should clear buffer after flushing", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "discord", 60000);

      stream.append("first");
      await stream.flush();

      stream.append("second");
      await stream.flush();

      expect(replyFn).toHaveBeenCalledTimes(2);
      expect(replyFn).toHaveBeenNthCalledWith(1, "first");
      expect(replyFn).toHaveBeenNthCalledWith(2, "second");

      await stream.stop();
    });
  });

  describe("chunking", () => {
    it("should chunk text exceeding Discord message limit", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "discord", 5000);

      // Discord limit is 2000 chars
      const line = "a".repeat(1500);
      stream.append(line + "\n" + line);
      await stream.stop();

      expect(replyFn).toHaveBeenCalledTimes(2);
      expect(replyFn).toHaveBeenNthCalledWith(1, line);
      expect(replyFn).toHaveBeenNthCalledWith(2, line);
    });

    it("should chunk text exceeding Slack message limit", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "slack", 5000);

      // Slack limit is 4000 chars
      const line = "b".repeat(3500);
      stream.append(line + "\n" + line);
      await stream.stop();

      expect(replyFn).toHaveBeenCalledTimes(2);
      expect(replyFn).toHaveBeenNthCalledWith(1, line);
      expect(replyFn).toHaveBeenNthCalledWith(2, line);
    });

    it("should split at newlines when possible", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "discord", 5000);

      const part1 = "x".repeat(1800);
      const part2 = "y".repeat(500);
      stream.append(part1 + "\n" + part2);
      await stream.stop();

      expect(replyFn).toHaveBeenCalledTimes(2);
      expect(replyFn).toHaveBeenNthCalledWith(1, part1);
      expect(replyFn).toHaveBeenNthCalledWith(2, part2);
    });

    it("should split at spaces when no good newline exists", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "discord", 5000);

      const part1 = "x".repeat(1800);
      const part2 = "y".repeat(500);
      stream.append(part1 + " " + part2);
      await stream.stop();

      expect(replyFn).toHaveBeenCalledTimes(2);
      expect(replyFn).toHaveBeenNthCalledWith(1, part1);
      expect(replyFn).toHaveBeenNthCalledWith(2, part2);
    });

    it("should hard-split when no natural break point exists", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "discord", 5000);

      const text = "z".repeat(4500);
      stream.append(text);
      await stream.stop();

      expect(replyFn).toHaveBeenCalledTimes(3);
      expect(replyFn).toHaveBeenNthCalledWith(1, "z".repeat(2000));
      expect(replyFn).toHaveBeenNthCalledWith(2, "z".repeat(2000));
      expect(replyFn).toHaveBeenNthCalledWith(3, "z".repeat(500));
    });

    it("should not chunk text within the limit", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const stream = new StreamingReply(replyFn, "discord", 5000);

      stream.append("short message");
      await stream.stop();

      expect(replyFn).toHaveBeenCalledTimes(1);
      expect(replyFn).toHaveBeenCalledWith("short message");
    });
  });

  describe("error handling", () => {
    it("should propagate errors from manual flush", async () => {
      vi.useFakeTimers();
      const replyFn = vi.fn().mockRejectedValue(new Error("send failed"));
      const stream = new StreamingReply(replyFn, "discord", 5000);

      stream.append("text");
      await expect(stream.flush()).rejects.toThrow("send failed");

      // Clean up without re-throwing (buffer was cleared)
      await stream.stop();
    });

    it("should propagate errors from stop", async () => {
      vi.useFakeTimers();
      const replyFn = vi.fn().mockRejectedValue(new Error("send failed"));
      const stream = new StreamingReply(replyFn, "discord", 5000);

      stream.append("text");
      await expect(stream.stop()).rejects.toThrow("send failed");
    });

    it("should swallow errors from interval flushes", async () => {
      vi.useFakeTimers();
      const replyFn = vi.fn().mockRejectedValue(new Error("send failed"));
      const stream = new StreamingReply(replyFn, "discord", 1000);

      stream.append("text");
      // Should not throw
      await vi.advanceTimersByTimeAsync(1000);

      expect(replyFn).toHaveBeenCalledTimes(1);

      // Clean up
      stream.append(""); // clear the buffer state
      await stream.stop();
    });
  });

  describe("abort signal", () => {
    it("should stop flushing when signal is aborted", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const controller = new AbortController();
      const stream = new StreamingReply(
        replyFn,
        "discord",
        5000,
        controller.signal
      );

      stream.append("before abort");
      controller.abort();
      await vi.advanceTimersByTimeAsync(0);

      expect(replyFn).toHaveBeenCalledWith("before abort");

      stream.append("after abort");
      await stream.stop();

      expect(replyFn).toHaveBeenCalledTimes(1);
    });

    it("should make append a no-op after abort", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const controller = new AbortController();
      const stream = new StreamingReply(
        replyFn,
        "discord",
        5000,
        controller.signal
      );

      controller.abort();
      await vi.advanceTimersByTimeAsync(0);

      stream.append("ignored");
      await stream.stop();

      expect(replyFn).not.toHaveBeenCalled();
    });

    it("should handle already-aborted signal", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const controller = new AbortController();
      controller.abort();
      const stream = new StreamingReply(
        replyFn,
        "discord",
        5000,
        controller.signal
      );

      await vi.advanceTimersByTimeAsync(0);

      stream.append("ignored");
      await stream.stop();

      expect(replyFn).not.toHaveBeenCalled();
    });

    it("should not accumulate text in content after abort", async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const stream = new StreamingReply(
        createReplyFn(),
        "discord",
        5000,
        controller.signal
      );

      stream.append("kept");
      controller.abort();
      await vi.advanceTimersByTimeAsync(0);

      stream.append("discarded");

      expect(stream.content).toBe("kept");

      await stream.stop();
    });

    it("should be safe to call stop after abort", async () => {
      vi.useFakeTimers();
      const replyFn = createReplyFn();
      const controller = new AbortController();
      const stream = new StreamingReply(
        replyFn,
        "discord",
        5000,
        controller.signal
      );

      stream.append("data");
      controller.abort();
      await vi.advanceTimersByTimeAsync(0);

      await stream.stop();
      await stream.stop();

      expect(replyFn).toHaveBeenCalledTimes(1);
    });
  });
});

describe("Message.streamReply", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockOperations = (): MessageOperations => ({
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    removeAllReactions: vi.fn().mockResolvedValue(undefined),
    updateMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue({
      id: "reply-123",
      channelId: "ch-1",
      platform: "discord" as const,
    }),
    subscribeToReactions: vi.fn().mockReturnValue(() => {}),
    startThread: vi.fn().mockResolvedValue({
      id: "thread-1",
      channelId: "ch-1",
      platform: "discord" as const,
    }),
  });

  it("should return a StreamingReply", () => {
    vi.useFakeTimers();
    const ops = createMockOperations();
    const msg = new Message(
      { id: "msg-1", channelId: "ch-1", platform: "discord" },
      ops
    );

    const stream = msg.streamReply(1000);
    expect(stream).toBeInstanceOf(StreamingReply);

    stream.stop();
  });

  it("should send replies via the message's thread", async () => {
    vi.useFakeTimers();
    const ops = createMockOperations();
    const msg = new Message(
      { id: "msg-1", channelId: "ch-1", platform: "discord" },
      ops
    );

    const stream = msg.streamReply(1000);
    stream.append("streamed output");
    await stream.stop();

    expect(ops.reply).toHaveBeenCalledWith(
      "ch-1",
      "msg-1",
      "streamed output",
      undefined
    );
  });

  it("should use the correct platform for chunking", async () => {
    vi.useFakeTimers();
    const ops = createMockOperations();
    const msg = new Message(
      { id: "msg-1", channelId: "ch-1", platform: "slack" },
      ops
    );

    const stream = msg.streamReply(1000);

    // 3000 chars fits within Slack's 4000 limit but exceeds Discord's 2000
    stream.append("a".repeat(3000));
    await stream.stop();

    // Should be a single reply (not chunked) on Slack
    expect(ops.reply).toHaveBeenCalledTimes(1);
  });

  it("should pass abort signal to StreamingReply", async () => {
    vi.useFakeTimers();
    const ops = createMockOperations();
    const msg = new Message(
      { id: "msg-1", channelId: "ch-1", platform: "discord" },
      ops
    );
    const controller = new AbortController();

    const stream = msg.streamReply(1000, controller.signal);
    stream.append("text");
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    stream.append("ignored");
    await stream.stop();

    expect(ops.reply).toHaveBeenCalledTimes(1);
  });
});

describe("Thread.stream", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockThreadOps = (): ThreadOperations => ({
    delete: vi.fn().mockResolvedValue(undefined),
    post: vi.fn().mockResolvedValue({
      id: "msg-1",
      channelId: "ch-1",
      platform: "discord" as const,
    }),
    getMessages: vi.fn().mockResolvedValue([]),
    subscribe: vi.fn().mockReturnValue(() => {}),
    createMessageOps: vi.fn(),
  });

  it("should return a StreamingReply", () => {
    vi.useFakeTimers();
    const ops = createMockThreadOps();
    const thread = new Thread(
      { id: "thread-1", channelId: "ch-1", platform: "discord" },
      ops
    );

    const stream = thread.stream(1000);
    expect(stream).toBeInstanceOf(StreamingReply);

    stream.stop();
  });

  it("should post via thread ops", async () => {
    vi.useFakeTimers();
    const ops = createMockThreadOps();
    const thread = new Thread(
      { id: "thread-1", channelId: "ch-1", platform: "discord" },
      ops
    );

    const stream = thread.stream(1000);
    stream.append("streamed output");
    await stream.stop();

    expect(ops.post).toHaveBeenCalledWith("streamed output");
  });

  it("should use the correct platform for chunking", async () => {
    vi.useFakeTimers();
    const ops = createMockThreadOps();
    const thread = new Thread(
      { id: "thread-1", channelId: "ch-1", platform: "slack" },
      ops
    );

    const stream = thread.stream(1000);

    // 3000 chars fits within Slack's 4000 limit but exceeds Discord's 2000
    stream.append("a".repeat(3000));
    await stream.stop();

    // Should be a single post (not chunked) on Slack
    expect(ops.post).toHaveBeenCalledTimes(1);
  });

  it("should pass abort signal to StreamingReply", async () => {
    vi.useFakeTimers();
    const ops = createMockThreadOps();
    const thread = new Thread(
      { id: "thread-1", channelId: "ch-1", platform: "discord" },
      ops
    );
    const controller = new AbortController();

    const stream = thread.stream(1000, controller.signal);
    stream.append("text");
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    stream.append("ignored");
    await stream.stop();

    expect(ops.post).toHaveBeenCalledTimes(1);
  });
});
