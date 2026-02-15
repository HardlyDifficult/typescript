import { vi, describe, it, expect, afterEach } from "vitest";
import { EditableStreamReply } from "../src/EditableStreamReply.js";
import { Thread } from "../src/Thread.js";
import type { ThreadOperations } from "../src/Thread.js";

describe("EditableStreamReply", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockMessage = () => ({
    update: vi.fn().mockResolvedValue(undefined),
  });

  const createPostFn = (mockMessage = createMockMessage()) =>
    vi.fn().mockResolvedValue(mockMessage);

  describe("append and stop", () => {
    it("should flush accumulated text on stop", async () => {
      vi.useFakeTimers();
      const postFn = createPostFn();
      const stream = new EditableStreamReply(postFn, "discord", 5000);

      stream.append("hello ");
      stream.append("world");
      await stream.stop();

      expect(postFn).toHaveBeenCalledTimes(1);
      expect(postFn).toHaveBeenCalledWith("hello world");
    });

    it("should not post when buffer is empty", async () => {
      vi.useFakeTimers();
      const postFn = createPostFn();
      const stream = new EditableStreamReply(postFn, "discord", 5000);

      await stream.stop();

      expect(postFn).not.toHaveBeenCalled();
    });

    it("should not post when buffer is whitespace-only", async () => {
      vi.useFakeTimers();
      const postFn = createPostFn();
      const stream = new EditableStreamReply(postFn, "discord", 5000);

      stream.append("   \n\n  ");
      await stream.stop();

      expect(postFn).not.toHaveBeenCalled();
    });
  });

  describe("content getter", () => {
    it("should return the full accumulated text", async () => {
      vi.useFakeTimers();
      const stream = new EditableStreamReply(createPostFn(), "discord", 5000);

      stream.append("hello ");
      stream.append("world");

      expect(stream.content).toBe("hello world");

      await stream.stop();
    });

    it("should return empty string before any appends", async () => {
      vi.useFakeTimers();
      const stream = new EditableStreamReply(createPostFn(), "discord", 5000);

      expect(stream.content).toBe("");

      await stream.stop();
    });

    it("should include unflushed text", async () => {
      vi.useFakeTimers();
      const stream = new EditableStreamReply(createPostFn(), "discord", 60000);

      stream.append("flushed");
      await stream.flush();
      stream.append(" and more");

      expect(stream.content).toBe("flushed and more");

      await stream.stop();
    });
  });

  describe("edit in place", () => {
    it("should post on first flush and edit on subsequent flushes", async () => {
      vi.useFakeTimers();
      const mockMessage = createMockMessage();
      const postFn = createPostFn(mockMessage);
      const stream = new EditableStreamReply(postFn, "discord", 1000);

      stream.append("first");
      await vi.advanceTimersByTimeAsync(1000);

      expect(postFn).toHaveBeenCalledTimes(1);
      expect(postFn).toHaveBeenCalledWith("first");
      expect(mockMessage.update).not.toHaveBeenCalled();

      stream.append(" second");
      await vi.advanceTimersByTimeAsync(1000);

      // postFn still called only once (the initial post)
      expect(postFn).toHaveBeenCalledTimes(1);
      // update called with the full accumulated text
      expect(mockMessage.update).toHaveBeenCalledTimes(1);
      expect(mockMessage.update).toHaveBeenCalledWith("first second");

      await stream.stop();
    });

    it("should accumulate all text in edits, not just new text", async () => {
      vi.useFakeTimers();
      const mockMessage = createMockMessage();
      const postFn = createPostFn(mockMessage);
      const stream = new EditableStreamReply(postFn, "discord", 1000);

      stream.append("a");
      await vi.advanceTimersByTimeAsync(1000);

      stream.append("b");
      await vi.advanceTimersByTimeAsync(1000);

      stream.append("c");
      await vi.advanceTimersByTimeAsync(1000);

      expect(mockMessage.update).toHaveBeenCalledTimes(2);
      expect(mockMessage.update).toHaveBeenNthCalledWith(1, "ab");
      expect(mockMessage.update).toHaveBeenNthCalledWith(2, "abc");

      await stream.stop();
    });
  });

  describe("automatic flush", () => {
    it("should flush on interval", async () => {
      vi.useFakeTimers();
      const postFn = createPostFn();
      const stream = new EditableStreamReply(postFn, "discord", 1000);

      stream.append("data");
      await vi.advanceTimersByTimeAsync(1000);

      expect(postFn).toHaveBeenCalledTimes(1);
      expect(postFn).toHaveBeenCalledWith("data");

      await stream.stop();
    });

    it("should skip flush when buffer unchanged since last flush", async () => {
      vi.useFakeTimers();
      const mockMessage = createMockMessage();
      const postFn = createPostFn(mockMessage);
      const stream = new EditableStreamReply(postFn, "discord", 1000);

      stream.append("data");
      await vi.advanceTimersByTimeAsync(1000);

      // No new appends — next interval should be a no-op
      await vi.advanceTimersByTimeAsync(1000);

      expect(postFn).toHaveBeenCalledTimes(1);
      expect(mockMessage.update).not.toHaveBeenCalled();

      await stream.stop();
    });

    it("should skip flush when buffer is empty at interval", async () => {
      vi.useFakeTimers();
      const postFn = createPostFn();
      const stream = new EditableStreamReply(postFn, "discord", 1000);

      await vi.advanceTimersByTimeAsync(1000);

      expect(postFn).not.toHaveBeenCalled();

      await stream.stop();
    });
  });

  describe("stop", () => {
    it("should clear interval so no more auto-flushes occur", async () => {
      vi.useFakeTimers();
      const mockMessage = createMockMessage();
      const postFn = createPostFn(mockMessage);
      const stream = new EditableStreamReply(postFn, "discord", 1000);

      stream.append("data");
      await stream.stop();

      expect(postFn).toHaveBeenCalledTimes(1);

      // Advance past another interval — should not trigger another flush
      stream.append("more data");
      await vi.advanceTimersByTimeAsync(2000);

      expect(mockMessage.update).not.toHaveBeenCalled();
    });

    it("should be safe to call multiple times", async () => {
      vi.useFakeTimers();
      const postFn = createPostFn();
      const stream = new EditableStreamReply(postFn, "discord", 1000);

      stream.append("data");
      await stream.stop();
      await stream.stop();

      expect(postFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("truncation", () => {
    it("should truncate from the beginning when exceeding Discord limit", async () => {
      vi.useFakeTimers();
      const postFn = createPostFn();
      const stream = new EditableStreamReply(postFn, "discord", 5000);

      // Discord limit is 2000 chars
      const text = "a".repeat(2500);
      stream.append(text);
      await stream.stop();

      expect(postFn).toHaveBeenCalledTimes(1);
      const posted = postFn.mock.calls[0][0] as string;
      expect(posted.length).toBe(2000);
      expect(posted[0]).toBe("\u2026"); // starts with ellipsis
      expect(posted.slice(1)).toBe("a".repeat(1999));
    });

    it("should truncate from the beginning when exceeding Slack limit", async () => {
      vi.useFakeTimers();
      const postFn = createPostFn();
      const stream = new EditableStreamReply(postFn, "slack", 5000);

      // Slack limit is 4000 chars
      const text = "b".repeat(4500);
      stream.append(text);
      await stream.stop();

      expect(postFn).toHaveBeenCalledTimes(1);
      const posted = postFn.mock.calls[0][0] as string;
      expect(posted.length).toBe(4000);
      expect(posted[0]).toBe("\u2026");
      expect(posted.slice(1)).toBe("b".repeat(3999));
    });

    it("should not truncate text within the limit", async () => {
      vi.useFakeTimers();
      const postFn = createPostFn();
      const stream = new EditableStreamReply(postFn, "discord", 5000);

      stream.append("short message");
      await stream.stop();

      expect(postFn).toHaveBeenCalledTimes(1);
      expect(postFn).toHaveBeenCalledWith("short message");
    });

    it("should truncate on edit, not just initial post", async () => {
      vi.useFakeTimers();
      const mockMessage = createMockMessage();
      const postFn = createPostFn(mockMessage);
      const stream = new EditableStreamReply(postFn, "discord", 1000);

      // First flush: short text, fits fine
      stream.append("short");
      await vi.advanceTimersByTimeAsync(1000);

      expect(postFn).toHaveBeenCalledWith("short");

      // Second flush: add enough to exceed the limit
      stream.append("x".repeat(2500));
      await vi.advanceTimersByTimeAsync(1000);

      const edited = mockMessage.update.mock.calls[0][0] as string;
      expect(edited.length).toBe(2000);
      expect(edited[0]).toBe("\u2026");

      await stream.stop();
    });
  });

  describe("concurrent flush guard", () => {
    it("should skip flush while a previous flush is in progress", async () => {
      vi.useFakeTimers();
      let resolvePost: (value: unknown) => void;
      const slowPostFn = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvePost = resolve;
          })
      );
      const stream = new EditableStreamReply(slowPostFn, "discord", 1000);

      stream.append("data");
      // Start a flush but don't resolve it
      const flushPromise = stream.flush();

      // Try to flush again while the first is in progress
      stream.append(" more");
      await stream.flush(); // should be a no-op due to guard

      // Only one postFn call (the first one)
      expect(slowPostFn).toHaveBeenCalledTimes(1);

      // Resolve the pending post
      resolvePost!(createMockMessage());
      await flushPromise;

      await stream.stop();
    });
  });

  describe("error handling", () => {
    it("should propagate errors from manual flush", async () => {
      vi.useFakeTimers();
      const postFn = vi.fn().mockRejectedValue(new Error("send failed"));
      const stream = new EditableStreamReply(postFn, "discord", 5000);

      stream.append("text");
      await expect(stream.flush()).rejects.toThrow("send failed");

      await stream.stop();
    });

    it("should propagate errors from stop", async () => {
      vi.useFakeTimers();
      const postFn = vi.fn().mockRejectedValue(new Error("send failed"));
      const stream = new EditableStreamReply(postFn, "discord", 5000);

      stream.append("text");
      await expect(stream.stop()).rejects.toThrow("send failed");
    });

    it("should swallow errors from interval flushes", async () => {
      vi.useFakeTimers();
      const postFn = vi.fn().mockRejectedValue(new Error("send failed"));
      const stream = new EditableStreamReply(postFn, "discord", 1000);

      stream.append("text");
      // Should not throw
      await vi.advanceTimersByTimeAsync(1000);

      expect(postFn).toHaveBeenCalledTimes(1);

      // Clean up — stop will try to flush but buffer is unchanged, so no-op
      await stream.stop();
    });

    it("should reset flushing flag after error so next flush can proceed", async () => {
      vi.useFakeTimers();
      const mockMessage = createMockMessage();
      const postFn = vi
        .fn()
        .mockRejectedValueOnce(new Error("transient error"))
        .mockResolvedValueOnce(mockMessage);
      const stream = new EditableStreamReply(postFn, "discord", 5000);

      stream.append("attempt 1");
      await stream.flush().catch(() => {});

      // Buffer hasn't changed — append something new to trigger a real flush
      stream.append(" attempt 2");
      await stream.flush();

      expect(postFn).toHaveBeenCalledTimes(2);

      await stream.stop();
    });
  });

  describe("abort signal", () => {
    it("should stop flushing when signal is aborted", async () => {
      vi.useFakeTimers();
      const postFn = createPostFn();
      const controller = new AbortController();
      const stream = new EditableStreamReply(
        postFn,
        "discord",
        5000,
        controller.signal
      );

      stream.append("before abort");
      controller.abort();
      await vi.advanceTimersByTimeAsync(0);

      expect(postFn).toHaveBeenCalledWith("before abort");

      stream.append("after abort");
      await stream.stop();

      expect(postFn).toHaveBeenCalledTimes(1);
    });

    it("should make append a no-op after abort", async () => {
      vi.useFakeTimers();
      const postFn = createPostFn();
      const controller = new AbortController();
      const stream = new EditableStreamReply(
        postFn,
        "discord",
        5000,
        controller.signal
      );

      controller.abort();
      await vi.advanceTimersByTimeAsync(0);

      stream.append("ignored");
      await stream.stop();

      expect(postFn).not.toHaveBeenCalled();
    });

    it("should handle already-aborted signal", async () => {
      vi.useFakeTimers();
      const postFn = createPostFn();
      const controller = new AbortController();
      controller.abort();
      const stream = new EditableStreamReply(
        postFn,
        "discord",
        5000,
        controller.signal
      );

      await vi.advanceTimersByTimeAsync(0);

      stream.append("ignored");
      await stream.stop();

      expect(postFn).not.toHaveBeenCalled();
    });

    it("should not accumulate text in content after abort", async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const stream = new EditableStreamReply(
        createPostFn(),
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
      const postFn = createPostFn();
      const controller = new AbortController();
      const stream = new EditableStreamReply(
        postFn,
        "discord",
        5000,
        controller.signal
      );

      stream.append("data");
      controller.abort();
      await vi.advanceTimersByTimeAsync(0);

      await stream.stop();
      await stream.stop();

      expect(postFn).toHaveBeenCalledTimes(1);
    });
  });
});

describe("Thread.editableStream", () => {
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
    subscribe: vi.fn().mockReturnValue(() => {}),
    createMessageOps: vi.fn().mockReturnValue({
      addReaction: vi.fn(),
      removeReaction: vi.fn(),
      removeAllReactions: vi.fn(),
      updateMessage: vi.fn().mockResolvedValue(undefined),
      deleteMessage: vi.fn(),
      reply: vi.fn(),
      subscribeToReactions: vi.fn(),
      startThread: vi.fn(),
    }),
  });

  it("should return an EditableStreamReply", () => {
    vi.useFakeTimers();
    const ops = createMockThreadOps();
    const thread = new Thread(
      { id: "thread-1", channelId: "ch-1", platform: "discord" },
      ops
    );

    const stream = thread.editableStream(1000);
    expect(stream).toBeInstanceOf(EditableStreamReply);

    stream.stop();
  });

  it("should post via thread ops", async () => {
    vi.useFakeTimers();
    const ops = createMockThreadOps();
    const thread = new Thread(
      { id: "thread-1", channelId: "ch-1", platform: "discord" },
      ops
    );

    const stream = thread.editableStream(1000);
    stream.append("streamed output");
    await stream.stop();

    expect(ops.post).toHaveBeenCalledWith("streamed output", undefined);
  });

  it("should use the correct platform for truncation", async () => {
    vi.useFakeTimers();
    const ops = createMockThreadOps();
    const thread = new Thread(
      { id: "thread-1", channelId: "ch-1", platform: "slack" },
      ops
    );

    const stream = thread.editableStream(1000);

    // 3000 chars fits within Slack's 4000 limit but would exceed Discord's 2000
    stream.append("a".repeat(3000));
    await stream.stop();

    // Should NOT be truncated on Slack
    expect(ops.post).toHaveBeenCalledWith("a".repeat(3000), undefined);
  });

  it("should pass abort signal to EditableStreamReply", async () => {
    vi.useFakeTimers();
    const ops = createMockThreadOps();
    const thread = new Thread(
      { id: "thread-1", channelId: "ch-1", platform: "discord" },
      ops
    );
    const controller = new AbortController();

    const stream = thread.editableStream(1000, controller.signal);
    stream.append("text");
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    stream.append("ignored");
    await stream.stop();

    expect(stream.content).toBe("text");
  });
});
