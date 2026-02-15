import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMessageTracker } from "../src/MessageTracker.js";
import { Message, type MessageOperations } from "../src/Message.js";

/** Flush microtask queue so fire-and-forget promise chains complete. */
const flushPromises = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

describe("createMessageTracker", () => {
  const createMockMessage = (): Message => {
    const ops: MessageOperations = {
      addReaction: vi.fn().mockResolvedValue(undefined),
      removeReaction: vi.fn().mockResolvedValue(undefined),
      removeAllReactions: vi.fn().mockResolvedValue(undefined),
      updateMessage: vi.fn().mockResolvedValue(undefined),
      deleteMessage: vi.fn().mockResolvedValue(undefined),
      reply: vi.fn().mockResolvedValue({
        id: "reply-1",
        channelId: "ch-1",
        platform: "discord" as const,
      }),
      subscribeToReactions: vi.fn().mockReturnValue(() => {}),
      startThread: vi.fn().mockResolvedValue({
        id: "thread-1",
        channelId: "ch-1",
        platform: "discord" as const,
      }),
    };
    return new Message(
      { id: "msg-1", channelId: "ch-1", platform: "discord" },
      ops
    );
  };

  let mockMessage: Message;
  let postFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockMessage = createMockMessage();
    postFn = vi.fn().mockResolvedValue(mockMessage);
  });

  it("posts a message via the post function", () => {
    const tracker = createMessageTracker(postFn);

    tracker.post("worker-1", "Worker disconnected");

    expect(postFn).toHaveBeenCalledWith("Worker disconnected");
  });

  it("edits a tracked message", async () => {
    const tracker = createMessageTracker(postFn);
    const updateSpy = vi.spyOn(mockMessage, "update").mockResolvedValue();

    tracker.post("worker-1", "Worker disconnected");
    const edited = tracker.edit("worker-1", "Worker reconnected");

    expect(edited).toBe(true);

    await flushPromises();

    expect(updateSpy).toHaveBeenCalledWith("Worker reconnected");
  });

  it("returns false when editing an unknown key", () => {
    const tracker = createMessageTracker(postFn);

    const edited = tracker.edit("unknown", "content");

    expect(edited).toBe(false);
  });

  it("returns the posted timestamp", () => {
    const tracker = createMessageTracker(postFn);
    const before = new Date();

    tracker.post("worker-1", "content");

    const postedAt = tracker.getPostedAt("worker-1");
    expect(postedAt).toBeInstanceOf(Date);
    expect(postedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(postedAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("returns undefined for unknown key", () => {
    const tracker = createMessageTracker(postFn);

    expect(tracker.getPostedAt("unknown")).toBeUndefined();
  });

  it("clears the entry after edit", () => {
    const tracker = createMessageTracker(postFn);

    tracker.post("worker-1", "content");
    tracker.edit("worker-1", "updated");

    expect(tracker.getPostedAt("worker-1")).toBeUndefined();
    expect(tracker.edit("worker-1", "again")).toBe(false);
  });

  it("handles edit when post is still pending", async () => {
    let resolvePost!: (msg: Message) => void;
    const pendingPostFn = vi.fn().mockReturnValue(
      new Promise<Message>((resolve) => {
        resolvePost = resolve;
      })
    );
    const tracker = createMessageTracker(pendingPostFn);
    const updateSpy = vi.spyOn(mockMessage, "update").mockResolvedValue();

    tracker.post("worker-1", "disconnected");
    const edited = tracker.edit("worker-1", "reconnected");

    expect(edited).toBe(true);
    expect(updateSpy).not.toHaveBeenCalled();

    // Resolve the original post
    resolvePost(mockMessage);
    await flushPromises();

    expect(updateSpy).toHaveBeenCalledWith("reconnected");
  });
});
