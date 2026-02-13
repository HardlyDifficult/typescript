import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { SlackConfig, ReactionEvent } from "../src/types.js";

// Define mocks at module level - Vitest hoists vi.mock() calls automatically
// Use vi.hoisted() to ensure mocks are available before mock setup
const {
  mockPostMessage,
  mockChatDelete,
  mockReactionsAdd,
  mockReactionsRemove,
  mockReactionsGet,
  mockFilesUploadV2,
  mockConversationsHistory,
  mockConversationsReplies,
  mockConversationsMembers,
  mockUsersInfo,
  mockStart,
  mockStop,
  mockEvent,
  mockError,
  mockApp,
  getReactionHandler,
  setReactionHandler,
  getMessageHandler,
  setMessageHandler,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let reactionAddedHandler: ((args: { event: any }) => Promise<void>) | null =
    null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let messageHandler:
    | ((args: { event: any; context: any }) => Promise<void>)
    | null = null;

  const mockPostMessage = vi.fn();
  const mockChatDelete = vi.fn();
  const mockReactionsAdd = vi.fn();
  const mockReactionsRemove = vi.fn();
  const mockReactionsGet = vi.fn();
  const mockFilesUploadV2 = vi.fn();
  const mockConversationsHistory = vi.fn();
  const mockConversationsReplies = vi.fn();
  const mockConversationsMembers = vi.fn();
  const mockUsersInfo = vi.fn();
  const mockStart = vi.fn();
  const mockStop = vi.fn();
  const mockEvent = vi.fn();
  const mockError = vi.fn();

  const mockApp = {
    start: mockStart,
    stop: mockStop,
    event: mockEvent,
    error: mockError,
    client: {
      chat: {
        postMessage: mockPostMessage,
        delete: mockChatDelete,
      },
      reactions: {
        add: mockReactionsAdd,
        remove: mockReactionsRemove,
        get: mockReactionsGet,
      },
      filesUploadV2: mockFilesUploadV2,
      conversations: {
        history: mockConversationsHistory,
        replies: mockConversationsReplies,
        members: mockConversationsMembers,
      },
      users: {
        info: mockUsersInfo,
      },
    },
  };

  const getReactionHandler = () => reactionAddedHandler;
  const setReactionHandler = (handler: typeof reactionAddedHandler) => {
    reactionAddedHandler = handler;
  };
  const getMessageHandler = () => messageHandler;
  const setMessageHandler = (handler: typeof messageHandler) => {
    messageHandler = handler;
  };

  return {
    mockPostMessage,
    mockChatDelete,
    mockReactionsAdd,
    mockReactionsRemove,
    mockReactionsGet,
    mockFilesUploadV2,
    mockConversationsHistory,
    mockConversationsReplies,
    mockConversationsMembers,
    mockUsersInfo,
    mockStart,
    mockStop,
    mockEvent,
    mockError,
    mockApp,
    getReactionHandler,
    setReactionHandler,
    getMessageHandler,
    setMessageHandler,
  };
});

// Mock @slack/bolt
vi.mock("@slack/bolt", () => ({
  App: vi.fn().mockImplementation(() => mockApp),
}));

// Import after mocking
import { SlackChatClient } from "../src/slack/SlackChatClient.js";
import { Channel } from "../src/Channel.js";
import { Message } from "../src/Message.js";

/**
 * Helper to wait for a PendingMessage without triggering the thenable infinite loop.
 * The Message class has a custom then() method which causes await to loop infinitely.
 *
 * The issue: PendingMessage.addReactions() schedules reactions via postPromise.then(),
 * so we need to flush microtasks after postPromise resolves to allow the scheduled
 * callbacks to update pendingReactions before we read it.
 */
async function waitForMessage(message: Message): Promise<void> {
  // Access private fields for testing
  const postPromise = (message as any).postPromise;

  if (postPromise) {
    await postPromise;
    // Flush microtasks to let any .then() callbacks scheduled on postPromise run
    // This allows super.addReactions() calls to update pendingReactions
    await Promise.resolve();
  }

  // Now pendingReactions should have all chained reactions
  const pendingReactions = (message as any).pendingReactions;
  if (pendingReactions) {
    await pendingReactions;
  }
}

