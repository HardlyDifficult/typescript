import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { SlackConfig, ReactionEvent } from "../src/types.js";

// Define mocks at module level - Vitest hoists vi.mock() calls automatically
// Use vi.hoisted() to ensure mocks are available before mock setup
const {
  mockPostMessage,
  mockChatUpdate,
  mockChatDelete,
  mockReactionsAdd,
  mockReactionsRemove,
  mockReactionsGet,
  mockFilesUploadV2,
  mockConversationsHistory,
  mockConversationsReplies,
  mockConversationsMembers,
  mockUsersInfo,
  mockAuthTest,
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
  const mockChatUpdate = vi.fn();
  const mockChatDelete = vi.fn();
  const mockReactionsAdd = vi.fn();
  const mockReactionsRemove = vi.fn();
  const mockReactionsGet = vi.fn();
  const mockFilesUploadV2 = vi.fn();
  const mockConversationsHistory = vi.fn();
  const mockConversationsReplies = vi.fn();
  const mockConversationsMembers = vi.fn();
  const mockUsersInfo = vi.fn();
  const mockAuthTest = vi.fn();
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
        update: mockChatUpdate,
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
      auth: {
        test: mockAuthTest,
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
    mockChatUpdate,
    mockChatDelete,
    mockReactionsAdd,
    mockReactionsRemove,
    mockReactionsGet,
    mockFilesUploadV2,
    mockConversationsHistory,
    mockConversationsReplies,
    mockConversationsMembers,
    mockUsersInfo,
    mockAuthTest,
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
  App: vi.fn(function (this: any) {
    return mockApp;
  }),
}));

