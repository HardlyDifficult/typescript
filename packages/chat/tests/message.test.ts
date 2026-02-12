import { vi, describe, it, expect, type Mock } from "vitest";
import { Message, ReplyMessage } from "../src/Message.js";
import type { MessageOperations } from "../src/Message.js";

describe("Message", () => {
  const createMockOperations = (): MessageOperations => ({
    addReaction: vi.fn().mockResolvedValue(undefined),
    removeReaction: vi.fn().mockResolvedValue(undefined),
    updateMessage: vi.fn().mockResolvedValue(undefined),
    deleteMessage: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue({
      id: "reply-123",
      channelId: "ch-1",
      platform: "slack" as const,
    }),
    subscribeToReactions: vi.fn().mockReturnValue(() => {}),
    startThread: vi.fn().mockResolvedValue({
      id: "thread-1",
      channelId: "ch-1",
      platform: "slack" as const,
    }),
  });

  describe("reply", () => {
    it("should call reply with correct parameters", () => {
      const mockOperations = createMockOperations();
      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      const reply = msg.reply("Reply content");

      expect(mockOperations.reply).toHaveBeenCalledWith(
        "ch-1",
        "msg-1",
        "Reply content"
      );
      expect(reply).toBeInstanceOf(Message);
    });

    it("should return a ReplyMessage instance", async () => {
      const mockOperations = createMockOperations();
      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      const pending = msg.reply("Reply content");

      expect(pending).toBeInstanceOf(ReplyMessage);
      expect(pending).toBeInstanceOf(Message);
      // Platform is inherited from parent immediately
      expect(pending.platform).toBe("slack");

      // After awaiting, the data is populated from the response
      const reply = await pending;
      expect(reply.id).toBe("reply-123");
      expect(reply.channelId).toBe("ch-1");
    });

    it("should update reply message data when promise resolves", async () => {
      const mockOperations = createMockOperations();
      const replyData = {
        id: "reply-456",
        channelId: "ch-2",
        platform: "discord" as const,
      };
      (mockOperations.reply as Mock).mockResolvedValue(replyData);

      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      const reply = msg.reply("Reply content");

      // Wait for the promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(reply.id).toBe("reply-456");
      expect(reply.channelId).toBe("ch-2");
      expect(reply.platform).toBe("discord");
    });

    it("should handle Document content", () => {
      const mockOperations = createMockOperations();
      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      const document = {
        getBlocks: () => [{ type: "text" as const, content: "Test" }],
      };

      msg.reply(document);

      expect(mockOperations.reply).toHaveBeenCalledWith(
        "ch-1",
        "msg-1",
        document
      );
    });

    it("should propagate errors when awaited", async () => {
      const mockOperations = createMockOperations();
      const error = new Error("Reply failed");
      (mockOperations.reply as Mock).mockRejectedValue(error);

      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      const reply = msg.reply("Reply content");

      await expect(Promise.resolve(reply)).rejects.toThrow("Reply failed");
    });

    it("should allow error handling via catch", async () => {
      const mockOperations = createMockOperations();
      const error = new Error("Reply failed");
      (mockOperations.reply as Mock).mockRejectedValue(error);

      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      const reply = msg.reply("Reply content");
      const result = await Promise.resolve(reply).catch(
        (err: Error) => `caught: ${err.message}`
      );

      expect(result).toBe("caught: Reply failed");
    });
  });

  describe("update", () => {
    it("should call updateMessage with correct parameters", async () => {
      const mockOperations = createMockOperations();
      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      await msg.update("new content");

      expect(mockOperations.updateMessage).toHaveBeenCalledWith(
        "msg-1",
        "ch-1",
        "new content"
      );
      expect(mockOperations.updateMessage).toHaveBeenCalledTimes(1);
    });

    it("should handle Document content", async () => {
      const mockOperations = createMockOperations();
      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      const document = {
        getBlocks: () => [
          { type: "text" as const, content: "Updated content" },
        ],
      };

      await msg.update(document);

      expect(mockOperations.updateMessage).toHaveBeenCalledWith(
        "msg-1",
        "ch-1",
        document
      );
    });

    it("should propagate errors from updateMessage", async () => {
      const mockOperations = createMockOperations();
      const error = new Error("Update failed");
      (mockOperations.updateMessage as Mock).mockRejectedValue(error);

      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      await expect(msg.update("new content")).rejects.toThrow("Update failed");
    });
  });

  describe("delete", () => {
    it("should call deleteMessage with correct parameters", async () => {
      const mockOperations = createMockOperations();
      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      await msg.delete();

      expect(mockOperations.deleteMessage).toHaveBeenCalledWith(
        "msg-1",
        "ch-1"
      );
      expect(mockOperations.deleteMessage).toHaveBeenCalledTimes(1);
    });

    it("should propagate errors from deleteMessage", async () => {
      const mockOperations = createMockOperations();
      const error = new Error("Delete failed");
      (mockOperations.deleteMessage as Mock).mockRejectedValue(error);

      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      await expect(msg.delete()).rejects.toThrow("Delete failed");
    });
  });

  describe("addReactions (inherited behavior)", () => {
    it("should call addReaction for each emoji", async () => {
      const mockOperations = createMockOperations();
      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      msg.addReactions(["thumbsup", "heart", "rocket"]);

      // Wait for reactions to complete
      await msg.waitForReactions();

      expect(mockOperations.addReaction).toHaveBeenCalledTimes(3);
      expect(mockOperations.addReaction).toHaveBeenNthCalledWith(
        1,
        "msg-1",
        "ch-1",
        "thumbsup"
      );
      expect(mockOperations.addReaction).toHaveBeenNthCalledWith(
        2,
        "msg-1",
        "ch-1",
        "heart"
      );
      expect(mockOperations.addReaction).toHaveBeenNthCalledWith(
        3,
        "msg-1",
        "ch-1",
        "rocket"
      );
    });

    it("should return this for chaining", () => {
      const mockOperations = createMockOperations();
      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      const result = msg.addReactions(["thumbsup"]);

      expect(result).toBe(msg);
    });
  });

  describe("removeReactions (inherited behavior)", () => {
    it("should call removeReaction for each emoji", async () => {
      const mockOperations = createMockOperations();
      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      msg.removeReactions(["thumbsup", "heart"]);

      await msg.waitForReactions();

      expect(mockOperations.removeReaction).toHaveBeenCalledTimes(2);
      expect(mockOperations.removeReaction).toHaveBeenNthCalledWith(
        1,
        "msg-1",
        "ch-1",
        "thumbsup"
      );
      expect(mockOperations.removeReaction).toHaveBeenNthCalledWith(
        2,
        "msg-1",
        "ch-1",
        "heart"
      );
    });

    it("should return this for chaining", () => {
      const mockOperations = createMockOperations();
      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      const result = msg.removeReactions(["thumbsup"]);

      expect(result).toBe(msg);
    });

    it("should chain with addReactions", async () => {
      const mockOperations = createMockOperations();
      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      msg.addReactions(["thumbsup"]).removeReactions(["thumbsup"]);

      await msg.waitForReactions();

      expect(mockOperations.addReaction).toHaveBeenCalledTimes(1);
      expect(mockOperations.removeReaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("integration", () => {
    it("should support chaining addReactions with update and delete", async () => {
      const mockOperations = createMockOperations();
      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      msg.addReactions(["thumbsup"]);
      await msg.update("updated content");
      await msg.delete();

      expect(mockOperations.addReaction).toHaveBeenCalled();
      expect(mockOperations.updateMessage).toHaveBeenCalled();
      expect(mockOperations.deleteMessage).toHaveBeenCalled();
    });

    it("should support posting a reply and then updating it", async () => {
      const mockOperations = createMockOperations();
      const msg = new Message(
        { id: "msg-1", channelId: "ch-1", platform: "slack" },
        mockOperations
      );

      const reply = msg.reply("Initial reply");
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait for reply to resolve
      await reply.update("Updated reply");

      expect(mockOperations.reply).toHaveBeenCalled();
      expect(mockOperations.updateMessage).toHaveBeenCalled();
    });
  });
});
