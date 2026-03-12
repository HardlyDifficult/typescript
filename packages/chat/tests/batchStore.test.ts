import { describe, it, expect, beforeEach } from "vitest";
import {
  batchStore,
  resetBatchStore,
  type BatchRecord,
} from "../src/BatchStore.js";

describe("InMemoryBatchStore", () => {
  beforeEach(() => {
    resetBatchStore();
  });

  describe("appendMessage", () => {
    it("returns null when batchId does not match channel/platform", () => {
      batchStore.beginBatch({
        channelId: "ch-1",
        platform: "slack",
      });

      const result = batchStore.appendMessage("ch-2", "slack", "non-existent-id", {
        id: "msg-1",
        channelId: "ch-1",
        platform: "slack",
        postedAt: Date.now(),
      });

      expect(result).toBeNull();
    });

    it("does not duplicate messages with the same id", () => {
      const batch = batchStore.beginBatch({ channelId: "ch-1", platform: "slack" });
      const msg = { id: "msg-1", channelId: "ch-1", platform: "slack" as const, postedAt: Date.now() };

      batchStore.appendMessage("ch-1", "slack", batch.id, msg);
      batchStore.appendMessage("ch-1", "slack", batch.id, msg); // duplicate

      const result = batchStore.getBatch("ch-1", "slack", batch.id);
      expect(result?.messages).toHaveLength(1);
    });
  });

  describe("finishBatch", () => {
    it("returns null when batchId does not match channel/platform", () => {
      const result = batchStore.finishBatch("ch-2", "slack", "non-existent-id");
      expect(result).toBeNull();
    });
  });

  describe("removeMessages", () => {
    it("delegates to getBatch when messageIds is empty", () => {
      const batch = batchStore.beginBatch({ channelId: "ch-1", platform: "discord" });
      const result = batchStore.removeMessages("ch-1", "discord", batch.id, []);
      // Should return the batch (same as getBatch)
      expect(result).not.toBeNull();
      expect(result?.id).toBe(batch.id);
    });

    it("returns null when batchId does not match channel/platform", () => {
      const result = batchStore.removeMessages("ch-2", "slack", "non-existent-id", ["msg-1"]);
      expect(result).toBeNull();
    });
  });

  describe("getBatch", () => {
    it("returns null when batchId does not match channel/platform", () => {
      const result = batchStore.getBatch("ch-2", "slack", "non-existent-id");
      expect(result).toBeNull();
    });
  });

  describe("getBatches filtering", () => {
    it("filters by key", () => {
      batchStore.beginBatch({ key: "session-1", channelId: "ch-1", platform: "slack" });
      batchStore.beginBatch({ key: "session-2", channelId: "ch-1", platform: "slack" });

      const result = batchStore.getBatches("ch-1", "slack", { key: "session-1" });
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("session-1");
    });

    it("filters by author", () => {
      batchStore.beginBatch({ author: "me", channelId: "ch-1", platform: "slack" });
      batchStore.beginBatch({ author: "other", channelId: "ch-1", platform: "slack" });

      const result = batchStore.getBatches("ch-1", "slack", { author: "other" });
      expect(result).toHaveLength(1);
      expect(result[0].author).toBe("other");
    });

    it("excludes open batches when includeOpen is false", () => {
      const batch1 = batchStore.beginBatch({ channelId: "ch-1", platform: "slack" });
      const batch2 = batchStore.beginBatch({ channelId: "ch-1", platform: "slack" });
      batchStore.finishBatch("ch-1", "slack", batch1.id);

      const result = batchStore.getBatches("ch-1", "slack", { includeOpen: false });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(batch1.id);
    });

    it("limits results", () => {
      batchStore.beginBatch({ channelId: "ch-1", platform: "slack" });
      batchStore.beginBatch({ channelId: "ch-1", platform: "slack" });
      batchStore.beginBatch({ channelId: "ch-1", platform: "slack" });

      const result = batchStore.getBatches("ch-1", "slack", { limit: 2 });
      expect(result).toHaveLength(2);
    });
  });
});