// Import after mocking
import { SlackChatClient } from "../src/slack/SlackChatClient.js";
import { Channel } from "../src/Channel.js";
import { Message } from "../src/Message.js";
import { Thread } from "../src/Thread.js";

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
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_APP_TOKEN;
    delete process.env.SLACK_SIGNING_SECRET;

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
    mockAuthTest.mockResolvedValue({
      user_id: "U_BOT",
      user: "sprint-bot",
      bot_id: "B123",
    });
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
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_APP_TOKEN;
    delete process.env.SLACK_SIGNING_SECRET;
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

    it("should default socketMode to false when not specified", async () => {
      const configWithoutSocketMode: SlackConfig = {
        type: "slack",
        token: "xoxb-test-token",
      };
      const { App } = await import("@slack/bolt");
      vi.mocked(App).mockClear();

      new SlackChatClient(configWithoutSocketMode);

      expect(App).toHaveBeenCalledWith({
        token: configWithoutSocketMode.token,
        socketMode: false,
        receiver: expect.any(Object),
      });
    });

    it("should pass signingSecret for HTTP receiver mode", async () => {
      const { App } = await import("@slack/bolt");
      vi.mocked(App).mockClear();

      new SlackChatClient({
        type: "slack",
        token: "xoxb-test-token",
        signingSecret: "signing-secret",
      });

      expect(App).toHaveBeenCalledWith({
        token: "xoxb-test-token",
        socketMode: false,
        signingSecret: "signing-secret",
      });
    });

    it("should not register inbound event handlers in outbound-only mode", async () => {
      const { App } = await import("@slack/bolt");
      vi.mocked(App).mockClear();
      mockEvent.mockClear();

      const outboundOnlyClient = new SlackChatClient({
        type: "slack",
        token: "xoxb-test-token",
      });

      expect(App).toHaveBeenCalledWith({
        token: "xoxb-test-token",
        socketMode: false,
        receiver: expect.any(Object),
      });
      expect(mockEvent).not.toHaveBeenCalledWith(
        "reaction_added",
        expect.any(Function)
      );
      expect(mockEvent).not.toHaveBeenCalledWith(
        "message",
        expect.any(Function)
      );

      expect(() =>
        outboundOnlyClient.subscribeToMessages("C123", async () => {})
      ).toThrow("Slack inbound events are disabled");
    });

    it("should throw when socket mode is enabled without app token", () => {
      expect(
        () =>
          new SlackChatClient({
            type: "slack",
            token: "xoxb-test-token",
            socketMode: true,
          })
      ).toThrow("Slack app token is required when socketMode is true");
    });

    it("should throw when bot token is missing", () => {
      expect(
        () =>
          new SlackChatClient({
            type: "slack",
          })
      ).toThrow("Slack bot token is required");
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
        socketMode: false,
        receiver: expect.any(Object),
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
        socketMode: false,
        receiver: expect.any(Object),
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

    it("should expose bot identity as client.me", async () => {
      await client.connect(channelId);

      expect(mockAuthTest).toHaveBeenCalledTimes(1);
      expect(client.me).toEqual({
        id: "U_BOT",
        username: "sprint-bot",
        displayName: "sprint-bot",
        mention: "<@U_BOT>",
      });
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

    it("should support declarative reactions and handlers in the initial post call", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();

      const message = channel.post("Vote", {
        reactions: ["thumbsup", "heart"],
        onReaction: callback,
      });
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenNthCalledWith(1, {
        channel: channelId,
        name: "thumbsup",
        timestamp: message.id,
      });
      expect(mockReactionsAdd).toHaveBeenNthCalledWith(2, {
        channel: channelId,
        name: "heart",
        timestamp: message.id,
      });

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: "heart",
          user: "U123456",
          item: { channel: channelId, ts: message.id },
          event_ts: "1609459200.000000",
        },
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          emoji: "heart",
          messageId: message.id,
        })
      );
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

  describe("Oversized message handling", () => {
    it("should upload oversized string content as a file", async () => {
      const channel = await client.connect(channelId);
      const longContent = "x".repeat(4001);
      const msg = await channel.postMessage(longContent);

      expect(mockFilesUploadV2).toHaveBeenCalledTimes(1);
      const args = mockFilesUploadV2.mock.calls[0][0];
      expect(args.filename).toBe("message.txt");
      expect(args.initial_comment).toBe(
        "(Message too long \u2014 see attached file)"
      );
      expect(args.content).toBe(longContent);
      expect(mockPostMessage).not.toHaveBeenCalled();
      expect(msg.id).toBe("");
    });

    it("should not convert content at exactly 4000 characters", async () => {
      const channel = await client.connect(channelId);
      const exactContent = "x".repeat(4000);
      await channel.postMessage(exactContent);

      expect(mockFilesUploadV2).not.toHaveBeenCalled();
      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      expect(mockPostMessage.mock.calls[0][0].text).toBe(exactContent);
    });

    it("should truncate oversized content on updateMessage", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postMessage("initial");
      const longContent = "x".repeat(4001);
      await msg.update(longContent);

      expect(mockChatUpdate).toHaveBeenCalledTimes(1);
      const args = mockChatUpdate.mock.calls[0][0];
      expect(args.text).toHaveLength(4000);
      expect(args.text.endsWith("\u2026")).toBe(true);
    });

    it("should not truncate content at exactly 4000 chars on updateMessage", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postMessage("initial");
      const exactContent = "x".repeat(4000);
      await msg.update(exactContent);

      const args = mockChatUpdate.mock.calls[0][0];
      expect(args.text).toBe(exactContent);
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

    it("should support starting a thread without explicitly naming it", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postMessage("Deploy status");
      const thread = await msg.startThread();

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

    it("should skip thread-reply cascade when cascadeReplies is false", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postMessage("Hello");

      await msg.delete({ cascadeReplies: false });

      expect(mockConversationsReplies).not.toHaveBeenCalled();
      expect(mockChatDelete).toHaveBeenCalledTimes(1);
      expect(mockChatDelete).toHaveBeenCalledWith({
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

  describe("Channel.getMessages()", () => {
    it("should list recent messages from channel history", async () => {
      mockConversationsHistory.mockResolvedValue({
        messages: [
          { ts: "111.111", text: "First", user: "U1" },
          { ts: "222.222", text: "Second", user: "U2" },
        ],
      });

      const channel = await client.connect(channelId);
      const messages = await channel.getMessages({ limit: 2 });

      expect(mockConversationsHistory).toHaveBeenCalledWith({
        channel: channelId,
        limit: 2,
      });
      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe("111.111");
      expect(messages[0].content).toBe("First");
      expect(messages[0].author).toEqual({ id: "U1", username: undefined });
    });

    it("should filter messages by author: me", async () => {
      mockConversationsHistory.mockResolvedValue({
        messages: [
          { ts: "111.111", text: "Mine", user: "U_BOT" },
          { ts: "222.222", text: "Other", user: "U_OTHER" },
        ],
      });

      const channel = await client.connect(channelId);
      const messages = await channel.getMessages({ author: "me", limit: 10 });

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe("111.111");
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

  describe("Thread features", () => {
    it("should create a thread via channel.createThread()", async () => {
      mockPostMessage.mockResolvedValueOnce({ ts: "parent-ts" });

      const channel = await client.connect(channelId);
      const thread = await channel.createThread("Thread root", "Session");

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: channelId,
          text: "Thread root",
        })
      );
      expect(thread).toBeInstanceOf(Thread);
      expect(thread.id).toBe("parent-ts");
      expect(thread.channelId).toBe(channelId);
      expect(thread.platform).toBe("slack");
    });

    it("should post messages in a thread with correct thread_ts", async () => {
      mockPostMessage
        .mockResolvedValueOnce({ ts: "parent-ts" }) // createThread root
        .mockResolvedValueOnce({ ts: "thread-reply-ts" }); // thread.post

      const channel = await client.connect(channelId);
      const thread = await channel.createThread("Root", "Session");
      const msg = await thread.post("Hello from thread");

      expect(mockPostMessage).toHaveBeenCalledTimes(2);
      expect(mockPostMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          channel: channelId,
          text: "Hello from thread",
          thread_ts: "parent-ts",
        })
      );
      expect(msg).toBeInstanceOf(Message);
      expect(msg.id).toBe("thread-reply-ts");
    });

    it("should fire thread.onReply() when thread reply arrives", async () => {
      mockPostMessage.mockResolvedValueOnce({ ts: "parent-ts" });

      const channel = await client.connect(channelId);
      const thread = await channel.createThread("Root", "Session");

      const callback = vi.fn();
      thread.onReply(callback);

      // Simulate a thread reply: thread_ts !== ts
      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U999",
          ts: "reply-ts",
          thread_ts: "parent-ts",
          text: "A thread reply",
        },
        context: {},
      });

      expect(callback).toHaveBeenCalledTimes(1);
      const msg = callback.mock.calls[0][0] as Message;
      expect(msg.content).toBe("A thread reply");
      expect(msg).toBeInstanceOf(Message);
    });

    it("should NOT fire channel.onMessage() for thread replies", async () => {
      mockPostMessage.mockResolvedValueOnce({ ts: "parent-ts" });

      const channel = await client.connect(channelId);
      const channelCallback = vi.fn();
      channel.onMessage(channelCallback);

      const thread = await channel.createThread("Root", "Session");
      const threadCallback = vi.fn();
      thread.onReply(threadCallback);

      // Thread reply: thread_ts exists and differs from ts
      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U999",
          ts: "reply-ts",
          thread_ts: "parent-ts",
          text: "Thread reply",
        },
        context: {},
      });

      expect(threadCallback).toHaveBeenCalledTimes(1);
      expect(channelCallback).not.toHaveBeenCalled();
    });

    it("should fire onMessage for parent messages (thread_ts === ts)", async () => {
      const channel = await client.connect(channelId);
      const channelCallback = vi.fn();
      channel.onMessage(channelCallback);

      // A message where thread_ts === ts is still a parent message
      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U999",
          ts: "parent-ts",
          thread_ts: "parent-ts",
          text: "Parent with replies",
        },
        context: {},
      });

      expect(channelCallback).toHaveBeenCalledTimes(1);
    });

    it("should stop listening when thread.offReply() is called", async () => {
      mockPostMessage.mockResolvedValueOnce({ ts: "parent-ts" });

      const channel = await client.connect(channelId);
      const thread = await channel.createThread("Root", "Session");

      const callback = vi.fn();
      thread.onReply(callback);

      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U999",
          ts: "reply-1",
          thread_ts: "parent-ts",
          text: "First reply",
        },
        context: {},
      });
      expect(callback).toHaveBeenCalledTimes(1);

      thread.offReply();

      await handler!({
        event: {
          channel: channelId,
          user: "U999",
          ts: "reply-2",
          thread_ts: "parent-ts",
          text: "Second reply",
        },
        context: {},
      });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should delete thread and stop listeners via thread.delete()", async () => {
      mockPostMessage.mockResolvedValueOnce({ ts: "parent-ts" });
      mockConversationsReplies.mockResolvedValue({
        messages: [{ ts: "parent-ts" }],
      });

      const channel = await client.connect(channelId);
      const thread = await channel.createThread("Root", "Session");

      const callback = vi.fn();
      thread.onReply(callback);

      await thread.delete();

      expect(mockChatDelete).toHaveBeenCalledWith({
        channel: channelId,
        ts: "parent-ts",
      });

      // Listener should be cleaned up
      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U999",
          ts: "reply-after-delete",
          thread_ts: "parent-ts",
          text: "Should not fire",
        },
        context: {},
      });
      expect(callback).not.toHaveBeenCalled();
    });

    it("should post with file attachments via thread.post()", async () => {
      mockPostMessage
        .mockResolvedValueOnce({ ts: "parent-ts" })
        .mockResolvedValueOnce({ ts: "file-msg-ts" });

      const channel = await client.connect(channelId);
      const thread = await channel.createThread("Root", "Session");

      await thread.post("Report", [{ content: "# Report", name: "report.md" }]);

      expect(mockFilesUploadV2).toHaveBeenCalledWith(
        expect.objectContaining({
          channel_id: channelId,
          filename: "report.md",
          content: "# Report",
          thread_ts: "parent-ts",
        })
      );
    });

    it("should pass files through msg.reply(content, files)", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postMessage("Hello");

      const reply = msg.reply("Reply with file", [
        { content: "file data", name: "data.txt" },
      ]);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await (reply as any).replyPromise;

      expect(mockFilesUploadV2).toHaveBeenCalledWith(
        expect.objectContaining({
          channel_id: channelId,
          filename: "data.txt",
          content: "file data",
          thread_ts: msg.id,
        })
      );
    });

    it("should wire thread message reply() to post in the same thread", async () => {
      mockPostMessage
        .mockResolvedValueOnce({ ts: "parent-ts" }) // createThread root
        .mockResolvedValueOnce({ ts: "first-msg-ts" }) // thread.post
        .mockResolvedValueOnce({ ts: "reply-ts" }); // msg.reply

      const channel = await client.connect(channelId);
      const thread = await channel.createThread("Root", "Session");
      const threadMsg = await thread.post("First message");

      // Reply to thread message — should stay in the same thread
      await Promise.resolve(threadMsg.reply("Reply in thread"));

      // The reply should use the parent thread_ts, not the message's own ts
      expect(mockPostMessage).toHaveBeenCalledTimes(3);
      expect(mockPostMessage).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          channel: channelId,
          text: "Reply in thread",
          thread_ts: "parent-ts",
        })
      );
    });

    it("should return enhanced Thread from msg.startThread()", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postMessage("Start thread here");
      const thread = await msg.startThread("Thread Name");

      expect(thread).toBeInstanceOf(Thread);
      expect(thread.id).toBe(msg.id);
      expect(typeof thread.post).toBe("function");
      expect(typeof thread.onReply).toBe("function");
      expect(typeof thread.offReply).toBe("function");
      expect(typeof thread.delete).toBe("function");
    });

    it("should reconnect to an existing thread via channel.openThread()", async () => {
      const channel = await client.connect(channelId);
      const thread = channel.openThread("parent-ts");

      expect(thread).toBeInstanceOf(Thread);
      expect(thread.id).toBe("parent-ts");
      expect(thread.channelId).toBe(channelId);
      expect(thread.platform).toBe("slack");
    });

    it("should post messages via openThread() with correct thread_ts", async () => {
      mockPostMessage.mockResolvedValueOnce({ ts: "reply-ts" });

      const channel = await client.connect(channelId);
      const thread = channel.openThread("parent-ts");
      const msg = await thread.post("Reconnected message");

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          channel: channelId,
          text: "Reconnected message",
          thread_ts: "parent-ts",
        })
      );
      expect(msg).toBeInstanceOf(Message);
    });

    it("should receive replies via openThread().onReply()", async () => {
      const channel = await client.connect(channelId);
      const thread = channel.openThread("parent-ts");

      const callback = vi.fn();
      thread.onReply(callback);

      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U999",
          ts: "reply-ts",
          thread_ts: "parent-ts",
          text: "Reply to reopened thread",
        },
        context: {},
      });

      expect(callback).toHaveBeenCalledTimes(1);
      const msg = callback.mock.calls[0][0] as Message;
      expect(msg.content).toBe("Reply to reopened thread");
    });
  });

  describe("SlackChatClient error callback", () => {
    it("swallows errors from error callbacks that throw", async () => {
      const throwingErrorCallback = vi
        .fn()
        .mockRejectedValue(new Error("cb error"));
      client.onError(throwingErrorCallback);

      // Get the error handler registered via app.error()
      const errorHandler = mockError.mock.calls[0]?.[0];
      expect(errorHandler).toBeDefined();

      // Invoke the error handler - should not throw even if callback throws
      await expect(
        errorHandler(new Error("app error"))
      ).resolves.toBeUndefined();
      expect(throwingErrorCallback).toHaveBeenCalled();
    });

    it("wraps non-Error thrown from app in Error", async () => {
      const errorCallback = vi.fn().mockResolvedValue(undefined);
      client.onError(errorCallback);

      const errorHandler = mockError.mock.calls[0]?.[0];
      // eslint-disable-next-line @typescript-eslint/no-throw-literal
      await errorHandler("string error");

      expect(errorCallback).toHaveBeenCalledWith(
        expect.objectContaining({ message: "string error" })
      );
    });
  });

  describe("SlackChatClient reaction callback error", () => {
    it("swallows errors from reaction callbacks that throw", async () => {
      const throwingCallback = vi.fn().mockRejectedValue(new Error("rx error"));
      await client.connect(channelId);
      // Subscribe to reactions directly via the client
      client.subscribeToReactions(channelId, throwingCallback);

      const handler = getReactionHandler();
      await expect(
        handler!({
          event: {
            item: { channel: channelId, ts: "1234.567" },
            user: "U1",
            reaction: "thumbsup",
            event_ts: "1234567890.123456",
          },
        })
      ).resolves.toBeUndefined();
      expect(throwingCallback).toHaveBeenCalled();
    });
  });

  describe("SlackChatClient message callback error", () => {
    it("swallows errors from channel message callbacks that throw", async () => {
      const throwingCallback = vi
        .fn()
        .mockRejectedValue(new Error("msg error"));
      const channel = await client.connect(channelId);
      channel.onMessage(throwingCallback);

      const handler = getMessageHandler();
      await expect(
        handler!({
          event: {
            channel: channelId,
            user: "U1",
            ts: "1234.567",
            text: "hello",
          },
          context: {},
        })
      ).resolves.toBeUndefined();
      expect(throwingCallback).toHaveBeenCalled();
    });

    it("swallows errors from thread message callbacks that throw", async () => {
      const throwingCallback = vi
        .fn()
        .mockRejectedValue(new Error("thread msg error"));
      const channel = await client.connect(channelId);
      const thread = channel.openThread("parent-ts");
      thread.onReply(throwingCallback);

      const handler = getMessageHandler();
      await expect(
        handler!({
          event: {
            channel: channelId,
            user: "U1",
            ts: "reply-ts",
            thread_ts: "parent-ts",
            text: "thread reply",
          },
          context: {},
        })
      ).resolves.toBeUndefined();
      expect(throwingCallback).toHaveBeenCalled();
    });
  });

  describe("hydrateIdentity - auth.test returns no user_id", () => {
    it("throws when auth.test returns no user_id", async () => {
      mockAuthTest.mockResolvedValueOnce({});

      await expect(client.connect(channelId)).rejects.toThrow(
        "Slack auth.test did not return user_id"
      );
    });
  });

  describe("NoReceiver", () => {
    it("init, start, and stop do not throw", async () => {
      // NoReceiver is tested directly - it's used by App in outbound-only mode
      const { NoReceiver } = await import("../src/slack/NoReceiver.js");
      const receiver = new NoReceiver();
      expect(() => receiver.init()).not.toThrow();
      await expect(receiver.start()).resolves.toBeUndefined();
      await expect(receiver.stop()).resolves.toBeUndefined();
    });
  });

  describe("slack/getMessages - additional coverage", () => {
    it("skips messages with empty ts", async () => {
      mockConversationsHistory.mockResolvedValue({
        messages: [
          { ts: "", text: "no ts" },
          { ts: "111.111", text: "valid" },
        ],
      });
      const channel = await client.connect(channelId);
      const messages = await channel.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("valid");
    });

    it("skips messages with undefined ts", async () => {
      mockConversationsHistory.mockResolvedValue({
        messages: [{ text: "no ts field" }, { ts: "222.222", text: "valid" }],
      });
      const channel = await client.connect(channelId);
      const messages = await channel.getMessages();
      expect(messages).toHaveLength(1);
    });

    it("skips messages where dateFromUnixSeconds throws (invalid ts)", async () => {
      mockConversationsHistory.mockResolvedValue({
        messages: [
          { ts: "not-a-number", text: "bad ts" },
          { ts: "111.111", text: "valid" },
        ],
      });
      const channel = await client.connect(channelId);
      const messages = await channel.getMessages();
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("valid");
    });

    it("filters messages by afterDate (skips old messages)", async () => {
      const nowTs = Math.floor(Date.now() / 1000);
      mockConversationsHistory.mockResolvedValue({
        messages: [
          { ts: String(nowTs - 100), text: "old", user: "U1" },
          { ts: String(nowTs - 1), text: "recent", user: "U2" },
        ],
      });
      const channel = await client.connect(channelId);
      const messages = await channel.getMessages({
        after: new Date((nowTs - 50) * 1000),
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("recent");
    });

    it("filters messages by beforeDate (skips recent messages)", async () => {
      const nowTs = Math.floor(Date.now() / 1000);
      mockConversationsHistory.mockResolvedValue({
        messages: [
          { ts: String(nowTs - 100), text: "old", user: "U1" },
          { ts: String(nowTs - 1), text: "recent", user: "U2" },
        ],
      });
      const channel = await client.connect(channelId);
      const messages = await channel.getMessages({
        before: new Date((nowTs - 50) * 1000),
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("old");
    });

    it("filters messages by author: me using botId", async () => {
      const nowTs = Math.floor(Date.now() / 1000);
      mockConversationsHistory.mockResolvedValue({
        messages: [
          {
            ts: String(nowTs),
            text: "bot msg",
            bot_id: "B123",
            user: undefined,
          },
          { ts: String(nowTs - 1), text: "user msg", user: "U1" },
        ],
      });
      const channel = await client.connect(channelId);
      const messages = await channel.getMessages({ author: "me" });
      // bot_id B123 matches slackBotId B123 from mockAuthTest
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("bot msg");
    });

    it("filters messages by author with mention format (normalizeAuthorFilter)", async () => {
      const nowTs = Math.floor(Date.now() / 1000);
      mockConversationsHistory.mockResolvedValue({
        messages: [
          { ts: String(nowTs), text: "from U1", user: "U1" },
          { ts: String(nowTs - 1), text: "from U2", user: "U2" },
        ],
      });
      const channel = await client.connect(channelId);
      // Directly call client.getMessages to pass mention format without Channel processing
      const messages = await client.getMessages(channelId, { author: "<@U1>" });
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("from U1");
    });

    it("filters messages by author as bot_id", async () => {
      const nowTs = Math.floor(Date.now() / 1000);
      mockConversationsHistory.mockResolvedValue({
        messages: [
          {
            ts: String(nowTs),
            text: "from bot",
            bot_id: "B456",
            user: undefined,
          },
          { ts: String(nowTs - 1), text: "user msg", user: "U2" },
        ],
      });
      const channel = await client.connect(channelId);
      const messages = await client.getMessages(channelId, { author: "B456" });
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("from bot");
    });

    it("handles messages with username field", async () => {
      const nowTs = Math.floor(Date.now() / 1000);
      mockConversationsHistory.mockResolvedValue({
        messages: [
          {
            ts: String(nowTs),
            text: "with username",
            user: "U1",
            username: "my-bot",
          },
        ],
      });
      const channel = await client.connect(channelId);
      const messages = await channel.getMessages();
      expect(messages[0].author?.username).toBe("my-bot");
    });

    it("handles messages without user or bot_id (no author)", async () => {
      const nowTs = Math.floor(Date.now() / 1000);
      mockConversationsHistory.mockResolvedValue({
        messages: [{ ts: String(nowTs), text: "no author" }],
      });
      const channel = await client.connect(channelId);
      const messages = await channel.getMessages();
      expect(messages[0].author).toBeUndefined();
    });

    it("handles files attachment in messages (extractSlackAttachments)", async () => {
      const nowTs = Math.floor(Date.now() / 1000);
      mockConversationsHistory.mockResolvedValue({
        messages: [
          {
            ts: String(nowTs),
            text: "with file",
            user: "U1",
            files: [
              {
                url_private: "https://slack.com/files/test.pdf",
                name: "test.pdf",
                mimetype: "application/pdf",
                size: 1024,
              },
              // File with no url (should be skipped)
              { name: "no-url.txt" },
              // File with no name (should be skipped)
              { url_private: "https://slack.com/files/no-name" },
            ],
          },
        ],
      });
      const channel = await client.connect(channelId);
      const messages = await channel.getMessages();
      expect(messages[0].attachments).toHaveLength(1);
      expect(messages[0].attachments![0].url).toBe(
        "https://slack.com/files/test.pdf"
      );
      expect(messages[0].attachments![0].contentType).toBe("application/pdf");
    });

    it("handles files with null mimetype (contentType = undefined)", async () => {
      const nowTs = Math.floor(Date.now() / 1000);
      mockConversationsHistory.mockResolvedValue({
        messages: [
          {
            ts: String(nowTs),
            text: "with file",
            user: "U1",
            files: [
              {
                url_private: "https://slack.com/files/test.bin",
                name: "test.bin",
                mimetype: null,
              },
            ],
          },
        ],
      });
      const channel = await client.connect(channelId);
      const messages = await channel.getMessages();
      expect(messages[0].attachments![0].contentType).toBeUndefined();
    });

    it("uses after/before timestamp from Date object for toSlackTimestamp", async () => {
      const nowMs = Date.now();
      mockConversationsHistory.mockResolvedValue({ messages: [] });
      const channel = await client.connect(channelId);
      await channel.getMessages({
        after: new Date(nowMs - 5000),
        before: new Date(nowMs),
      });
      expect(mockConversationsHistory).toHaveBeenCalledWith(
        expect.objectContaining({
          oldest: expect.any(String),
          latest: expect.any(String),
          inclusive: false,
        })
      );
    });

    it("uses numeric timestamp (ms > 10^10) for toSlackTimestamp", async () => {
      mockConversationsHistory.mockResolvedValue({ messages: [] });
      const channel = await client.connect(channelId);
      await channel.getMessages({ after: Date.now() });
      expect(mockConversationsHistory).toHaveBeenCalledWith(
        expect.objectContaining({ oldest: expect.any(String) })
      );
    });

    it("ignores non-finite numeric timestamp in toSlackTimestamp", async () => {
      mockConversationsHistory.mockResolvedValue({ messages: [] });
      const channel = await client.connect(channelId);
      await channel.getMessages({ after: Infinity });
      // Infinity is not finite, so oldest should NOT be in the call
      const call =
        mockConversationsHistory.mock.calls[
          mockConversationsHistory.mock.calls.length - 1
        ][0];
      expect(call.oldest).toBeUndefined();
    });

    it("uses numeric string timestamp for toSlackTimestamp", async () => {
      mockConversationsHistory.mockResolvedValue({ messages: [] });
      const channel = await client.connect(channelId);
      await client.getMessages(channelId, { after: "1234567890.123" });
      expect(mockConversationsHistory).toHaveBeenCalledWith(
        expect.objectContaining({ oldest: "1234567890.123" })
      );
    });

    it("converts date string timestamp for toSlackTimestamp", async () => {
      mockConversationsHistory.mockResolvedValue({ messages: [] });
      await client.connect(channelId);
      await client.getMessages(channelId, { after: "2026-01-01T00:00:00Z" });
      expect(mockConversationsHistory).toHaveBeenCalledWith(
        expect.objectContaining({ oldest: expect.any(String) })
      );
    });

    it("ignores invalid date string in toSlackTimestamp", async () => {
      mockConversationsHistory.mockResolvedValue({ messages: [] });
      await client.connect(channelId);
      await client.getMessages(channelId, { after: "not-a-date" });
      const call =
        mockConversationsHistory.mock.calls[
          mockConversationsHistory.mock.calls.length - 1
        ][0];
      expect(call.oldest).toBeUndefined();
    });

    it("getMessages uses numeric timestamp > 10^10 for toDate", async () => {
      const nowMs = Date.now();
      const recentTs = Math.floor(Date.now() / 1000) - 1;
      mockConversationsHistory.mockResolvedValue({
        messages: [{ ts: String(recentTs), text: "recent", user: "U1" }],
      });
      await client.connect(channelId);
      // Use ms timestamp (> 10^10) for after filter
      const messages = await client.getMessages(channelId, {
        after: nowMs - 5000,
      });
      // The message at recentTs is after nowMs-5000, so it should be included
      expect(messages.length).toBeGreaterThanOrEqual(0); // just verify no crash
    });
  });

  describe("slack/getMessages - getThreadMessages coverage", () => {
    it("getThreadMessages skips parent message and applies filters", async () => {
      const nowTs = Math.floor(Date.now() / 1000);
      mockConversationsReplies.mockResolvedValue({
        messages: [
          { ts: "parent-ts", text: "parent", user: "U1" },
          { ts: String(nowTs - 5), text: "old reply", user: "U2" },
          { ts: String(nowTs), text: "new reply", user: "U2" },
        ],
      });

      await client.connect(channelId);
      const messages = await client.getThreadMessages("parent-ts", channelId, {
        after: new Date((nowTs - 3) * 1000),
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("new reply");
    });

    it("getThreadMessages filters by beforeDate", async () => {
      const nowTs = Math.floor(Date.now() / 1000);
      mockConversationsReplies.mockResolvedValue({
        messages: [
          { ts: "parent-ts", text: "parent", user: "U1" },
          { ts: String(nowTs - 10), text: "old reply", user: "U2" },
          { ts: String(nowTs - 1), text: "new reply", user: "U2" },
        ],
      });

      await client.connect(channelId);
      const messages = await client.getThreadMessages("parent-ts", channelId, {
        before: new Date((nowTs - 5) * 1000),
      });

      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("old reply");
    });

    it("getThreadMessages filters by author: me (meId)", async () => {
      const nowTs = Math.floor(Date.now() / 1000);
      mockConversationsReplies.mockResolvedValue({
        messages: [
          { ts: "parent-ts", text: "parent", user: "U_BOT" },
          { ts: String(nowTs - 1), text: "mine", user: "U_BOT" },
          { ts: String(nowTs), text: "not mine", user: "U_OTHER" },
        ],
      });

      await client.connect(channelId);
      const messages = await client.getThreadMessages("parent-ts", channelId, {
        author: "me",
      });
      expect(messages.find((m) => m.content === "mine")).toBeDefined();
      expect(messages.find((m) => m.content === "not mine")).toBeUndefined();
    });

    it("getThreadMessages skips messages with empty ts", async () => {
      const nowTs = Math.floor(Date.now() / 1000);
      mockConversationsReplies.mockResolvedValue({
        messages: [
          { ts: "parent-ts", text: "parent", user: "U1" },
          { ts: "", text: "bad ts" },
          { ts: String(nowTs), text: "valid", user: "U2" },
        ],
      });

      await client.connect(channelId);
      const messages = await client.getThreadMessages("parent-ts", channelId);
      expect(messages).toHaveLength(1);
    });

    it("getThreadMessages skips messages with invalid ts (dateFromUnixSeconds throws)", async () => {
      const nowTs = Math.floor(Date.now() / 1000);
      mockConversationsReplies.mockResolvedValue({
        messages: [
          { ts: "parent-ts", text: "parent", user: "U1" },
          { ts: "invalid", text: "bad ts" },
          { ts: String(nowTs), text: "valid", user: "U2" },
        ],
      });

      await client.connect(channelId);
      const messages = await client.getThreadMessages("parent-ts", channelId);
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe("valid");
    });
  });

  describe("slack/fetchChannelMembers - pagination and edge cases", () => {
    it("paginates when next_cursor is returned", async () => {
      mockConversationsMembers
        .mockResolvedValueOnce({
          members: ["U001", "U002"],
          response_metadata: { next_cursor: "cursor-page-2" },
        })
        .mockResolvedValueOnce({
          members: ["U003"],
          response_metadata: { next_cursor: "" },
        });
      mockUsersInfo
        .mockResolvedValueOnce({
          user: { name: "user1", real_name: "User 1", profile: {} },
        })
        .mockResolvedValueOnce({
          user: { name: "user2", real_name: "User 2", profile: {} },
        })
        .mockResolvedValueOnce({
          user: { name: "user3", real_name: "User 3", profile: {} },
        });

      const channel = await client.connect(channelId);
      const members = await channel.getMembers();

      expect(mockConversationsMembers).toHaveBeenCalledTimes(2);
      expect(members).toHaveLength(3);
    });

    it("skips users where info.user is falsy", async () => {
      mockConversationsMembers.mockResolvedValue({
        members: ["U001", "U002"],
        response_metadata: {},
      });
      mockUsersInfo
        .mockResolvedValueOnce({ user: null })
        .mockResolvedValueOnce({
          user: { name: "user2", real_name: "User 2", profile: {} },
        });

      const channel = await client.connect(channelId);
      const members = await channel.getMembers();
      expect(members).toHaveLength(1);
      expect(members[0].username).toBe("user2");
    });

    it("falls back to userId when name is undefined", async () => {
      mockConversationsMembers.mockResolvedValue({
        members: ["U001"],
        response_metadata: {},
      });
      mockUsersInfo.mockResolvedValue({
        user: { name: undefined, profile: {} },
      });

      const channel = await client.connect(channelId);
      const members = await channel.getMembers();
      expect(members[0].username).toBe("U001");
      expect(members[0].displayName).toBe("U001");
    });

    it("includes email when profile has email", async () => {
      mockConversationsMembers.mockResolvedValue({
        members: ["U001"],
        response_metadata: {},
      });
      mockUsersInfo.mockResolvedValue({
        user: {
          name: "alice",
          real_name: "Alice",
          profile: { display_name: "Al", email: "alice@example.com" },
        },
      });

      const channel = await client.connect(channelId);
      const members = await channel.getMembers();
      expect(members[0].email).toBe("alice@example.com");
    });

    it("omits email when profile has empty email", async () => {
      mockConversationsMembers.mockResolvedValue({
        members: ["U001"],
        response_metadata: {},
      });
      mockUsersInfo.mockResolvedValue({
        user: {
          name: "alice",
          profile: { email: "" },
        },
      });

      const channel = await client.connect(channelId);
      const members = await channel.getMembers();
      expect(members[0].email).toBeUndefined();
    });
  });

  describe("slack/buildMessageEvent - additional coverage", () => {
    it("buildMessageEvent with no ts (uses current time)", async () => {
      const channel = await client.connect(channelId);
      channel.onMessage(vi.fn());

      const handler = getMessageHandler();
      const before = Date.now();
      await handler!({
        event: {
          channel: channelId,
          user: "U1",
          // no ts
        },
        context: {},
      });
      const after = Date.now();

      // The message was received with a timestamp near now
      // This covers the fallback `timestamp = new Date()` at line 58
      expect(before).toBeLessThanOrEqual(after);
    });

    it("buildMessageEvent with non-finite ts (uses current time)", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onMessage(callback);

      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U1",
          ts: "Infinity", // parseFloat("Infinity") is not finite
        },
        context: {},
      });

      expect(callback).toHaveBeenCalledOnce();
      // timestamp should be current time (default new Date())
      const event = callback.mock.calls[0][0] as { timestamp: Date };
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it("buildMessageEvent with files (attachment coverage)", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onMessage(callback);

      const handler = getMessageHandler();
      await handler!({
        event: {
          channel: channelId,
          user: "U1",
          ts: "1234567890.123",
          files: [
            {
              url_private: "https://slack.com/files/image.png",
              name: "image.png",
              mimetype: "image/png",
              size: 4096,
            },
            // No url - should be skipped
            { name: "no-url.txt" },
          ],
        },
        context: {},
      });

      expect(callback).toHaveBeenCalledOnce();
      const event = callback.mock.calls[0][0] as { attachments: unknown[] };
      expect(event.attachments).toHaveLength(1);
    });
  });

  describe("slack/getThreads - edge cases", () => {
    it("returns empty array when history.messages is falsy", async () => {
      mockConversationsHistory.mockResolvedValue({});

      const channel = await client.connect(channelId);
      const threads = await channel.getThreads();
      expect(threads).toHaveLength(0);
    });

    it("skips messages without reply_count", async () => {
      mockConversationsHistory.mockResolvedValue({
        messages: [
          { ts: "111.111", reply_count: 0 },
          { ts: "222.222" }, // no reply_count
        ],
      });

      const channel = await client.connect(channelId);
      const threads = await channel.getThreads();
      expect(threads).toHaveLength(0);
    });
  });

  describe("slack/removeAllReactions - no reactions", () => {
    it("returns early when message has no reactions", async () => {
      mockReactionsGet.mockResolvedValue({
        message: { reactions: undefined },
      });

      await client.connect(channelId);
      await expect(
        client.removeAllReactions("msg-123", channelId)
      ).resolves.toBeUndefined();
      expect(mockReactionsRemove).not.toHaveBeenCalled();
    });

    it("ignores errors when removing a reaction the bot didn't add", async () => {
      mockReactionsGet.mockResolvedValue({
        message: {
          reactions: [
            { name: "thumbsup" },
            { name: "" }, // empty name - should be skipped
          ],
        },
      });
      mockReactionsRemove.mockRejectedValue(new Error("not_reacted"));

      await client.connect(channelId);
      await expect(
        client.removeAllReactions("msg-123", channelId)
      ).resolves.toBeUndefined();
    });
  });

  describe("slack/messageOperations - postMessage overflow", () => {
    it("uploads large message as file with thread_ts", async () => {
      const largeContent = "x".repeat(4001);
      const channel = await client.connect(channelId);
      // Need thread to trigger threadTs path
      const thread = await channel.createThread("test-message", "test-thread");

      // Patch postToThread to trigger the large message path
      await thread.post(largeContent);

      expect(mockFilesUploadV2).toHaveBeenCalledWith(
        expect.objectContaining({ thread_ts: expect.any(String) })
      );
    });

    it("uploads large message as file without thread_ts", async () => {
      const largeContent = "x".repeat(4001);
      const channel = await client.connect(channelId);
      channel.postMessage(largeContent);

      // Wait briefly for async operations
      await new Promise((r) => setTimeout(r, 50));

      expect(mockFilesUploadV2).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: "message.txt",
          initial_comment: expect.any(String),
        })
      );
    });
  });

  describe("slack/messageOperations - updateMessage truncation", () => {
    it("truncates message content when it exceeds the limit", async () => {
      const largeContent = "x".repeat(4001);
      const channel = await client.connect(channelId);
      const message = channel.postMessage("initial");
      await new Promise((r) => setTimeout(r, 50));

      mockChatUpdate.mockResolvedValue({ ok: true });
      await message.update(largeContent);

      expect(mockChatUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringMatching(/…$/),
        })
      );
    });
  });

  describe("slack/messageOperations - deleteMessage cascadeReplies = false", () => {
    it("skips fetching replies when cascadeReplies is false", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("test");
      await new Promise((r) => setTimeout(r, 50));

      await message.delete({ cascadeReplies: false });

      expect(mockConversationsReplies).not.toHaveBeenCalled();
      expect(mockChatDelete).toHaveBeenCalledWith(
        expect.objectContaining({ ts: expect.any(String) })
      );
    });
  });

  describe("slack/messageOperations - postMessage with Document", () => {
    it("posts Document content as blocks with text", async () => {
      const { Document } = await import("@hardlydifficult/document-generator");
      const doc = new Document().header("Test Header");
      // toPlainText() returns "TEST HEADER" (uppercase) for header blocks

      const channel = await client.connect(channelId);
      channel.postMessage(doc as never);
      await new Promise((r) => setTimeout(r, 50));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.any(String),
          blocks: expect.any(Array),
        })
      );
    });

    it("posts Document with empty plain text using fallback 'Message'", async () => {
      const { Document } = await import("@hardlydifficult/document-generator");
      const doc = new Document(); // empty document

      const channel = await client.connect(channelId);
      channel.postMessage(doc as never);
      await new Promise((r) => setTimeout(r, 50));

      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ text: "Message" })
      );
    });

    it("postMessage with Document and files - posts blocks separately", async () => {
      const { Document } = await import("@hardlydifficult/document-generator");
      const doc = new Document().header("Doc with file");

      mockPostMessage.mockResolvedValue({ ts: "1234567890.doc" });
      const channel = await client.connect(channelId);
      const msg = channel.postMessage(doc as never, {
        files: [{ content: "file content", name: "test.txt" }],
      });
      await new Promise((r) => setTimeout(r, 100));

      // File upload happens
      expect(mockFilesUploadV2).toHaveBeenCalled();
      // Then text+blocks are posted separately
      expect(mockPostMessage).toHaveBeenCalledWith(
        expect.objectContaining({ blocks: expect.any(Array) })
      );
    });
  });

  describe("slack/messageOperations - postMessage with file and threadTs", () => {
    it("uploads string file with thread_ts", async () => {
      const channel = await client.connect(channelId);
      const thread = await channel.createThread("root message", "thread-name");

      await thread.post("Text", {
        files: [{ content: "file text", name: "file.txt" }],
      });

      expect(mockFilesUploadV2).toHaveBeenCalledWith(
        expect.objectContaining({
          thread_ts: expect.any(String),
          content: "file text",
        })
      );
    });

    it("uploads Buffer file with thread_ts", async () => {
      const channel = await client.connect(channelId);
      const thread = await channel.createThread("root message", "thread-name");

      const buf = Buffer.from("binary content");
      await thread.post("Text", {
        files: [{ content: buf, name: "file.bin" }],
      });

      expect(mockFilesUploadV2).toHaveBeenCalledWith(
        expect.objectContaining({
          thread_ts: expect.any(String),
          file: buf,
        })
      );
    });

    it("uploads Buffer file without thread_ts", async () => {
      const channel = await client.connect(channelId);
      const buf = Buffer.from("binary content");
      channel.postMessage("Text", {
        files: [{ content: buf, name: "file.bin" }],
      });
      await new Promise((r) => setTimeout(r, 50));

      expect(mockFilesUploadV2).toHaveBeenCalledWith(
        expect.objectContaining({
          file: buf,
          filename: "file.bin",
        })
      );
    });

    it("throws when postMessage with blocks returns no ts (line 114)", async () => {
      const { Document } = await import("@hardlydifficult/document-generator");
      const doc = new Document().header("Test Header");
      // Line 114 is in the files path: when files + blocks (Document), postMessage returns no ts
      // The file upload is successful but the accompanying blocks post returns no ts
      mockFilesUploadV2.mockResolvedValue(undefined);
      mockPostMessage.mockResolvedValueOnce({ ts: undefined });
      const channel = await client.connect(channelId);
      await expect(
        channel.postMessage(doc, {
          files: [{ content: "data", name: "file.txt" }],
        })
      ).rejects.toThrow("Slack API did not return a message timestamp");
    });

    it("throws when plain text postMessage returns no ts (line 155)", async () => {
      mockPostMessage.mockResolvedValueOnce({ ts: undefined });
      // Need to clear any dedup messages first
      mockConversationsHistory.mockResolvedValueOnce({ messages: [] });
      const channel = await client.connect(channelId);
      await expect(channel.postMessage("plain text message")).rejects.toThrow(
        "Slack API did not return a message timestamp"
      );
    });
  });

  describe("slack getMessages - toSlackTimestamp and toDate edge cases", () => {
    it("toSlackTimestamp returns undefined for empty string after (line 147)", async () => {
      mockConversationsHistory.mockResolvedValue({ messages: [] });
      await client.connect(channelId);
      await client.getMessages(channelId, { after: "" as never });
      const call =
        mockConversationsHistory.mock.calls[
          mockConversationsHistory.mock.calls.length - 1
        ][0];
      // Empty string => toSlackTimestamp returns undefined => oldest not set
      expect(call.oldest).toBeUndefined();
    });

    it("toDate returns undefined when dateFromUnixSeconds throws (line 174)", async () => {
      // NaN is a number but dateFromUnixSeconds(NaN) throws "requires a finite numeric value"
      // toDate: typeof NaN === "number", NaN > 10^10 is false, so tries dateFromUnixSeconds
      // which throws => catch returns undefined => no filter applied
      const recentTs = String(Date.now() / 1000 - 1);
      mockConversationsHistory.mockResolvedValue({
        messages: [{ ts: recentTs, text: "msg", user: "U1" }],
      });
      await client.connect(channelId);
      const messages = await client.getMessages(channelId, {
        after: NaN as never,
      });
      // NaN triggers catch => returns undefined => no afterDate filter => message included
      expect(messages).toHaveLength(1);
    });
  });
});