describe("SlackChatClient", () => {
  let client: SlackChatClient;
  const config: SlackConfig = {
    type: "slack",
    token: "xoxb-test-token",
    appToken: "xapp-test-app-token",
    socketMode: true,
  };
  const channelId = "C1234567890";

  beforeEach(() => {
    vi.clearAllMocks();
    setReactionHandler(null);
    setMessageHandler(null);

    // Clear environment variables
    delete process.env.SLACK_TOKEN;
    delete process.env.SLACK_APP_TOKEN;

    // Reset mock implementations
    mockStart.mockResolvedValue(undefined);
    mockStop.mockResolvedValue(undefined);
    mockPostMessage.mockResolvedValue({ ts: "1234567890.123456" });
    mockReactionsAdd.mockResolvedValue({ ok: true });
    mockReactionsRemove.mockResolvedValue({ ok: true });
    mockReactionsGet.mockResolvedValue({ message: { reactions: [] } });
    mockChatDelete.mockResolvedValue({ ok: true });
    mockFilesUploadV2.mockResolvedValue({
      ok: true,
      files: [{ timestamp: "1234567890.999999" }],
    });
    mockConversationsHistory.mockResolvedValue({ messages: [] });
    mockConversationsReplies.mockResolvedValue({ messages: [] });
    mockConversationsMembers.mockResolvedValue({
      members: [],
      response_metadata: {},
    });
    mockUsersInfo.mockResolvedValue({ user: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockEvent.mockImplementation((eventName: string, handler: any) => {
      if (eventName === "reaction_added") {
        setReactionHandler(handler);
      }
      if (eventName === "message") {
        setMessageHandler(handler);
      }
    });

    client = new SlackChatClient(config);
  });

  afterEach(async () => {
    // Clean up - try to disconnect (ignore errors if not connected)
    try {
      await client.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    // Clean up environment variables
    delete process.env.SLACK_TOKEN;
    delete process.env.SLACK_APP_TOKEN;
  });

  describe("constructor", () => {
    it("should create an App instance with the provided config", async () => {
      const { App } = await import("@slack/bolt");
      expect(App).toHaveBeenCalledWith({
        token: config.token,
        appToken: config.appToken,
        socketMode: true,
      });
    });

    it("should register a reaction_added event handler", () => {
      expect(mockEvent).toHaveBeenCalledWith(
        "reaction_added",
        expect.any(Function)
      );
      expect(getReactionHandler()).not.toBeNull();
    });

    it("should register a message event handler", () => {
      expect(mockEvent).toHaveBeenCalledWith("message", expect.any(Function));
      expect(getMessageHandler()).not.toBeNull();
    });

    it("should register a global error handler", () => {
      expect(mockError).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should default socketMode to true when not specified", async () => {
      const configWithoutSocketMode: SlackConfig = {
        type: "slack",
        token: "xoxb-test-token",
        appToken: "xapp-test-app-token",
      };
      const { App } = await import("@slack/bolt");
      vi.mocked(App).mockClear();

      new SlackChatClient(configWithoutSocketMode);

      expect(App).toHaveBeenCalledWith({
        token: configWithoutSocketMode.token,
        appToken: configWithoutSocketMode.appToken,
        socketMode: true,
      });
    });
  });

  describe("config", () => {
    it("should use explicit config values", async () => {
      const { App } = await import("@slack/bolt");
      vi.mocked(App).mockClear();

      const explicitConfig: SlackConfig = {
        type: "slack",
        token: "explicit-token",
        appToken: "explicit-app-token",
        socketMode: true,
      };

      new SlackChatClient(explicitConfig);

      expect(App).toHaveBeenCalledWith({
        token: "explicit-token",
        appToken: "explicit-app-token",
        socketMode: true,
      });
    });

    it("should use environment variables as defaults", async () => {
      process.env.SLACK_TOKEN = "env-token";
      process.env.SLACK_APP_TOKEN = "env-app-token";

      const { App } = await import("@slack/bolt");
      vi.mocked(App).mockClear();

      const envConfig: SlackConfig = {
        type: "slack",
        token: process.env.SLACK_TOKEN,
        appToken: process.env.SLACK_APP_TOKEN,
      };

      new SlackChatClient(envConfig);

      expect(App).toHaveBeenCalledWith({
        token: "env-token",
        appToken: "env-app-token",
        socketMode: true,
      });
    });

    it("should allow explicit config to override environment variables", async () => {
      process.env.SLACK_TOKEN = "env-token";
      process.env.SLACK_APP_TOKEN = "env-app-token";

      const { App } = await import("@slack/bolt");
      vi.mocked(App).mockClear();

      const overrideConfig: SlackConfig = {
        type: "slack",
        token: "override-token",
        appToken: "override-app-token",
      };

      new SlackChatClient(overrideConfig);

      expect(App).toHaveBeenCalledWith({
        token: "override-token",
        appToken: "override-app-token",
        socketMode: true,
      });
    });
  });

  describe("connect()", () => {
    it("should start the app", async () => {
      await client.connect(channelId);

      expect(mockStart).toHaveBeenCalledTimes(1);
    });

    it("should return a Channel object", async () => {
      const channel = await client.connect(channelId);

      expect(channel).toBeInstanceOf(Channel);
      expect(channel.id).toBe(channelId);
      expect(channel.platform).toBe("slack");
    });

    it("should throw error if connection fails", async () => {
      const error = new Error("Connection failed");
      mockStart.mockRejectedValue(error);

      await expect(client.connect(channelId)).rejects.toThrow(
        "Connection failed"
      );
    });
  });

  describe("disconnect()", () => {
    it("should stop the app", async () => {
      await client.connect(channelId);

      await client.disconnect();

      expect(mockStop).toHaveBeenCalledTimes(1);
    });

    it("should clear reaction callbacks", async () => {
      await client.connect(channelId);

      // Subscribe to reactions
      const callback = vi.fn();
      client.subscribeToReactions(channelId, callback);

      await client.disconnect();

      // Simulate a reaction event - callback should not be called
      const handler = getReactionHandler();
      if (handler) {
        await handler({
          event: {
            reaction: "thumbsup",
            user: "U123456",
            item: { channel: channelId, ts: "1234567890.123456" },
            event_ts: "1234567890.123456",
          },
        });
      }

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("Channel.postMessage()", () => {
    it("should call app.client.chat.postMessage()", async () => {
      const channel = await client.connect(channelId);
      const text = "Hello, world!";

      const message = channel.postMessage(text);
      await waitForMessage(message);

      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: channelId,
        text: text,
        unfurl_links: false,
        unfurl_media: false,
      });
    });

    it("should convert markdown bold to Slack format for plain strings", async () => {
      const channel = await client.connect(channelId);

      const message = channel.postMessage("This is **bold** text");
      await waitForMessage(message);

      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: channelId,
        text: "This is *bold* text",
        unfurl_links: false,
        unfurl_media: false,
      });
    });

    it("should convert markdown italic to Slack format for plain strings", async () => {
      const channel = await client.connect(channelId);

      const message = channel.postMessage("This is *italic* text");
      await waitForMessage(message);

      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: channelId,
        text: "This is _italic_ text",
        unfurl_links: false,
        unfurl_media: false,
      });
    });

    it("should convert markdown strikethrough to Slack format for plain strings", async () => {
      const channel = await client.connect(channelId);

      const message = channel.postMessage("This is ~~struck~~ text");
      await waitForMessage(message);

      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: channelId,
        text: "This is ~struck~ text",
        unfurl_links: false,
        unfurl_media: false,
      });
    });

    it("should return a Message object with ts as id", async () => {
      const expectedTs = "1234567890.123456";
      mockPostMessage.mockResolvedValue({ ts: expectedTs });

      const channel = await client.connect(channelId);
      const message = channel.postMessage("Hello!");
      await waitForMessage(message);

      expect(message).toBeInstanceOf(Message);
      expect(message.id).toBe(expectedTs);
      expect(message.channelId).toBe(channelId);
      expect(message.platform).toBe("slack");
    });

    it("should suppress link previews by default", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Check https://example.com");
      await waitForMessage(message);

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          unfurl_links: false,
          unfurl_media: false,
        })
      );
    });

    it("should not suppress link previews when linkPreviews is true", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Check https://example.com", {
        linkPreviews: true,
      });
      await waitForMessage(message);

      const callArgs = mockPostMessage.mock.calls[0][0];
      expect(callArgs.unfurl_links).toBeUndefined();
      expect(callArgs.unfurl_media).toBeUndefined();
    });
  });

  describe("Message.addReactions()", () => {
    it("should call app.client.reactions.add()", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);

      message.addReactions(["thumbsup"]);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledWith({
        channel: channelId,
        timestamp: message.id,
        name: "thumbsup",
      });
    });

    it("should strip leading colons from emoji names", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);

      message.addReactions([":thumbsup"]);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledWith({
        channel: channelId,
        timestamp: message.id,
        name: "thumbsup",
      });
    });

    it("should strip trailing colons from emoji names", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);

      message.addReactions(["thumbsup:"]);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledWith({
        channel: channelId,
        timestamp: message.id,
        name: "thumbsup",
      });
    });

    it("should strip both leading and trailing colons from emoji names", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);

      message.addReactions([":thumbsup:"]);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledWith({
        channel: channelId,
        timestamp: message.id,
        name: "thumbsup",
      });
    });

    it("should call app.client.reactions.add() for each emoji", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);

      message.addReactions(["thumbsup", "heart", "rocket"]);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledTimes(3);
    });

    it("should support arrays of emojis", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);
      const emojis = ["one", "two", "three", "four", "five"];

      message.addReactions(emojis);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledTimes(5);
      emojis.forEach((emoji, index) => {
        expect(mockReactionsAdd).toHaveBeenNthCalledWith(index + 1, {
          channel: channelId,
          timestamp: message.id,
          name: emoji,
        });
      });
    });

    it("should support chaining multiple addReactions() calls", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);

      const result = message
        .addReactions(["thumbsup", "heart"])
        .addReactions(["rocket"]);

      expect(result).toBe(message);

      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledTimes(3);
    });

    it("should strip colons from all emojis in the array", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);

      message.addReactions([":thumbsup:", ":heart:", ":rocket:"]);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenNthCalledWith(1, {
        channel: channelId,
        timestamp: message.id,
        name: "thumbsup",
      });
      expect(mockReactionsAdd).toHaveBeenNthCalledWith(2, {
        channel: channelId,
        timestamp: message.id,
        name: "heart",
      });
      expect(mockReactionsAdd).toHaveBeenNthCalledWith(3, {
        channel: channelId,
        timestamp: message.id,
        name: "rocket",
      });
    });

    it("should handle empty array", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);

      message.addReactions([]);
      await waitForMessage(message);

      expect(mockReactionsAdd).not.toHaveBeenCalled();
    });

    it("should allow chaining addReactions right after postMessage", async () => {
      const channel = await client.connect(channelId);

      const message = channel.postMessage("Test").addReactions(["thumbsup"]);
      await waitForMessage(message);

      expect(message).toBeInstanceOf(Message);
      expect(mockReactionsAdd).toHaveBeenCalledTimes(1);
    });

    it("should add reactions sequentially (not in parallel)", async () => {
      const callOrder: string[] = [];

      mockReactionsAdd.mockImplementation(
        async ({ name }: { name: string }) => {
          callOrder.push(`start-${name}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
          callOrder.push(`end-${name}`);
          return { ok: true };
        }
      );

      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);
      message.addReactions(["1", "2"]);
      await waitForMessage(message);

      // Reactions should be sequential: start-1, end-1, start-2, end-2
      expect(callOrder).toEqual(["start-1", "end-1", "start-2", "end-2"]);
    });
  });

  describe("Message.removeAllReactions()", () => {
    it("should fetch reactions and remove each one", async () => {
      mockReactionsGet.mockResolvedValue({
        message: {
          reactions: [
            { name: "thumbsup", count: 2 },
            { name: "heart", count: 1 },
          ],
        },
      });

      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);

      message.removeAllReactions();
      await waitForMessage(message);

      expect(mockReactionsGet).toHaveBeenCalledWith({
        channel: channelId,
        timestamp: message.id,
      });
      expect(mockReactionsRemove).toHaveBeenCalledTimes(2);
      expect(mockReactionsRemove).toHaveBeenNthCalledWith(1, {
        channel: channelId,
        timestamp: message.id,
        name: "thumbsup",
      });
      expect(mockReactionsRemove).toHaveBeenNthCalledWith(2, {
        channel: channelId,
        timestamp: message.id,
        name: "heart",
      });
    });

    it("should handle no reactions gracefully", async () => {
      mockReactionsGet.mockResolvedValue({ message: {} });

      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);

      message.removeAllReactions();
      await waitForMessage(message);

      expect(mockReactionsRemove).not.toHaveBeenCalled();
    });

    it("should ignore errors when bot has not reacted with an emoji", async () => {
      mockReactionsGet.mockResolvedValue({
        message: {
          reactions: [{ name: "thumbsup", count: 1 }],
        },
      });
      mockReactionsRemove.mockRejectedValue(new Error("no_reaction"));

      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);

      message.removeAllReactions();
      await waitForMessage(message);

      expect(mockReactionsRemove).toHaveBeenCalledTimes(1);
    });

    it("should return the Message instance for chaining", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);

      const returnedMessage = message.removeAllReactions();

      expect(returnedMessage).toBe(message);
    });

    it("should chain with addReactions", async () => {
      mockReactionsGet.mockResolvedValue({
        message: {
          reactions: [{ name: "thumbsup", count: 1 }],
        },
      });

      const channel = await client.connect(channelId);
      const message = channel
        .postMessage("Test")
        .addReactions(["thumbsup"])
        .removeAllReactions()
        .addReactions(["heart"]);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledTimes(2);
      expect(mockReactionsGet).toHaveBeenCalledTimes(1);
      expect(mockReactionsRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe("removeAllReactions() (direct client method)", () => {
    it("should fetch and remove all reactions", async () => {
      mockReactionsGet.mockResolvedValue({
        message: {
          reactions: [{ name: "thumbsup", count: 1 }],
        },
      });

      await client.connect(channelId);
      await client.removeAllReactions("1234567890.123456", channelId);

      expect(mockReactionsGet).toHaveBeenCalledWith({
        channel: channelId,
        timestamp: "1234567890.123456",
      });
      expect(mockReactionsRemove).toHaveBeenCalledWith({
        channel: channelId,
        timestamp: "1234567890.123456",
        name: "thumbsup",
      });
    });
  });

  describe("Message.onReaction()", () => {
    it("should call callback when reaction is added to message", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123456",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should not call callback for reactions on different messages", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      // Simulate a reaction on a DIFFERENT message
      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123456",
          item: { channel: channelId, ts: "different-message-ts" },
          event_ts: "1609459200.000000",
        },
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("should provide correct User object with id", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const userId = "U987654321";
      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "heart",
          user: userId,
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ id: userId }),
        })
      );

      const callArg = callback.mock.calls[0][0] as ReactionEvent;
      expect(callArg.user.id).toBe(userId);
      expect(callArg.user.username).toBeUndefined();
    });

    it("should provide correct emoji in the event", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "rocket",
          user: "U123456",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      const callArg = callback.mock.calls[0][0] as ReactionEvent;
      expect(callArg.emoji).toBe("rocket");
    });

    it("should provide correct messageId in the event", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123456",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      const callArg = callback.mock.calls[0][0] as ReactionEvent;
      expect(callArg.messageId).toBe(message.id);
    });

    it("should provide correct channelId in the event", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123456",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      const callArg = callback.mock.calls[0][0] as ReactionEvent;
      expect(callArg.channelId).toBe(channelId);
    });

    it("should provide correct timestamp in the event", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const eventTs = "1609459200.123456";
      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123456",
          item: { channel: channelId, ts: message.id },
          event_ts: eventTs,
        },
      });

      const callArg = callback.mock.calls[0][0] as ReactionEvent;
      expect(callArg.timestamp).toEqual(new Date(parseFloat(eventTs) * 1000));
    });

    it("should allow offReaction to stop listening", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const handler = getReactionHandler();

      // First event should trigger callback
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123456",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(callback).toHaveBeenCalledTimes(1);

      // Stop listening
      message.offReaction();

      // Second event should NOT trigger callback
      await handler!({
        event: {
          reaction: "heart",
          user: "U123456",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(callback).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it("should support multiple callbacks on same message", async () => {
      const channel = await client.connect(channelId);
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const message = channel
        .postMessage("Test")
        .onReaction(callback1)
        .onReaction(callback2);
      await waitForMessage(message);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123456",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should handle async callbacks", async () => {
      const channel = await client.connect(channelId);
      const results: number[] = [];

      const asyncCallback = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        results.push(1);
      });

      const message = channel.postMessage("Test").onReaction(asyncCallback);
      await waitForMessage(message);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123456",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(asyncCallback).toHaveBeenCalledTimes(1);
      expect(results).toContain(1);
    });

    it("should handle callback errors gracefully", async () => {
      const channel = await client.connect(channelId);
      const errorCallback = vi.fn().mockImplementation(async () => {
        throw new Error("Callback error");
      });
      const normalCallback = vi.fn();

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const message = channel
        .postMessage("Test")
        .onReaction(errorCallback)
        .onReaction(normalCallback);
      await waitForMessage(message);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123456",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(normalCallback).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should be chainable with addReactions", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();

      const message = channel
        .postMessage("Vote!")
        .addReactions(["thumbsup", "thumbsdown"])
        .onReaction(callback);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledTimes(2);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123456",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("Channel.disconnect()", () => {
    it("should clear message reaction callbacks when channel is disconnected", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      // Disconnect the channel
      channel.disconnect();

      // The channel's callbacks are cleared
      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123456",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      // Callback should not be called
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("subscribeToReactions()", () => {
    it("should add callback to reaction callbacks map", async () => {
      await client.connect(channelId);
      const callback = vi.fn();
      const messageId = "1234567890.123456";

      // Subscribe at channel level - gets ALL reactions in the channel
      client.subscribeToReactions(channelId, callback);

      // Trigger event to verify callback was registered
      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123456",
          item: { channel: channelId, ts: messageId },
          event_ts: "1609459200.000000",
        },
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should return unsubscribe function", async () => {
      await client.connect(channelId);
      const callback = vi.fn();
      const messageId = "1234567890.123456";

      const unsubscribe = client.subscribeToReactions(channelId, callback);
      unsubscribe();

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123456",
          item: { channel: channelId, ts: messageId },
          event_ts: "1609459200.000000",
        },
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("should support multiple subscriptions to different channels", async () => {
      await client.connect(channelId);
      const channel1Id = "C111111111";
      const channel2Id = "C222222222";
      const messageId = "1234567890.123456";
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      // Subscribe to different channels
      client.subscribeToReactions(channel1Id, callback1);
      client.subscribeToReactions(channel2Id, callback2);

      const handler = getReactionHandler();

      // Event for channel1
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123456",
          item: { channel: channel1Id, ts: messageId },
          event_ts: "1609459200.000000",
        },
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();

      // Event for channel2
      await handler!({
        event: {
          reaction: "heart",
          user: "U123456",
          item: { channel: channel2Id, ts: messageId },
          event_ts: "1609459200.000000",
        },
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe("addReaction()", () => {
    it("should work when connected", async () => {
      await client.connect(channelId);

      await client.addReaction("1234567890.123456", channelId, "thumbsup");

      expect(mockReactionsAdd).toHaveBeenCalledWith({
        channel: channelId,
        timestamp: "1234567890.123456",
        name: "thumbsup",
      });
    });
  });

  describe("User object", () => {
    it("should be a plain object with id property", async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "star",
          user: "U123456",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(typeof receivedEvent!.user).toBe("object");
      expect(receivedEvent!.user.id).toBe("U123456");
    });

    it("should have undefined username (Slack does not provide username in reaction events)", async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "star",
          user: "U654321",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(receivedEvent!.user.id).toBe("U654321");
      expect(receivedEvent!.user.username).toBeUndefined();
    });
  });

  describe("Message awaiting behavior", () => {
    it("should await message post completion", async () => {
      let postResolved = false;
      mockPostMessage.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        postResolved = true;
        return { ts: "1234567890.123456" };
      });

      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);

      expect(postResolved).toBe(true);
      expect(message.id).toBe("1234567890.123456");
    });

    it("should await all reactions after chaining", async () => {
      const reactionOrder: string[] = [];
      mockReactionsAdd.mockImplementation(
        async ({ name }: { name: string }) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          reactionOrder.push(name);
          return { ok: true };
        }
      );

      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test");
      await waitForMessage(message);

      message.addReactions(["first", "second", "third"]);
      await waitForMessage(message);

      expect(reactionOrder).toEqual(["first", "second", "third"]);
    });

    it("should allow chaining directly on postMessage return", async () => {
      const channel = await client.connect(channelId);

      // This should work - chain reactions on postMessage return
      const message = channel
        .postMessage("Test")
        .addReactions(["thumbsup", "heart"]);
      await waitForMessage(message);

      expect(message.id).toBe("1234567890.123456");
      expect(mockReactionsAdd).toHaveBeenCalledTimes(2);
    });
  });

  describe("Channel.onMessage()", () => {
    it("should call callback when a message is received", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onMessage(callback);

      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U999",
          ts: "1234567890.111111",
          text: "Hello from user",
        },
        context: {},
      });

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0] as Message;
      expect(event.content).toBe("Hello from user");
      expect(event.author.id).toBe("U999");
      expect(event.channelId).toBe(channelId);
      expect(event.attachments).toEqual([]);
    });

    it("should include file attachments from the message", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onMessage(callback);

      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U999",
          ts: "1234567890.111111",
          text: "Here are some files",
          files: [
            {
              url_private: "https://files.slack.com/file1.png",
              name: "screenshot.png",
              mimetype: "image/png",
              size: 12345,
            },
            {
              url_private: "https://files.slack.com/file2.txt",
              name: "notes.txt",
              mimetype: "text/plain",
              size: 256,
            },
          ],
        },
        context: {},
      });

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0] as Message;
      expect(event.attachments).toHaveLength(2);
      expect(event.attachments[0]).toEqual({
        url: "https://files.slack.com/file1.png",
        name: "screenshot.png",
        contentType: "image/png",
        size: 12345,
      });
      expect(event.attachments[1]).toEqual({
        url: "https://files.slack.com/file2.txt",
        name: "notes.txt",
        contentType: "text/plain",
        size: 256,
      });
    });

    it("should set contentType to undefined when mimetype is null, undefined, or empty", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onMessage(callback);

      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U999",
          ts: "1234567890.111111",
          text: "Files with missing mimetypes",
          files: [
            {
              url_private: "https://files.slack.com/file1.bin",
              name: "data.bin",
              mimetype: null,
              size: 100,
            },
            {
              url_private: "https://files.slack.com/file2.bin",
              name: "blob.bin",
              size: 200,
            },
            {
              url_private: "https://files.slack.com/file3.bin",
              name: "empty.bin",
              mimetype: "",
              size: 300,
            },
          ],
        },
        context: {},
      });

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0] as Message;
      expect(event.attachments).toHaveLength(3);
      expect(event.attachments[0].contentType).toBeUndefined();
      expect(event.attachments[1].contentType).toBeUndefined();
      expect(event.attachments[2].contentType).toBeUndefined();
    });

    it("should skip files missing url or name", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onMessage(callback);

      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U999",
          ts: "1234567890.111111",
          text: "Partial files",
          files: [
            {
              url_private: "https://files.slack.com/valid.txt",
              name: "valid.txt",
              mimetype: "text/plain",
              size: 10,
            },
            {
              name: "no-url.txt",
              mimetype: "text/plain",
              size: 20,
            },
            {
              url_private: "https://files.slack.com/no-name.txt",
              mimetype: "text/plain",
              size: 30,
            },
          ],
        },
        context: {},
      });

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0] as Message;
      expect(event.attachments).toHaveLength(1);
      expect(event.attachments[0].name).toBe("valid.txt");
    });

    it("should not call callback for different channel", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onMessage(callback);

      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: "C_OTHER",
          user: "U999",
          ts: "1234567890.111111",
          text: "Wrong channel",
        },
        context: {},
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("should skip bot own messages", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onMessage(callback);

      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U_BOT",
          ts: "1234567890.111111",
          text: "Bot message",
          bot_id: "B123",
        },
        context: { botId: "B123" },
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("should return an unsubscribe function", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const unsubscribe = channel.onMessage(callback);

      unsubscribe();

      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U999",
          ts: "1234567890.111111",
          text: "After unsubscribe",
        },
        context: {},
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it("should allow deleting a received message", async () => {
      const channel = await client.connect(channelId);
      let receivedMessage: Message | null = null;
      channel.onMessage((msg) => {
        receivedMessage = msg;
      });

      mockConversationsReplies.mockResolvedValue({
        messages: [{ ts: "1234567890.111111" }],
      });

      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U999",
          ts: "1234567890.111111",
          text: "!help",
        },
        context: {},
      });

      expect(receivedMessage).not.toBeNull();
      await receivedMessage!.delete();

      expect(mockChatDelete).toHaveBeenCalledWith({
        channel: channelId,
        ts: "1234567890.111111",
      });
    });

    it("should allow reacting to a received message", async () => {
      const channel = await client.connect(channelId);
      let receivedMessage: Message | null = null;
      channel.onMessage((msg) => {
        receivedMessage = msg;
      });

      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U999",
          ts: "1234567890.111111",
          text: "!ping",
        },
        context: {},
      });

      expect(receivedMessage).not.toBeNull();
      receivedMessage!.addReactions(["white_check_mark"]);
      await receivedMessage!.waitForReactions();

      expect(mockReactionsAdd).toHaveBeenCalledWith({
        channel: channelId,
        timestamp: "1234567890.111111",
        name: "white_check_mark",
      });
    });

    it("should allow replying to a received message", async () => {
      const channel = await client.connect(channelId);
      let receivedMessage: Message | null = null;
      channel.onMessage((msg) => {
        receivedMessage = msg;
      });

      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U999",
          ts: "1234567890.111111",
          text: "!info",
        },
        context: {},
      });

      expect(receivedMessage).not.toBeNull();
      const reply = receivedMessage!.reply("Here is the info");
      await waitForMessage(reply);

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: channelId,
          text: "Here is the info",
          thread_ts: "1234567890.111111",
        })
      );
    });
  });

  describe("Channel.sendTyping()", () => {
    it("should be a no-op (resolve without error)", async () => {
      const channel = await client.connect(channelId);
      // Should not throw
      await channel.sendTyping();
    });
  });

  describe("Channel.withTyping()", () => {
    it("should execute fn and return its result", async () => {
      const channel = await client.connect(channelId);
      const result = await channel.withTyping(async () => "done");

      expect(result).toBe("done");
    });

    it("should propagate errors from fn", async () => {
      const channel = await client.connect(channelId);

      await expect(
        channel.withTyping(async () => {
          throw new Error("work failed");
        })
      ).rejects.toThrow("work failed");
    });
  });

  describe("File attachments", () => {
    it("should upload text files via filesUploadV2 with content field", async () => {
      const channel = await client.connect(channelId);
      await channel.postMessage("Here is a file", {
        files: [{ content: "plain text", name: "notes.txt" }],
      });

      expect(mockFilesUploadV2).toHaveBeenCalledTimes(1);
      const args = mockFilesUploadV2.mock.calls[0][0];
      expect(args.content).toBe("plain text");
      expect(args.filename).toBe("notes.txt");
      expect(args.file).toBeUndefined();
    });

    it("should upload binary files via filesUploadV2 with file field", async () => {
      const channel = await client.connect(channelId);
      const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      await channel.postMessage("Binary file", {
        files: [{ content: buffer, name: "image.png" }],
      });

      expect(mockFilesUploadV2).toHaveBeenCalledTimes(1);
      const args = mockFilesUploadV2.mock.calls[0][0];
      expect(args.file).toBe(buffer);
      expect(args.content).toBeUndefined();
    });

    it("should only include initial_comment on the first file", async () => {
      const channel = await client.connect(channelId);
      await channel.postMessage("Two files", {
        files: [
          { content: "file1", name: "a.txt" },
          { content: "file2", name: "b.txt" },
        ],
      });

      expect(mockFilesUploadV2).toHaveBeenCalledTimes(2);
      expect(mockFilesUploadV2.mock.calls[0][0].initial_comment).toBe(
        "Two files"
      );
      expect(
        mockFilesUploadV2.mock.calls[1][0].initial_comment
      ).toBeUndefined();
    });

    it("should return empty ID for file-only uploads", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postMessage("With file", {
        files: [{ content: "data", name: "file.txt" }],
      });

      // Slack filesUploadV2 doesn't reliably return a message timestamp
      expect(msg.id).toBe("");
    });
  });

  describe("Message.startThread()", () => {
    it("should return the message timestamp as thread ID", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postMessage("Thread root");
      const thread = await msg.startThread("Thread Name");

      expect(thread.id).toBe(msg.id);
      expect(thread.channelId).toBe(channelId);
      expect(thread.platform).toBe("slack");
    });
  });

  describe("Message.delete()", () => {
    it("should delete a message without thread replies", async () => {
      mockConversationsReplies.mockResolvedValue({
        messages: [{ ts: "1234567890.123456" }], // only parent, no replies
      });

      const channel = await client.connect(channelId);
      const msg = await channel.postMessage("Hello");

      await msg.delete();

      expect(mockConversationsReplies).toHaveBeenCalledWith({
        channel: channelId,
        ts: msg.id,
      });
      expect(mockChatDelete).toHaveBeenCalledTimes(1);
      expect(mockChatDelete).toHaveBeenCalledWith({
        channel: channelId,
        ts: msg.id,
      });
    });

    it("should delete thread replies before deleting the parent", async () => {
      mockConversationsReplies.mockResolvedValue({
        messages: [
          { ts: "1234567890.123456" }, // parent
          { ts: "1234567890.200000" }, // reply 1
          { ts: "1234567890.300000" }, // reply 2
        ],
      });

      const channel = await client.connect(channelId);
      const msg = await channel.postMessage("Hello");

      await msg.delete();

      // 2 replies + 1 parent = 3 deletes
      expect(mockChatDelete).toHaveBeenCalledTimes(3);
      // Replies deleted in reverse order, then parent
      expect(mockChatDelete).toHaveBeenNthCalledWith(1, {
        channel: channelId,
        ts: "1234567890.300000",
      });
      expect(mockChatDelete).toHaveBeenNthCalledWith(2, {
        channel: channelId,
        ts: "1234567890.200000",
      });
      expect(mockChatDelete).toHaveBeenNthCalledWith(3, {
        channel: channelId,
        ts: msg.id,
      });
    });
  });

  describe("Channel.bulkDelete()", () => {
    it("should delete messages one-by-one from history", async () => {
      mockConversationsHistory.mockResolvedValue({
        messages: [{ ts: "111.111" }, { ts: "222.222" }, { ts: "333.333" }],
      });

      const channel = await client.connect(channelId);
      const deleted = await channel.bulkDelete(3);

      expect(mockConversationsHistory).toHaveBeenCalledWith({
        channel: channelId,
        limit: 3,
      });
      expect(mockChatDelete).toHaveBeenCalledTimes(3);
      expect(deleted).toBe(3);
    });

    it("should continue deleting when some messages fail", async () => {
      mockConversationsHistory.mockResolvedValue({
        messages: [{ ts: "111.111" }, { ts: "222.222" }],
      });
      mockChatDelete
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce(new Error("Cannot delete"));

      const channel = await client.connect(channelId);
      const deleted = await channel.bulkDelete(2);

      expect(deleted).toBe(1);
    });
  });

  describe("Channel.getThreads()", () => {
    it("should return messages with replies as threads", async () => {
      mockConversationsHistory.mockResolvedValue({
        messages: [
          { ts: "111.111", reply_count: 3 },
          { ts: "222.222" },
          { ts: "333.333", reply_count: 1 },
        ],
      });

      const channel = await client.connect(channelId);
      const threads = await channel.getThreads();

      expect(threads).toHaveLength(2);
      expect(threads[0].id).toBe("111.111");
      expect(threads[1].id).toBe("333.333");
    });

    it("should delete a thread via thread.delete()", async () => {
      mockConversationsHistory.mockResolvedValue({
        messages: [{ ts: "111.111", reply_count: 2 }],
      });
      mockConversationsReplies.mockResolvedValue({
        messages: [{ ts: "111.111" }, { ts: "111.222" }],
      });

      const channel = await client.connect(channelId);
      const threads = await channel.getThreads();

      await threads[0].delete();

      expect(mockConversationsReplies).toHaveBeenCalledWith({
        channel: channelId,
        ts: "111.111",
      });
      // Reply + parent = 2 deletes
      expect(mockChatDelete).toHaveBeenCalledTimes(2);
      expect(mockChatDelete).toHaveBeenCalledWith({
        channel: channelId,
        ts: "111.222",
      });
      expect(mockChatDelete).toHaveBeenCalledWith({
        channel: channelId,
        ts: "111.111",
      });
    });
  });

  describe("Channel.getMembers()", () => {
    it("should return members with user info", async () => {
      mockConversationsMembers.mockResolvedValue({
        members: ["U111", "U222"],
        response_metadata: {},
      });
      mockUsersInfo
        .mockResolvedValueOnce({
          user: {
            name: "alice",
            real_name: "Alice Adams",
            profile: { display_name: "Ali" },
          },
        })
        .mockResolvedValueOnce({
          user: {
            name: "bob",
            real_name: "Bob Brown",
            profile: { display_name: "Bobby" },
          },
        });

      const channel = await client.connect(channelId);
      const members = await channel.getMembers();

      expect(members).toHaveLength(2);
      expect(members[0]).toEqual({
        id: "U111",
        username: "alice",
        displayName: "Ali",
        mention: "<@U111>",
      });
      expect(members[1]).toEqual({
        id: "U222",
        username: "bob",
        displayName: "Bobby",
        mention: "<@U222>",
      });
    });

    it("should fall back to real_name when display_name is empty", async () => {
      mockConversationsMembers.mockResolvedValue({
        members: ["U111"],
        response_metadata: {},
      });
      mockUsersInfo.mockResolvedValue({
        user: {
          name: "alice",
          real_name: "Alice Adams",
          profile: { display_name: "" },
        },
      });

      const channel = await client.connect(channelId);
      const members = await channel.getMembers();

      expect(members[0].displayName).toBe("Alice Adams");
    });

    it("should fall back to name when display_name and real_name are empty", async () => {
      mockConversationsMembers.mockResolvedValue({
        members: ["U111"],
        response_metadata: {},
      });
      mockUsersInfo.mockResolvedValue({
        user: {
          name: "alice",
          profile: { display_name: "" },
        },
      });

      const channel = await client.connect(channelId);
      const members = await channel.getMembers();

      expect(members[0].displayName).toBe("alice");
    });

    it("should paginate through all members", async () => {
      mockConversationsMembers
        .mockResolvedValueOnce({
          members: ["U111"],
          response_metadata: { next_cursor: "cursor123" },
        })
        .mockResolvedValueOnce({
          members: ["U222"],
          response_metadata: {},
        });
      mockUsersInfo
        .mockResolvedValueOnce({
          user: { name: "alice", real_name: "Alice", profile: {} },
        })
        .mockResolvedValueOnce({
          user: { name: "bob", real_name: "Bob", profile: {} },
        });

      const channel = await client.connect(channelId);
      const members = await channel.getMembers();

      expect(mockConversationsMembers).toHaveBeenCalledTimes(2);
      expect(members).toHaveLength(2);
    });

    it("should return empty array when channel has no members", async () => {
      mockConversationsMembers.mockResolvedValue({
        members: [],
        response_metadata: {},
      });

      const channel = await client.connect(channelId);
      const members = await channel.getMembers();

      expect(members).toEqual([]);
    });

    it("should produce mention strings in <@id> format", async () => {
      mockConversationsMembers.mockResolvedValue({
        members: ["U999"],
        response_metadata: {},
      });
      mockUsersInfo.mockResolvedValue({
        user: { name: "tester", real_name: "Tester", profile: {} },
      });

      const channel = await client.connect(channelId);
      const members = await channel.getMembers();

      expect(members[0].mention).toBe("<@U999>");
    });
  });

  describe("Connection resilience", () => {
    it("should forward errors from app.error() to onError callbacks", async () => {
      const errorCallback = vi.fn();
      client.onError(errorCallback);

      // Get the error handler registered with app.error()
      const errorHandler = mockError.mock.calls[0][0];
      const testError = new Error("Socket error");
      await errorHandler(testError);

      expect(errorCallback).toHaveBeenCalledWith(testError);
    });

    it("should return unsubscribe function from onError", async () => {
      const errorCallback = vi.fn();
      const unsub = client.onError(errorCallback);
      unsub();

      const errorHandler = mockError.mock.calls[0][0];
      await errorHandler(new Error("After unsub"));

      expect(errorCallback).not.toHaveBeenCalled();
    });

    it("should return unsubscribe function from onDisconnect", async () => {
      const disconnectCallback = vi.fn();
      const unsub = client.onDisconnect(disconnectCallback);

      expect(typeof unsub).toBe("function");
      unsub();
    });
  });

  describe("integration: full workflow", () => {
    it("should support posting a message with reactions and listening for reactions", async () => {
      const channel = await client.connect(channelId);

      // Set up reaction listener on message
      const reactions: ReactionEvent[] = [];

      // Post a message with reactions and listener
      const message = channel
        .postMessage("Pick a number:")
        .addReactions(["one", "two", "three"])
        .onReaction((event) => {
          reactions.push(event);
        });
      await waitForMessage(message);

      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      expect(mockReactionsAdd).toHaveBeenCalledTimes(3);

      // Simulate a user reacting
      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "two",
          user: "U_VOTER",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(reactions).toHaveLength(1);
      expect(reactions[0].emoji).toBe("two");
      expect(reactions[0].user.id).toBe("U_VOTER");
    });
  });

  describe("Message.setReactions()", () => {
    it("should add emojis on first call", async () => {
      const channel = await client.connect(channelId);
      const message = channel
        .postMessage("Test")
        .setReactions([":thumbsup:", ":heart:"]);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledTimes(2);
    });

    it("should diff emojis on subsequent calls", async () => {
      const channel = await client.connect(channelId);
      const message = await channel.postMessage("Test");

      message.setReactions([":thumbsup:", ":heart:"]);
      await message.waitForReactions();
      mockReactionsAdd.mockClear();

      message.setReactions([":thumbsup:", ":rocket:"]);
      await message.waitForReactions();

      // Should remove :heart: and add :rocket:
      expect(mockReactionsRemove).toHaveBeenCalledWith(
        expect.objectContaining({ name: "heart" })
      );
      expect(mockReactionsAdd).toHaveBeenCalledWith(
        expect.objectContaining({ name: "rocket" })
      );
      expect(mockReactionsAdd).toHaveBeenCalledTimes(1);
    });

    it("should replace reaction handler", async () => {
      const channel = await client.connect(channelId);
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const message = await channel.postMessage("Test");
      message.setReactions([":thumbsup:"], handler1);
      message.setReactions([":thumbsup:"], handler2);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("Channel.postDismissable()", () => {
    it("should post message with wastebasket reaction", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postDismissable("Dismissable", "U_OWNER");
      await msg.waitForReactions();

      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      expect(mockReactionsAdd).toHaveBeenCalledWith(
        expect.objectContaining({ name: "wastebasket" })
      );
    });

    it("should delete message when owner reacts with wastebasket", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postDismissable("Dismissable", "U_OWNER");
      await msg.waitForReactions();

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "wastebasket",
          user: "U_OWNER",
          item: { channel: channelId, ts: msg.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(mockChatDelete).toHaveBeenCalledTimes(1);
    });

    it("should ignore reactions from non-owners", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postDismissable("Dismissable", "U_OWNER");
      await msg.waitForReactions();

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "wastebasket",
          user: "U_OTHER",
          item: { channel: channelId, ts: msg.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(mockChatDelete).not.toHaveBeenCalled();
    });

    it("should ignore non-wastebasket reactions from owner", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postDismissable("Dismissable", "U_OWNER");
      await msg.waitForReactions();

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U_OWNER",
          item: { channel: channelId, ts: msg.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(mockChatDelete).not.toHaveBeenCalled();
    });
  });

  describe("PendingMessage offReaction fix", () => {
    it("should clear deferred callbacks when offReaction is called", async () => {
      const channel = await client.connect(channelId);
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const message = channel.postMessage("Test");
      message.onReaction(handler1);
      message.offReaction();
      message.onReaction(handler2);
      await waitForMessage(message);

      const reactionHandler = getReactionHandler();
      await reactionHandler!({
        event: {
          reaction: "thumbsup",
          user: "U123",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("should subscribe directly after message resolves", async () => {
      const channel = await client.connect(channelId);
      const message = await channel.postMessage("Test");

      const callback = vi.fn();
      message.onReaction(callback);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "thumbsup",
          user: "U123",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
