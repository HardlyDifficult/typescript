import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DiscordConfig, ReactionEvent } from "../src/types.js";

// Use vi.hoisted to define mocks that are used in vi.mock()
const {
  mockDiscordMessage,
  mockTextChannelData,
  mockClient,
  MockTextChannel,
  MockThreadChannel,
  MockAttachmentBuilder,
  mockReactionUsersRemove,
  mockReactionResolve,
  mockReactionsRemoveAll,
  mockGuildMembersList,
  mockPermissionsFor,
  mockThreadChannelDelete,
  mockThreadSend,
  getReactionHandler,
  setReactionHandler,
  getMessageHandler,
  setMessageHandler,
  getShardHandler,
  clearShardHandlers,
} = vi.hoisted(() => {
  let reactionHandler: ((reaction: unknown, user: unknown) => void) | null =
    null;
  let messageHandler: ((message: unknown) => void) | null = null;
  const shardHandlers: Record<string, ((...args: unknown[]) => void)[]> = {};

  const mockThread = {
    id: "thread-001",
    name: "Test Thread",
  };

  const mockReactionUsersRemove = vi.fn().mockResolvedValue(undefined);
  const mockReactionResolve = vi.fn().mockReturnValue({
    users: { remove: mockReactionUsersRemove },
  });
  const mockReactionsRemoveAll = vi.fn().mockResolvedValue(undefined);

  const mockDiscordMessage = {
    id: "msg-123",
    channelId: "channel-456",
    react: vi.fn(),
    edit: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    thread: null as { delete: ReturnType<typeof vi.fn> } | null,
    startThread: vi.fn().mockResolvedValue(mockThread),
    reactions: {
      resolve: mockReactionResolve,
      removeAll: mockReactionsRemoveAll,
    },
  };

  const mockTextChannelData = {
    id: "channel-456",
    send: vi.fn(),
    sendTyping: vi.fn().mockResolvedValue(undefined),
    bulkDelete: vi.fn().mockResolvedValue(
      new Map([
        ["msg-1", {}],
        ["msg-2", {}],
      ])
    ),
    messages: {
      fetch: vi.fn(),
    },
    threads: {
      fetchActive: vi.fn().mockResolvedValue({
        threads: new Map([["thread-1", { id: "thread-1" }]]),
      }),
      fetchArchived: vi.fn().mockResolvedValue({
        threads: new Map([["thread-2", { id: "thread-2" }]]),
      }),
    },
  };

  const mockGuildMembersList = vi.fn();
  const mockPermissionsFor = vi.fn();

  // Mock TextChannel class for instanceof checks
  class MockTextChannel {
    id = "channel-456";
    send = mockTextChannelData.send;
    sendTyping = mockTextChannelData.sendTyping;
    bulkDelete = mockTextChannelData.bulkDelete;
    messages = mockTextChannelData.messages;
    threads = mockTextChannelData.threads;
    guild = { members: { list: mockGuildMembersList } };
    permissionsFor = mockPermissionsFor;
  }

  const mockThreadChannelDelete = vi.fn().mockResolvedValue(undefined);
  const mockThreadSend = vi.fn();

  class MockThreadChannel {
    id: string;
    send = mockThreadSend;
    sendTyping = vi.fn().mockResolvedValue(undefined);
    messages = { fetch: vi.fn() };
    delete = mockThreadChannelDelete;
    constructor(id = "thread-1") {
      this.id = id;
    }
  }

  class MockAttachmentBuilder {
    attachment: unknown;
    name: string;
    constructor(content: unknown, options?: { name?: string }) {
      this.attachment = content;
      this.name = options?.name ?? "";
    }
  }

  const mockClient = {
    login: vi.fn(),
    channels: {
      fetch: vi.fn(),
    },
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (event === "messageReactionAdd") {
        reactionHandler = handler as typeof reactionHandler;
      } else if (event === "messageCreate") {
        messageHandler = handler as typeof messageHandler;
      } else {
        if (!shardHandlers[event]) {
          shardHandlers[event] = [];
        }
        shardHandlers[event].push(handler);
      }
    }),
    destroy: vi.fn(),
    user: { id: "bot-user-id", username: "test-bot", globalName: "Test Bot" },
  };

  return {
    mockDiscordMessage,
    mockTextChannelData,
    mockClient,
    MockTextChannel,
    MockThreadChannel,
    MockAttachmentBuilder,
    mockReactionUsersRemove,
    mockReactionResolve,
    mockReactionsRemoveAll,
    mockGuildMembersList,
    mockPermissionsFor,
    mockThreadChannelDelete,
    mockThreadSend,
    getReactionHandler: () => reactionHandler,
    setReactionHandler: (handler: typeof reactionHandler) => {
      reactionHandler = handler;
    },
    getMessageHandler: () => messageHandler,
    setMessageHandler: (handler: typeof messageHandler) => {
      messageHandler = handler;
    },
    getShardHandler: (event: string) => shardHandlers[event] ?? [],
    clearShardHandlers: () => {
      for (const key of Object.keys(shardHandlers)) {
        delete shardHandlers[key];
      }
    },
  };
});

// Mock discord.js
vi.mock("discord.js", () => ({
  Client: vi.fn(function (this: any) {
    return mockClient;
  }),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMembers: 5,
    GuildMessages: 2,
    GuildMessageReactions: 3,
    MessageContent: 4,
  },
  MessageFlags: {
    SuppressEmbeds: 4,
  },
  TextChannel: MockTextChannel,
  ThreadChannel: MockThreadChannel,
  AttachmentBuilder: MockAttachmentBuilder,
}));

// Import after mocking
import { DiscordChatClient } from "../src/discord/DiscordChatClient.js";
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
    // Flush microtasks multiple times to let any .then() callbacks scheduled on postPromise run
    // This allows super.addReactions() calls to update pendingReactions
    await Promise.resolve();
    await Promise.resolve();
  }

  // Now pendingReactions should have all chained reactions
  const pendingReactions = (message as any).pendingReactions;
  if (pendingReactions) {
    await pendingReactions;
  }

  // Final flush to ensure any cleanup callbacks have run
  await Promise.resolve();
}

/**
 * Simple polling helper to wait for a condition (Vitest equivalent of waitFor).
 * Polls every 10ms until the condition passes or timeout (default 1000ms).
 */
async function waitFor(
  condition: () => void,
  timeout: number = 1000,
  interval: number = 10
): Promise<void> {
  const startTime = Date.now();
  let lastError: unknown;
  while (Date.now() - startTime < timeout) {
    try {
      condition();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
  // Timeout reached - throw the last error
  throw lastError;
}

describe("DiscordChatClient", () => {
  let client: DiscordChatClient;
  const config: DiscordConfig = {
    type: "discord",
    token: "test-bot-token",
    guildId: "guild-789",
  };
  const channelId = "channel-456";

  beforeEach(() => {
    vi.clearAllMocks();
    setReactionHandler(null);
    setMessageHandler(null);
    clearShardHandlers();

    // Clear environment variables
    delete process.env.DISCORD_TOKEN;
    delete process.env.DISCORD_GUILD_ID;

    // Reset mock implementations
    mockClient.login.mockResolvedValue("token");
    mockClient.channels.fetch.mockResolvedValue(
      Object.assign(new MockTextChannel(), mockTextChannelData)
    );
    mockTextChannelData.send.mockResolvedValue(mockDiscordMessage);
    mockTextChannelData.messages.fetch.mockResolvedValue(mockDiscordMessage);
    mockDiscordMessage.react.mockResolvedValue(undefined);
    mockDiscordMessage.delete.mockResolvedValue(undefined);
    mockDiscordMessage.thread = null;
    mockReactionUsersRemove.mockResolvedValue(undefined);
    mockReactionResolve.mockReturnValue({
      users: { remove: mockReactionUsersRemove },
    });
    mockReactionsRemoveAll.mockResolvedValue(undefined);
    mockDiscordMessage.startThread.mockResolvedValue({
      id: "thread-001",
      name: "Test Thread",
    });
    mockTextChannelData.sendTyping.mockResolvedValue(undefined);
    mockTextChannelData.bulkDelete.mockResolvedValue(
      new Map([
        ["msg-1", {}],
        ["msg-2", {}],
      ])
    );
    mockTextChannelData.threads.fetchActive.mockResolvedValue({
      threads: new Map([["thread-1", { id: "thread-1" }]]),
    });
    mockTextChannelData.threads.fetchArchived.mockResolvedValue({
      threads: new Map([["thread-2", { id: "thread-2" }]]),
    });
    mockClient.destroy.mockResolvedValue(undefined);
    mockGuildMembersList.mockResolvedValue(new Map());
    mockPermissionsFor.mockReturnValue({ has: () => true });
    mockThreadChannelDelete.mockResolvedValue(undefined);
    mockThreadSend.mockResolvedValue({ id: "thread-msg-1" });

    client = new DiscordChatClient(config);
  });

  afterEach(async () => {
    // Small delay to allow any pending async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 20));
    // Clean up - try to disconnect (ignore errors if not connected)
    try {
      await client.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    // Clean up environment variables
    delete process.env.DISCORD_TOKEN;
    delete process.env.DISCORD_GUILD_ID;
  });

  describe("config", () => {
    it("should use explicit config values", async () => {
      const explicitConfig: DiscordConfig = {
        type: "discord",
        token: "explicit-token",
        guildId: "explicit-guild",
      };

      const explicitClient = new DiscordChatClient(explicitConfig);
      await explicitClient.connect(channelId);

      expect(mockClient.login).toHaveBeenCalledWith("explicit-token");
    });

    it("should use environment variables as defaults", async () => {
      process.env.DISCORD_TOKEN = "env-token";
      process.env.DISCORD_GUILD_ID = "env-guild";

      const envConfig: DiscordConfig = {
        type: "discord",
        token: process.env.DISCORD_TOKEN,
        guildId: process.env.DISCORD_GUILD_ID,
      };

      const envClient = new DiscordChatClient(envConfig);
      await envClient.connect(channelId);

      expect(mockClient.login).toHaveBeenCalledWith("env-token");
    });

    it("should allow explicit config to override environment variables", async () => {
      process.env.DISCORD_TOKEN = "env-token";
      process.env.DISCORD_GUILD_ID = "env-guild";

      const overrideConfig: DiscordConfig = {
        type: "discord",
        token: "override-token",
        guildId: "override-guild",
      };

      const overrideClient = new DiscordChatClient(overrideConfig);
      await overrideClient.connect(channelId);

      expect(mockClient.login).toHaveBeenCalledWith("override-token");
    });
  });

  describe("connect()", () => {
    it("should login with the provided token", async () => {
      await client.connect(channelId);

      expect(mockClient.login).toHaveBeenCalledWith("test-bot-token");
      expect(mockClient.login).toHaveBeenCalledTimes(1);
    });

    it("should fetch the specified channel", async () => {
      await client.connect(channelId);

      expect(mockClient.channels.fetch).toHaveBeenCalledWith(channelId);
      expect(mockClient.channels.fetch).toHaveBeenCalledTimes(1);
    });

    it("should return a Channel object", async () => {
      const channel = await client.connect(channelId);

      expect(channel).toBeInstanceOf(Channel);
      expect(channel.id).toBe(channelId);
      expect(channel.platform).toBe("discord");
    });

    it("should expose bot identity as client.me", async () => {
      await client.connect(channelId);

      expect(client.me).toEqual({
        id: "bot-user-id",
        username: "test-bot",
        displayName: "Test Bot",
        mention: "<@bot-user-id>",
      });
    });

    it("should throw error when login fails", async () => {
      mockClient.login.mockRejectedValue(new Error("Invalid token"));

      await expect(client.connect(channelId)).rejects.toThrow("Invalid token");
    });

    it("should throw error when channel is not found", async () => {
      mockClient.channels.fetch.mockResolvedValue(null);

      await expect(client.connect("invalid-channel")).rejects.toThrow(
        "Channel invalid-channel not found or is not a text channel"
      );
    });

    it("should throw error when channel is not a TextChannel", async () => {
      mockClient.channels.fetch.mockResolvedValue({ type: "GUILD_VOICE" });

      await expect(client.connect("voice-channel")).rejects.toThrow(
        "Channel voice-channel not found or is not a text channel"
      );
    });
  });

  describe("Channel.postMessage()", () => {
    it("should call channel.send() with the message content", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Hello, world!");
      await waitForMessage(message);

      expect(mockTextChannelData.send).toHaveBeenCalledWith({
        content: "Hello, world!",
        flags: 4,
      });
    });

    it("should return a Message object", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);

      expect(message).toBeInstanceOf(Message);
    });

    it("should return a Message with the correct id", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);

      expect(message.id).toBe("msg-123");
    });

    it("should return a Message with the correct channelId", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);

      expect(message.channelId).toBe(channelId);
    });

    it('should return a Message with platform set to "discord"', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);

      expect(message.platform).toBe("discord");
    });

    it("should suppress link previews by default", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Check https://example.com");
      await waitForMessage(message);

      const sendArgs = mockTextChannelData.send.mock.calls[0][0];
      expect(sendArgs.flags).toBe(4);
    });

    it("should not suppress link previews when linkPreviews is true", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Check https://example.com", {
        linkPreviews: true,
      });
      await waitForMessage(message);

      const sendArgs = mockTextChannelData.send.mock.calls[0][0];
      expect(sendArgs.flags).toBeUndefined();
    });
  });

  describe("Message.addReactions()", () => {
    beforeEach(() => {
      // Ensure destroy is still mocked after any vi.clearAllMocks() calls
      mockClient.destroy.mockResolvedValue(undefined);
    });

    it("should call message.react() on the Discord message", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);

      message.addReactions(["thumbsup"]);
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledWith("thumbsup");
    });

    it("should support unicode emoji reactions", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);

      message.addReactions(["\u{1F44D}"]);
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledWith("\u{1F44D}");
    });

    it("should add multiple reactions from an array", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);

      message.addReactions(["1\uFE0F\u20E3", "2\uFE0F\u20E3", "3\uFE0F\u20E3"]);
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(3);
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(
        1,
        "1\uFE0F\u20E3"
      );
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(
        2,
        "2\uFE0F\u20E3"
      );
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(
        3,
        "3\uFE0F\u20E3"
      );
    });

    it("should return the Message instance for chaining", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);
      const returnedMessage = message.addReactions(["emoji1", "emoji2"]);

      expect(returnedMessage).toBe(message);
    });

    it("should support chaining multiple addReactions() calls", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);
      message
        .addReactions(["first"])
        .addReactions(["second", "third"])
        .addReactions(["fourth"]);
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(4);
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(1, "first");
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(2, "second");
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(3, "third");
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(4, "fourth");
    });

    it("should handle empty array gracefully", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);
      message.addReactions([]);
      await waitForMessage(message);

      expect(mockDiscordMessage.react).not.toHaveBeenCalled();
    });

    it("should add reactions sequentially (not in parallel)", async () => {
      const callOrder: string[] = [];

      mockDiscordMessage.react.mockImplementation(async (emoji: string) => {
        callOrder.push(`start-${emoji}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        callOrder.push(`end-${emoji}`);
      });

      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);
      message.addReactions(["1", "2"]);
      await waitForMessage(message);

      expect(callOrder).toEqual(["start-1", "end-1", "start-2", "end-2"]);

      // Reset the mock to prevent interference with other tests
      mockDiscordMessage.react.mockResolvedValue(undefined);
    });
  });

  describe("Message.removeReactions()", () => {
    it("should resolve the reaction and call users.remove()", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);

      message.removeReactions(["thumbsup"]);
      await waitForMessage(message);

      expect(mockReactionResolve).toHaveBeenCalledWith("thumbsup");
      expect(mockReactionUsersRemove).toHaveBeenCalledTimes(1);
    });

    it("should remove multiple reactions sequentially", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);

      message.removeReactions(["thumbsup", "heart"]);
      await waitForMessage(message);

      expect(mockReactionResolve).toHaveBeenCalledTimes(2);
      expect(mockReactionResolve).toHaveBeenNthCalledWith(1, "thumbsup");
      expect(mockReactionResolve).toHaveBeenNthCalledWith(2, "heart");
      expect(mockReactionUsersRemove).toHaveBeenCalledTimes(2);
    });

    it("should not throw when reaction does not exist on message", async () => {
      mockReactionResolve.mockReturnValue(null);

      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);

      message.removeReactions(["nonexistent"]);
      await waitForMessage(message);

      expect(mockReactionResolve).toHaveBeenCalledWith("nonexistent");
      expect(mockReactionUsersRemove).not.toHaveBeenCalled();
    });

    it("should return the Message instance for chaining", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);
      const returnedMessage = message.removeReactions(["thumbsup"]);

      expect(returnedMessage).toBe(message);
    });

    it("should chain with addReactions", async () => {
      const channel = await client.connect(channelId);
      const message = channel
        .postMessage("Test message")
        .addReactions(["thumbsup"])
        .removeReactions(["thumbsup"]);
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledWith("thumbsup");
      expect(mockReactionResolve).toHaveBeenCalledWith("thumbsup");
      expect(mockReactionUsersRemove).toHaveBeenCalledTimes(1);
    });
  });

  describe("Message.removeAllReactions()", () => {
    it("should call message.reactions.removeAll()", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);

      message.removeAllReactions();
      await waitForMessage(message);

      expect(mockReactionsRemoveAll).toHaveBeenCalledTimes(1);
    });

    it("should return the Message instance for chaining", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Test message");
      await waitForMessage(message);

      const returnedMessage = message.removeAllReactions();

      expect(returnedMessage).toBe(message);
    });

    it("should chain with addReactions", async () => {
      const channel = await client.connect(channelId);
      const message = channel
        .postMessage("Test message")
        .addReactions(["thumbsup", "heart"])
        .removeAllReactions();
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(2);
      expect(mockReactionsRemoveAll).toHaveBeenCalledTimes(1);
    });

    it("should allow adding new reactions after removing all", async () => {
      const channel = await client.connect(channelId);
      const message = channel
        .postMessage("Test message")
        .addReactions(["thumbsup"])
        .removeAllReactions()
        .addReactions(["heart"]);
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(2);
      expect(mockReactionsRemoveAll).toHaveBeenCalledTimes(1);
    });
  });

  describe("removeAllReactions() (direct client method)", () => {
    it("should fetch the message and call reactions.removeAll()", async () => {
      await client.connect(channelId);

      await client.removeAllReactions("msg-123", channelId);

      expect(mockTextChannelData.messages.fetch).toHaveBeenCalledWith(
        "msg-123"
      );
      expect(mockReactionsRemoveAll).toHaveBeenCalledTimes(1);
    });

    it("should throw if channel is not found", async () => {
      await client.connect(channelId);
      mockClient.channels.fetch.mockResolvedValue(null);

      await expect(
        client.removeAllReactions("msg-123", channelId)
      ).rejects.toThrow(
        "Channel channel-456 not found or is not a text channel"
      );
    });

    it("should silently ignore Unknown Message errors", async () => {
      await client.connect(channelId);
      const error = Object.assign(new Error("Unknown Message"), {
        code: 10008,
      });
      mockTextChannelData.messages.fetch.mockRejectedValueOnce(error);

      await expect(
        client.removeAllReactions("msg-123", channelId)
      ).resolves.toBeUndefined();
    });
  });

  describe("Message.onReaction()", () => {
    it("should call callback when reaction is added to message", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage("Test message").onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: "thumbsup", id: null },
      };
      const mockUser = { id: "user-001", username: "TestUser" };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should provide correct ReactionEvent data", async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: "heart", id: null },
      };
      const mockUser = { id: "user-001", username: "TestUser" };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent!.emoji).toBe("heart");
      expect(receivedEvent!.messageId).toBe("msg-123");
      expect(receivedEvent!.channelId).toBe(channelId);
      expect(receivedEvent!.user).toEqual({
        id: "user-001",
        username: "TestUser",
      });
    });

    it("should handle user without username", async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: "wave", id: null },
      };
      const mockUser = { id: "user-123", username: null };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(receivedEvent!.user.id).toBe("user-123");
      expect(receivedEvent!.user.username).toBeUndefined();
    });

    it("should not call callback for reactions on different messages", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: "different-msg-999", channelId: channelId },
        emoji: { name: "thumbsup", id: null },
      };
      const mockUser = { id: "user-001", username: "TestUser" };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should support multiple callbacks on the same message", async () => {
      const channel = await client.connect(channelId);
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const message = channel
        .postMessage("Test")
        .onReaction(callback1)
        .onReaction(callback2);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: "fire", id: null },
      };
      const mockUser = { id: "user-001", username: "TestUser" };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should be chainable with addReactions", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel
        .postMessage("Vote!")
        .addReactions(["1️⃣", "2️⃣"])
        .onReaction(callback);
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(2);

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: "1️⃣", id: null },
      };
      const mockUser = { id: "user-voter", username: "Voter" };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle partial reactions by fetching them", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const fetchMock = vi.fn().mockResolvedValue(undefined);
      const mockReaction = {
        partial: true,
        fetch: fetchMock,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: "thumbsup", id: null },
      };
      const mockUser = { id: "user-001", username: "TestUser" };

      const handler = getReactionHandler();
      handler!(mockReaction, mockUser);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
        expect(callback).toHaveBeenCalledTimes(1);
      });
    });

    it("should handle errors when fetching partial reactions", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const fetchMock = vi.fn().mockRejectedValue(new Error("Failed to fetch"));
      const mockReaction = {
        partial: true,
        fetch: fetchMock,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: "thumbsup", id: null },
      };
      const mockUser = { id: "user-001", username: "TestUser" };

      const handler = getReactionHandler();
      handler!(mockReaction, mockUser);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to fetch partial reaction:",
          expect.any(Error)
        );
      });
      expect(callback).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("should use emoji id when name is not available (custom emoji)", async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: null, id: "custom-emoji-12345" },
      };
      const mockUser = { id: "user-001", username: "TestUser" };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(receivedEvent!.emoji).toBe("custom-emoji-12345");
    });

    it("should provide a timestamp for the reaction event", async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const beforeTime = new Date();
      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: "clock", id: null },
      };
      const mockUser = { id: "user-001", username: "TestUser" };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      const afterTime = new Date();

      expect(receivedEvent!.timestamp).toBeInstanceOf(Date);
      expect(receivedEvent!.timestamp.getTime()).toBeGreaterThanOrEqual(
        beforeTime.getTime()
      );
      expect(receivedEvent!.timestamp.getTime()).toBeLessThanOrEqual(
        afterTime.getTime()
      );
    });

    it("should handle async callback errors gracefully", async () => {
      const channel = await client.connect(channelId);
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const errorCallback = vi
        .fn()
        .mockRejectedValue(new Error("Callback error"));
      const normalCallback = vi.fn();

      const message = channel
        .postMessage("Test")
        .onReaction(errorCallback)
        .onReaction(normalCallback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: "boom", id: null },
      };
      const mockUser = { id: "user-001", username: "TestUser" };

      const handler = getReactionHandler();
      handler!(mockReaction, mockUser);

      await waitFor(() => {
        expect(errorCallback).toHaveBeenCalledTimes(1);
        expect(normalCallback).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
      consoleErrorSpy.mockRestore();
    });

    it("should stop listening when offReaction is called", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: "thumbsup", id: null },
      };
      const mockUser = { id: "user-001", username: "TestUser" };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);
      expect(callback).toHaveBeenCalledTimes(1);

      message.offReaction();

      await handler!(mockReaction, mockUser);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("disconnect()", () => {
    it("should destroy the Discord client", async () => {
      await client.connect(channelId);
      await client.disconnect();

      expect(mockClient.destroy).toHaveBeenCalled();
    });

    it("should clear reaction listeners", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      channel.disconnect();

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: "ghost", id: null },
      };

      const mockUser = { id: "user-001", username: "TestUser" };

      const handler = getReactionHandler();
      if (handler) {
        await handler(mockReaction, mockUser);
      }

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("Message awaiting behavior", () => {
    it("should be directly awaitable via PromiseLike", async () => {
      const channel = await client.connect(channelId);
      const message = await channel.postMessage("Test message");

      expect(message).toBeInstanceOf(Message);
      expect(message.id).toBe("msg-123");
      expect(message.channelId).toBe(channelId);
      expect(message.platform).toBe("discord");
    });

    it("should resolve chained reactions when awaited", async () => {
      const channel = await client.connect(channelId);
      const message = await channel
        .postMessage("Test message")
        .addReactions(["emoji1", "emoji2"]);

      expect(message.id).toBe("msg-123");
      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(2);
    });

    it("should wait for all reactions to complete when awaited", async () => {
      const callOrder: string[] = [];

      mockDiscordMessage.react.mockImplementation(async () => {
        callOrder.push("react");
        await new Promise((resolve) => setTimeout(resolve, 5));
      });

      const channel = await client.connect(channelId);
      await channel
        .postMessage("Test message")
        .addReactions(["emoji1", "emoji2"]);

      callOrder.push("done");

      expect(callOrder).toEqual(["react", "react", "done"]);

      // Reset the mock to prevent interference with other tests
      mockDiscordMessage.react.mockResolvedValue(undefined);
    });

    it("should allow chaining directly on postMessage return", async () => {
      const channel = await client.connect(channelId);

      // This should work - chain reactions on postMessage return
      const message = channel
        .postMessage("Test")
        .addReactions(["thumbsup", "heart"]);
      await waitForMessage(message);

      expect(message.id).toBe("msg-123");
      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(2);
    });

    it("should resolve reactions and onReaction when awaited", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      await channel
        .postMessage("Vote!")
        .addReactions(["1️⃣", "2️⃣"])
        .onReaction(callback);

      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(2);

      // Verify the reaction listener was subscribed
      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: "1️⃣", id: null },
      };
      const handler = getReactionHandler();
      await handler!(mockReaction, { id: "user-1", username: "Test" });

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("addReaction() (direct client method)", () => {
    it("should fetch the message and call react()", async () => {
      await client.connect(channelId);

      await client.addReaction("msg-123", channelId, "thumbsup");

      expect(mockTextChannelData.messages.fetch).toHaveBeenCalledWith(
        "msg-123"
      );
      expect(mockDiscordMessage.react).toHaveBeenCalledWith("thumbsup");
    });

    it("should throw if channel is not found", async () => {
      await client.connect(channelId);
      mockClient.channels.fetch.mockResolvedValue(null);

      await expect(
        client.addReaction("msg-123", channelId, "thumbsup")
      ).rejects.toThrow(
        "Channel channel-456 not found or is not a text channel"
      );
    });

    it("should silently ignore Unknown Message errors", async () => {
      await client.connect(channelId);
      const error = Object.assign(new Error("Unknown Message"), {
        code: 10008,
      });
      mockTextChannelData.messages.fetch.mockRejectedValueOnce(error);

      await expect(
        client.addReaction("msg-123", channelId, "thumbsup")
      ).resolves.toBeUndefined();
    });
  });

  describe("removeReaction() (direct client method)", () => {
    it("should fetch the message and call reactions.resolve().users.remove()", async () => {
      await client.connect(channelId);

      await client.removeReaction("msg-123", channelId, "thumbsup");

      expect(mockTextChannelData.messages.fetch).toHaveBeenCalledWith(
        "msg-123"
      );
      expect(mockReactionResolve).toHaveBeenCalledWith("thumbsup");
      expect(mockReactionUsersRemove).toHaveBeenCalledTimes(1);
    });

    it("should not throw when reaction does not exist", async () => {
      mockReactionResolve.mockReturnValue(null);
      await client.connect(channelId);

      await expect(
        client.removeReaction("msg-123", channelId, "nonexistent")
      ).resolves.toBeUndefined();
    });

    it("should throw if channel is not found", async () => {
      await client.connect(channelId);
      mockClient.channels.fetch.mockResolvedValue(null);

      await expect(
        client.removeReaction("msg-123", channelId, "thumbsup")
      ).rejects.toThrow(
        "Channel channel-456 not found or is not a text channel"
      );
    });

    it("should silently ignore Unknown Message errors", async () => {
      await client.connect(channelId);
      const error = Object.assign(new Error("Unknown Message"), {
        code: 10008,
      });
      mockTextChannelData.messages.fetch.mockRejectedValueOnce(error);

      await expect(
        client.removeReaction("msg-123", channelId, "thumbsup")
      ).resolves.toBeUndefined();
    });
  });

  describe("User object", () => {
    it("should be a plain object with id and username properties", async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: "star", id: null },
      };

      const mockUser = { id: "user-123", username: "johndoe" };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(typeof receivedEvent!.user).toBe("object");
      expect(receivedEvent!.user.id).toBe("user-123");
      expect(receivedEvent!.user.username).toBe("johndoe");
    });

    it("should have undefined username when not provided", async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      const message = channel.postMessage("Test").onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: "star", id: null },
      };

      const mockUser = { id: "user-456", username: null };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(receivedEvent!.user.id).toBe("user-456");
      expect(receivedEvent!.user.username).toBeUndefined();
    });
  });

  describe("integration: full workflow", () => {
    it("should support posting a message with reactions and listening for reactions", async () => {
      const channel = await client.connect(channelId);
      const reactions: ReactionEvent[] = [];

      const message = channel
        .postMessage("Pick a number:")
        .addReactions(["1\uFE0F\u20E3", "2\uFE0F\u20E3", "3\uFE0F\u20E3"])
        .onReaction((event) => {
          reactions.push(event);
        });
      await waitForMessage(message);

      expect(mockTextChannelData.send).toHaveBeenCalledTimes(1);
      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(3);

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId: channelId },
        emoji: { name: "2\uFE0F\u20E3", id: null },
      };

      const mockUser = { id: "user-voter", username: "Voter" };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(reactions).toHaveLength(1);
      expect(reactions[0].emoji).toBe("2\uFE0F\u20E3");
      expect(reactions[0].user.username).toBe("Voter");
    });
  });

  describe("Channel.onMessage()", () => {
    it("should call callback when a message is received in the channel", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onMessage(callback);

      const mockMessage = {
        id: "msg-new-1",
        channelId: channelId,
        content: "Hello there",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date(),
        attachments: new Map(),
      };

      const handler = getMessageHandler();
      expect(handler).not.toBeNull();
      await handler!(mockMessage);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should provide correct message data", async () => {
      const channel = await client.connect(channelId);
      let receivedMessage: Message | null = null;
      const callback = vi.fn().mockImplementation((msg: Message) => {
        receivedMessage = msg;
      });
      channel.onMessage(callback);

      const mockMessage = {
        id: "msg-new-1",
        channelId: channelId,
        content: "Hello there",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date("2025-01-01"),
        attachments: new Map(),
      };

      const handler = getMessageHandler();
      await handler!(mockMessage);

      expect(receivedMessage).not.toBeNull();
      expect(receivedMessage).toBeInstanceOf(Message);
      expect(receivedMessage!.id).toBe("msg-new-1");
      expect(receivedMessage!.content).toBe("Hello there");
      expect(receivedMessage!.author).toEqual({
        id: "user-001",
        username: "TestUser",
      });
      expect(receivedMessage!.channelId).toBe(channelId);
      expect(receivedMessage!.platform).toBe("discord");
      expect(receivedMessage!.timestamp).toEqual(new Date("2025-01-01"));
      expect(receivedMessage!.attachments).toEqual([]);
    });

    it("should include attachments from the message", async () => {
      const channel = await client.connect(channelId);
      let receivedMessage: Message | null = null;
      const callback = vi.fn().mockImplementation((msg: Message) => {
        receivedMessage = msg;
      });
      channel.onMessage(callback);

      const mockAttachments = new Map([
        [
          "att-1",
          {
            url: "https://cdn.discord.com/file1.png",
            name: "screenshot.png",
            contentType: "image/png",
            size: 12345,
          },
        ],
        [
          "att-2",
          {
            url: "https://cdn.discord.com/file2.txt",
            name: "notes.txt",
            contentType: null,
            size: 256,
          },
        ],
      ]);

      const mockMessage = {
        id: "msg-att-1",
        channelId: channelId,
        content: "Check these files",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date(),
        attachments: mockAttachments,
      };

      const handler = getMessageHandler();
      await handler!(mockMessage);

      expect(receivedMessage).not.toBeNull();
      expect(receivedMessage!.attachments).toHaveLength(2);
      expect(receivedMessage!.attachments![0]).toEqual({
        url: "https://cdn.discord.com/file1.png",
        name: "screenshot.png",
        contentType: "image/png",
        size: 12345,
      });
      expect(receivedMessage!.attachments![1]).toEqual({
        url: "https://cdn.discord.com/file2.txt",
        name: "notes.txt",
        contentType: undefined,
        size: 256,
      });
    });

    it("should ignore messages from the bot itself", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onMessage(callback);

      const mockMessage = {
        id: "msg-bot-1",
        channelId: channelId,
        content: "Bot message",
        author: { id: "bot-user-id", username: "Bot" },
        createdAt: new Date(),
      };

      const handler = getMessageHandler();
      await handler!(mockMessage);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should not call callback for messages in different channels", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onMessage(callback);

      const mockMessage = {
        id: "msg-other-1",
        channelId: "different-channel",
        content: "Wrong channel",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date(),
      };

      const handler = getMessageHandler();
      await handler!(mockMessage);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should support unsubscribing from messages", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const unsubscribe = channel.onMessage(callback);

      const mockMessage = {
        id: "msg-new-1",
        channelId: channelId,
        content: "First message",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date(),
        attachments: new Map(),
      };

      const handler = getMessageHandler();
      await handler!(mockMessage);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      await handler!(mockMessage);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should support multiple message callbacks", async () => {
      const channel = await client.connect(channelId);
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      channel.onMessage(callback1);
      channel.onMessage(callback2);

      const mockMessage = {
        id: "msg-new-1",
        channelId: channelId,
        content: "Hello",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date(),
        attachments: new Map(),
      };

      const handler = getMessageHandler();
      await handler!(mockMessage);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("should handle callback errors gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const channel = await client.connect(channelId);
      const errorCallback = vi
        .fn()
        .mockRejectedValue(new Error("Callback error"));
      const normalCallback = vi.fn();
      channel.onMessage(errorCallback);
      channel.onMessage(normalCallback);

      const mockMessage = {
        id: "msg-new-1",
        channelId: channelId,
        content: "Hello",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date(),
        attachments: new Map(),
      };

      const handler = getMessageHandler();
      await handler!(mockMessage);

      await waitFor(() => {
        expect(errorCallback).toHaveBeenCalledTimes(1);
        expect(normalCallback).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Message callback error:",
          expect.any(Error)
        );
      });
      consoleErrorSpy.mockRestore();
    });

    it("should allow deleting a received message", async () => {
      const channel = await client.connect(channelId);
      let receivedMessage: Message | null = null;
      channel.onMessage((msg) => {
        receivedMessage = msg;
      });

      const handler = getMessageHandler();
      await handler!({
        id: "msg-cmd-1",
        channelId: channelId,
        content: "!help",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date(),
        attachments: new Map(),
      });

      expect(receivedMessage).not.toBeNull();
      await receivedMessage!.delete();

      expect(mockTextChannelData.messages.fetch).toHaveBeenCalledWith(
        "msg-cmd-1"
      );
      expect(mockDiscordMessage.delete).toHaveBeenCalledTimes(1);
    });

    it("should allow reacting to a received message", async () => {
      const channel = await client.connect(channelId);
      let receivedMessage: Message | null = null;
      channel.onMessage((msg) => {
        receivedMessage = msg;
      });

      const handler = getMessageHandler();
      await handler!({
        id: "msg-cmd-2",
        channelId: channelId,
        content: "!ping",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date(),
        attachments: new Map(),
      });

      expect(receivedMessage).not.toBeNull();
      receivedMessage!.addReactions(["white_check_mark"]);
      await receivedMessage!.waitForReactions();

      expect(mockDiscordMessage.react).toHaveBeenCalledWith("white_check_mark");
    });

    it("should allow replying to a received message", async () => {
      const channel = await client.connect(channelId);
      let receivedMessage: Message | null = null;
      channel.onMessage((msg) => {
        receivedMessage = msg;
      });

      const handler = getMessageHandler();
      await handler!({
        id: "msg-cmd-3",
        channelId: channelId,
        content: "!info",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date(),
        attachments: new Map(),
      });

      expect(receivedMessage).not.toBeNull();
      await Promise.resolve(receivedMessage!.reply("Here is the info"));

      expect(mockTextChannelData.send).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Here is the info",
          messageReference: { messageId: "msg-cmd-3" },
        })
      );
    });
  });

  describe("Gateway intents", () => {
    it("should include MessageContent in gateway intents", async () => {
      const discordJs = await import("discord.js");
      const ClientMock = vi.mocked(discordJs.Client);

      expect(ClientMock).toHaveBeenCalled();
      const callArgs = ClientMock.mock.calls[0][0] as { intents: number[] };
      expect(callArgs.intents).toContain(4); // GatewayIntentBits.MessageContent = 4
    });

    it("should include GuildMembers in gateway intents", async () => {
      const discordJs = await import("discord.js");
      const ClientMock = vi.mocked(discordJs.Client);

      expect(ClientMock).toHaveBeenCalled();
      const callArgs = ClientMock.mock.calls[0][0] as { intents: number[] };
      expect(callArgs.intents).toContain(5); // GatewayIntentBits.GuildMembers = 5
    });
  });

  describe("Channel.sendTyping()", () => {
    it("should call sendTyping on the Discord channel", async () => {
      const channel = await client.connect(channelId);
      await channel.sendTyping();

      expect(mockTextChannelData.sendTyping).toHaveBeenCalledTimes(1);
    });
  });

  describe("Channel.beginTyping() / endTyping()", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("should send typing immediately on beginTyping", async () => {
      vi.useFakeTimers();
      const channel = await client.connect(channelId);
      channel.beginTyping();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockTextChannelData.sendTyping).toHaveBeenCalledTimes(1);
      channel.endTyping();
    });

    it("should refresh typing on interval while active", async () => {
      vi.useFakeTimers();
      const channel = await client.connect(channelId);
      channel.beginTyping();

      await vi.advanceTimersByTimeAsync(0);
      expect(mockTextChannelData.sendTyping).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(8000);
      expect(mockTextChannelData.sendTyping).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(8000);
      expect(mockTextChannelData.sendTyping).toHaveBeenCalledTimes(3);

      channel.endTyping();
    });

    it("should stop refreshing after endTyping", async () => {
      vi.useFakeTimers();
      const channel = await client.connect(channelId);
      channel.beginTyping();
      await vi.advanceTimersByTimeAsync(0);

      channel.endTyping();
      mockTextChannelData.sendTyping.mockClear();

      await vi.advanceTimersByTimeAsync(16000);
      expect(mockTextChannelData.sendTyping).not.toHaveBeenCalled();
    });

    it("should keep typing active until all callers end", async () => {
      vi.useFakeTimers();
      const channel = await client.connect(channelId);

      channel.beginTyping(); // refcount = 1
      channel.beginTyping(); // refcount = 2
      await vi.advanceTimersByTimeAsync(0);
      expect(mockTextChannelData.sendTyping).toHaveBeenCalledTimes(1);

      channel.endTyping(); // refcount = 1
      mockTextChannelData.sendTyping.mockClear();

      // Still active — should keep refreshing
      await vi.advanceTimersByTimeAsync(8000);
      expect(mockTextChannelData.sendTyping).toHaveBeenCalledTimes(1);

      channel.endTyping(); // refcount = 0
      mockTextChannelData.sendTyping.mockClear();

      // Now stopped
      await vi.advanceTimersByTimeAsync(16000);
      expect(mockTextChannelData.sendTyping).not.toHaveBeenCalled();
    });

    it("should not go below zero on extra endTyping calls", async () => {
      vi.useFakeTimers();
      const channel = await client.connect(channelId);
      channel.endTyping(); // no-op, already at 0
      channel.endTyping(); // still no-op

      channel.beginTyping();
      await vi.advanceTimersByTimeAsync(0);
      expect(mockTextChannelData.sendTyping).toHaveBeenCalledTimes(1);

      // Single endTyping should still stop it
      channel.endTyping();
    });
  });

  describe("Channel.withTyping()", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("should send typing indicator and return fn result", async () => {
      vi.useFakeTimers();
      const channel = await client.connect(channelId);
      const result = await channel.withTyping(async () => "done");

      // Flush the fire-and-forget sendTyping promise
      await vi.advanceTimersByTimeAsync(0);

      expect(result).toBe("done");
      expect(mockTextChannelData.sendTyping).toHaveBeenCalledTimes(1);
    });

    it("should refresh typing indicator on interval", async () => {
      vi.useFakeTimers();
      const channel = await client.connect(channelId);

      let resolve!: () => void;
      const workPromise = new Promise<void>((r) => {
        resolve = r;
      });

      const typingPromise = channel.withTyping(() => workPromise);

      await vi.advanceTimersByTimeAsync(0);
      expect(mockTextChannelData.sendTyping).toHaveBeenCalledTimes(1);

      // Advance 8 seconds — should refresh
      await vi.advanceTimersByTimeAsync(8000);
      expect(mockTextChannelData.sendTyping).toHaveBeenCalledTimes(2);

      // Advance another 8 seconds — should refresh again
      await vi.advanceTimersByTimeAsync(8000);
      expect(mockTextChannelData.sendTyping).toHaveBeenCalledTimes(3);

      resolve();
      await vi.advanceTimersByTimeAsync(0);
      await typingPromise;
    });

    it("should stop refreshing after fn completes", async () => {
      vi.useFakeTimers();
      const channel = await client.connect(channelId);

      let resolve!: () => void;
      const workPromise = new Promise<void>((r) => {
        resolve = r;
      });

      const typingPromise = channel.withTyping(() => workPromise);
      await vi.advanceTimersByTimeAsync(0);

      resolve();
      await vi.advanceTimersByTimeAsync(0);
      await typingPromise;

      mockTextChannelData.sendTyping.mockClear();
      await vi.advanceTimersByTimeAsync(16000);

      // No further calls after fn completed
      expect(mockTextChannelData.sendTyping).not.toHaveBeenCalled();
    });

    it("should stop refreshing if fn throws", async () => {
      vi.useFakeTimers();
      const channel = await client.connect(channelId);

      let reject!: (err: Error) => void;
      const workPromise = new Promise<void>((_resolve, r) => {
        reject = r;
      });

      const typingPromise = channel.withTyping(() => workPromise);
      // Prevent Node's unhandled rejection warning
      const caught = typingPromise.catch(() => {});
      await vi.advanceTimersByTimeAsync(0);

      reject(new Error("work failed"));
      await vi.advanceTimersByTimeAsync(0);
      await caught;
      await expect(typingPromise).rejects.toThrow("work failed");

      mockTextChannelData.sendTyping.mockClear();
      await vi.advanceTimersByTimeAsync(16000);

      expect(mockTextChannelData.sendTyping).not.toHaveBeenCalled();
    });

    it("should share a single interval across overlapping withTyping calls", async () => {
      vi.useFakeTimers();
      const channel = await client.connect(channelId);

      let resolve1!: () => void;
      let resolve2!: () => void;
      const work1 = new Promise<void>((r) => {
        resolve1 = r;
      });
      const work2 = new Promise<void>((r) => {
        resolve2 = r;
      });

      const p1 = channel.withTyping(() => work1);
      const p2 = channel.withTyping(() => work2);
      await vi.advanceTimersByTimeAsync(0);

      // Only one initial send (second beginTyping sees refcount already > 0)
      expect(mockTextChannelData.sendTyping).toHaveBeenCalledTimes(1);

      // First work completes — typing should continue (second still active)
      resolve1();
      await vi.advanceTimersByTimeAsync(0);
      await p1;
      mockTextChannelData.sendTyping.mockClear();

      await vi.advanceTimersByTimeAsync(8000);
      expect(mockTextChannelData.sendTyping).toHaveBeenCalledTimes(1);

      // Second work completes — typing stops
      resolve2();
      await vi.advanceTimersByTimeAsync(0);
      await p2;
      mockTextChannelData.sendTyping.mockClear();

      await vi.advanceTimersByTimeAsync(16000);
      expect(mockTextChannelData.sendTyping).not.toHaveBeenCalled();
    });
  });

  describe("File attachments", () => {
    it("should post a message with file attachments", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Here is a report", {
        files: [{ content: Buffer.from("file content"), name: "report.md" }],
      });
      await waitForMessage(message);

      expect(mockTextChannelData.send).toHaveBeenCalledTimes(1);
      const sendArgs = mockTextChannelData.send.mock.calls[0][0];
      expect(sendArgs.content).toBe("Here is a report");
      expect(sendArgs.files).toHaveLength(1);
      expect(sendArgs.files[0]).toBeInstanceOf(MockAttachmentBuilder);
    });

    it("should handle string file content by converting to Buffer", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Report", {
        files: [{ content: "string content", name: "report.txt" }],
      });
      await waitForMessage(message);

      expect(mockTextChannelData.send).toHaveBeenCalledTimes(1);
      const sendArgs = mockTextChannelData.send.mock.calls[0][0];
      expect(sendArgs.files).toHaveLength(1);
    });

    it("should support multiple file attachments", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Multiple files", {
        files: [
          { content: Buffer.from("file 1"), name: "file1.txt" },
          { content: Buffer.from("file 2"), name: "file2.txt" },
        ],
      });
      await waitForMessage(message);

      const sendArgs = mockTextChannelData.send.mock.calls[0][0];
      expect(sendArgs.files).toHaveLength(2);
    });
  });

  describe("Oversized message handling", () => {
    it("should convert oversized string content to a file attachment", async () => {
      const channel = await client.connect(channelId);
      const longContent = "x".repeat(2001);
      const message = channel.postMessage(longContent);
      await waitForMessage(message);

      expect(mockTextChannelData.send).toHaveBeenCalledTimes(1);
      const sendArgs = mockTextChannelData.send.mock.calls[0][0];
      expect(sendArgs.content).toBe(
        "(Message too long \u2014 see attached file)"
      );
      expect(sendArgs.files).toHaveLength(1);
      expect(sendArgs.files[0]).toBeInstanceOf(MockAttachmentBuilder);
    });

    it("should not convert content at exactly 2000 characters", async () => {
      const channel = await client.connect(channelId);
      const exactContent = "x".repeat(2000);
      const message = channel.postMessage(exactContent);
      await waitForMessage(message);

      const sendArgs = mockTextChannelData.send.mock.calls[0][0];
      expect(sendArgs.content).toBe(exactContent);
      expect(sendArgs.files).toBeUndefined();
    });

    it("should merge overflow attachment with user-provided files", async () => {
      const channel = await client.connect(channelId);
      const longContent = "x".repeat(2001);
      const message = channel.postMessage(longContent, {
        files: [{ content: Buffer.from("extra"), name: "extra.txt" }],
      });
      await waitForMessage(message);

      const sendArgs = mockTextChannelData.send.mock.calls[0][0];
      expect(sendArgs.files).toHaveLength(2);
    });

    it("should truncate oversized content on updateMessage", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postMessage("initial");
      const longContent = "x".repeat(2001);
      await msg.update(longContent);

      expect(mockDiscordMessage.edit).toHaveBeenCalledTimes(1);
      const editArgs = mockDiscordMessage.edit.mock.calls[0][0];
      expect(editArgs.content).toHaveLength(2000);
      expect(editArgs.content.endsWith("\u2026")).toBe(true);
    });

    it("should not truncate content at exactly 2000 chars on updateMessage", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postMessage("initial");
      const exactContent = "x".repeat(2000);
      await msg.update(exactContent);

      const editArgs = mockDiscordMessage.edit.mock.calls[0][0];
      expect(editArgs.content).toBe(exactContent);
    });
  });

  describe("Message.startThread()", () => {
    it("should create a thread from a message", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Start thread here");
      await waitForMessage(message);

      const thread = await message.startThread("My Thread");

      expect(mockDiscordMessage.startThread).toHaveBeenCalledWith({
        name: "My Thread",
        autoArchiveDuration: undefined,
      });
      expect(thread.id).toBe("thread-001");
      expect(thread.platform).toBe("discord");
    });

    it("should support autoArchiveDuration option", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Thread with options");
      await waitForMessage(message);

      await message.startThread("Timed Thread", 1440);

      expect(mockDiscordMessage.startThread).toHaveBeenCalledWith({
        name: "Timed Thread",
        autoArchiveDuration: 1440,
      });
    });
  });

  describe("Message.delete()", () => {
    it("should delete a message without a thread", async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage("Hello");
      await waitForMessage(message);

      await message.delete();

      expect(mockDiscordMessage.delete).toHaveBeenCalledTimes(1);
    });

    it("should delete thread before deleting the message", async () => {
      const mockThreadDelete = vi.fn().mockResolvedValue(undefined);
      mockDiscordMessage.thread = { delete: mockThreadDelete };

      const channel = await client.connect(channelId);
      const message = channel.postMessage("Hello");
      await waitForMessage(message);

      await message.delete();

      expect(mockThreadDelete).toHaveBeenCalledTimes(1);
      expect(mockDiscordMessage.delete).toHaveBeenCalledTimes(1);
    });

    it("should skip thread deletion when cascadeReplies is false", async () => {
      const mockThreadDelete = vi.fn().mockResolvedValue(undefined);
      mockDiscordMessage.thread = { delete: mockThreadDelete };

      const channel = await client.connect(channelId);
      const message = channel.postMessage("Hello");
      await waitForMessage(message);

      await message.delete({ cascadeReplies: false });

      expect(mockThreadDelete).not.toHaveBeenCalled();
      expect(mockDiscordMessage.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe("Channel.bulkDelete()", () => {
    it("should delete messages in bulk", async () => {
      const channel = await client.connect(channelId);
      const count = await channel.bulkDelete(10);

      expect(mockTextChannelData.bulkDelete).toHaveBeenCalledWith(10, true);
      expect(count).toBe(2); // Mock returns Map with 2 entries
    });
  });

  describe("Channel.getMessages()", () => {
    it("should list recent channel messages", async () => {
      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      const mockCollection = new Map([
        [
          "m1",
          {
            id: "m1",
            content: "Hello",
            author: { id: "user-1", username: "alice" },
            createdAt,
            attachments: new Map(),
            partial: false,
          },
        ],
      ]);
      mockTextChannelData.messages.fetch.mockResolvedValueOnce(mockCollection);

      const channel = await client.connect(channelId);
      const messages = await channel.getMessages({ limit: 1 });

      expect(mockTextChannelData.messages.fetch).toHaveBeenCalledWith({
        limit: 1,
      });
      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe("m1");
      expect(messages[0].content).toBe("Hello");
      expect(messages[0].author).toEqual({ id: "user-1", username: "alice" });
      expect(messages[0].timestamp).toEqual(createdAt);
    });

    it("should filter messages by author: me", async () => {
      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      const mockCollection = new Map([
        [
          "mine",
          {
            id: "mine",
            content: "Bot msg",
            author: { id: "bot-user-id", username: "test-bot" },
            createdAt,
            attachments: new Map(),
            partial: false,
          },
        ],
        [
          "other",
          {
            id: "other",
            content: "User msg",
            author: { id: "user-1", username: "alice" },
            createdAt,
            attachments: new Map(),
            partial: false,
          },
        ],
      ]);
      mockTextChannelData.messages.fetch.mockResolvedValueOnce(mockCollection);

      const channel = await client.connect(channelId);
      const messages = await channel.getMessages({ author: "me" });

      expect(messages).toHaveLength(1);
      expect(messages[0].id).toBe("mine");
    });
  });

  describe("Channel.getThreads()", () => {
    it("should return active and archived threads", async () => {
      const channel = await client.connect(channelId);
      const threads = await channel.getThreads();

      expect(mockTextChannelData.threads.fetchActive).toHaveBeenCalled();
      expect(mockTextChannelData.threads.fetchArchived).toHaveBeenCalled();
      expect(threads).toHaveLength(2);
      expect(threads[0].id).toBe("thread-1");
      expect(threads[1].id).toBe("thread-2");
      expect(threads[0].platform).toBe("discord");
    });

    it("should delete a thread via thread.delete()", async () => {
      const channel = await client.connect(channelId);
      const threads = await channel.getThreads();

      // Next channels.fetch call (for deleteThread) returns a MockThreadChannel
      const mockThread = new MockThreadChannel("thread-1");
      mockClient.channels.fetch.mockResolvedValueOnce(mockThread);

      await threads[0].delete();

      expect(mockClient.channels.fetch).toHaveBeenCalledWith("thread-1");
      expect(mockThreadChannelDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe("Channel.getMembers()", () => {
    it("should return members who can view the channel", async () => {
      mockGuildMembersList.mockResolvedValue(
        new Map([
          [
            "user-1",
            {
              id: "user-1",
              user: { username: "alice" },
              displayName: "Alice A",
            },
          ],
          [
            "user-2",
            {
              id: "user-2",
              user: { username: "bob" },
              displayName: "Bob B",
            },
          ],
        ])
      );
      mockPermissionsFor.mockReturnValue({ has: () => true });

      const channel = await client.connect(channelId);
      const members = await channel.getMembers();

      expect(members).toHaveLength(2);
      expect(members[0]).toEqual({
        id: "user-1",
        username: "alice",
        displayName: "Alice A",
        mention: "<@user-1>",
      });
      expect(members[1]).toEqual({
        id: "user-2",
        username: "bob",
        displayName: "Bob B",
        mention: "<@user-2>",
      });
    });

    it("should filter out members without ViewChannel permission", async () => {
      mockGuildMembersList.mockResolvedValue(
        new Map([
          [
            "user-1",
            {
              id: "user-1",
              user: { username: "alice" },
              displayName: "Alice",
            },
          ],
          [
            "user-2",
            {
              id: "user-2",
              user: { username: "bob" },
              displayName: "Bob",
            },
          ],
        ])
      );
      // First member can view, second cannot
      mockPermissionsFor.mockImplementation((member: { id: string }) => ({
        has: (perm: string) => perm === "ViewChannel" && member.id === "user-1",
      }));

      const channel = await client.connect(channelId);
      const members = await channel.getMembers();

      expect(members).toHaveLength(1);
      expect(members[0].username).toBe("alice");
    });

    it("should return empty array when no members can view the channel", async () => {
      mockGuildMembersList.mockResolvedValue(new Map());

      const channel = await client.connect(channelId);
      const members = await channel.getMembers();

      expect(members).toEqual([]);
    });

    it("should produce mention strings in <@id> format", async () => {
      mockGuildMembersList.mockResolvedValue(
        new Map([
          [
            "12345",
            {
              id: "12345",
              user: { username: "testuser" },
              displayName: "Test User",
            },
          ],
        ])
      );
      mockPermissionsFor.mockReturnValue({ has: () => true });

      const channel = await client.connect(channelId);
      const members = await channel.getMembers();

      expect(members[0].mention).toBe("<@12345>");
    });
  });

  describe("Message.setReactions()", () => {
    it("should add emojis and register handler", async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel
        .postMessage("Test")
        .setReactions(["👍", "👎"], callback);
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(2);
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(1, "👍");
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(2, "👎");
    });

    it("should diff emojis on subsequent calls", async () => {
      const channel = await client.connect(channelId);
      const message = await channel.postMessage("Test");

      message.setReactions(["👍", "👎"]);
      await message.waitForReactions();
      mockDiscordMessage.react.mockClear();

      message.setReactions(["👍", "🔥"]);
      await message.waitForReactions();

      // Should remove 👎 and add 🔥
      expect(mockReactionResolve).toHaveBeenCalledWith("👎");
      expect(mockDiscordMessage.react).toHaveBeenCalledWith("🔥");
      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(1);
    });

    it("should replace reaction handler", async () => {
      const channel = await client.connect(channelId);
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      const message = await channel.postMessage("Test");
      message.setReactions(["👍"], handler1);
      message.setReactions(["👍"], handler2);
      await message.waitForReactions();

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId },
        emoji: { name: "👍", id: null },
      };
      const mockUser = { id: "user-001", username: "alice" };
      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("Channel.postDismissable()", () => {
    it("should post message with trash reaction", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postDismissable(
        "Dismissable message",
        "owner-id"
      );
      await msg.waitForReactions();

      expect(mockTextChannelData.send).toHaveBeenCalledTimes(1);
      expect(mockDiscordMessage.react).toHaveBeenCalledWith("🗑️");
    });

    it("should delete message when owner reacts with trash", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postDismissable("Dismissable", "owner-id");
      await msg.waitForReactions();

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId },
        emoji: { name: "🗑️", id: null },
      };
      const mockUser = { id: "owner-id", username: "owner" };
      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      await waitFor(() => {
        expect(mockDiscordMessage.delete).toHaveBeenCalledTimes(1);
      });
    });

    it("should ignore reactions from non-owners", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postDismissable("Dismissable", "owner-id");
      await msg.waitForReactions();

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId },
        emoji: { name: "🗑️", id: null },
      };
      const mockUser = { id: "other-user", username: "other" };
      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(mockDiscordMessage.delete).not.toHaveBeenCalled();
    });

    it("should ignore non-trash reactions from owner", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postDismissable("Dismissable", "owner-id");
      await msg.waitForReactions();

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId },
        emoji: { name: "👍", id: null },
      };
      const mockUser = { id: "owner-id", username: "owner" };
      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(mockDiscordMessage.delete).not.toHaveBeenCalled();
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

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId },
        emoji: { name: "👍", id: null },
      };
      const mockUser = { id: "user-001", username: "alice" };
      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("should subscribe directly after message resolves", async () => {
      const channel = await client.connect(channelId);
      const message = await channel.postMessage("Test");

      const callback = vi.fn();
      message.onReaction(callback);

      const mockReaction = {
        partial: false,
        message: { id: "msg-123", channelId },
        emoji: { name: "👍", id: null },
      };
      const mockUser = { id: "user-001", username: "alice" };
      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("Connection resilience", () => {
    it("should register onDisconnect callback", async () => {
      const callback = vi.fn();
      const unsubscribe = client.onDisconnect(callback);

      expect(typeof unsubscribe).toBe("function");
    });

    it("should register onError callback", async () => {
      const callback = vi.fn();
      const unsubscribe = client.onError(callback);

      expect(typeof unsubscribe).toBe("function");
    });

    it("should call disconnect callback on shard disconnect", async () => {
      await client.connect(channelId);
      const callback = vi.fn();
      client.onDisconnect(callback);

      const handlers = getShardHandler("shardDisconnect");
      expect(handlers.length).toBeGreaterThan(0);

      // Use the last registered handler (from the current client instance)
      handlers[handlers.length - 1]({}, 0);

      await waitFor(() => {
        expect(callback).toHaveBeenCalledWith("Shard 0 disconnected");
      });
    });

    it("should call error callback on shard error", async () => {
      await client.connect(channelId);
      const callback = vi.fn();
      client.onError(callback);

      const handlers = getShardHandler("shardError");
      expect(handlers.length).toBeGreaterThan(0);

      const testError = new Error("Connection lost");
      handlers[handlers.length - 1](testError, 0);

      await waitFor(() => {
        expect(callback).toHaveBeenCalledWith(testError);
      });
    });

    it("should unsubscribe disconnect callbacks", async () => {
      const callback = vi.fn();
      const unsubscribe = client.onDisconnect(callback);
      unsubscribe();

      const handlers = getShardHandler("shardDisconnect");
      if (handlers.length > 0) {
        handlers[handlers.length - 1]({}, 0);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(callback).not.toHaveBeenCalled();
    });

    it("should unsubscribe error callbacks", async () => {
      const callback = vi.fn();
      const unsubscribe = client.onError(callback);
      unsubscribe();

      const handlers = getShardHandler("shardError");
      if (handlers.length > 0) {
        handlers[handlers.length - 1](new Error("test"), 0);
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("Thread features", () => {
    it("should create a thread via channel.createThread()", async () => {
      const channel = await client.connect(channelId);
      const thread = await channel.createThread(
        "Thread root message",
        "My Thread"
      );

      expect(mockTextChannelData.send).toHaveBeenCalledWith(
        expect.objectContaining({ content: "Thread root message" })
      );
      expect(mockDiscordMessage.startThread).toHaveBeenCalledWith({
        name: "My Thread",
        autoArchiveDuration: undefined,
      });
      expect(thread).toBeInstanceOf(Thread);
      expect(thread.id).toBe("thread-001");
      expect(thread.channelId).toBe(channelId);
      expect(thread.platform).toBe("discord");
    });

    it("should post messages in a thread via thread.post()", async () => {
      const channel = await client.connect(channelId);
      const thread = await channel.createThread("Root", "Session");

      // postToThread calls postMessage(threadId, ...) which fetches the thread channel
      mockClient.channels.fetch.mockResolvedValueOnce(
        new MockThreadChannel("thread-001")
      );
      const msg = await thread.post("Hello from thread");

      expect(mockThreadSend).toHaveBeenCalledWith(
        expect.objectContaining({ content: "Hello from thread" })
      );
      expect(msg).toBeInstanceOf(Message);
      expect(msg.id).toBe("thread-msg-1");
    });

    it("should fire thread.onReply() when message arrives in thread channel", async () => {
      const channel = await client.connect(channelId);
      const thread = await channel.createThread("Root", "Session");

      const callback = vi.fn();
      thread.onReply(callback);

      // Discord thread messages have channelId = thread channel ID
      const handler = getMessageHandler();
      await handler!({
        id: "reply-msg-1",
        channelId: "thread-001",
        content: "A thread reply",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date(),
        attachments: new Map(),
      });

      expect(callback).toHaveBeenCalledTimes(1);
      const msg = callback.mock.calls[0][0] as Message;
      expect(msg.content).toBe("A thread reply");
      expect(msg).toBeInstanceOf(Message);
    });

    it("should NOT fire channel.onMessage() for thread messages", async () => {
      const channel = await client.connect(channelId);
      const channelCallback = vi.fn();
      channel.onMessage(channelCallback);

      const thread = await channel.createThread("Root", "Session");
      const threadCallback = vi.fn();
      thread.onReply(threadCallback);

      const handler = getMessageHandler();
      await handler!({
        id: "thread-reply-1",
        channelId: "thread-001",
        content: "Thread reply",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date(),
        attachments: new Map(),
      });

      expect(threadCallback).toHaveBeenCalledTimes(1);
      expect(channelCallback).not.toHaveBeenCalled();
    });

    it("should stop listening when thread.offReply() is called", async () => {
      const channel = await client.connect(channelId);
      const thread = await channel.createThread("Root", "Session");

      const callback = vi.fn();
      thread.onReply(callback);

      const handler = getMessageHandler();
      await handler!({
        id: "msg-1",
        channelId: "thread-001",
        content: "First",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date(),
        attachments: new Map(),
      });
      expect(callback).toHaveBeenCalledTimes(1);

      thread.offReply();

      await handler!({
        id: "msg-2",
        channelId: "thread-001",
        content: "Second",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date(),
        attachments: new Map(),
      });
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should delete thread and stop listeners via thread.delete()", async () => {
      const channel = await client.connect(channelId);
      const thread = await channel.createThread("Root", "Session");

      const callback = vi.fn();
      thread.onReply(callback);

      mockClient.channels.fetch.mockResolvedValueOnce(
        new MockThreadChannel("thread-001")
      );
      await thread.delete();

      expect(mockThreadChannelDelete).toHaveBeenCalledTimes(1);

      const handler = getMessageHandler();
      await handler!({
        id: "msg-after-delete",
        channelId: "thread-001",
        content: "Should not fire",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date(),
        attachments: new Map(),
      });
      expect(callback).not.toHaveBeenCalled();
    });

    it("should post with file attachments via thread.post()", async () => {
      const channel = await client.connect(channelId);
      const thread = await channel.createThread("Root", "Session");

      mockClient.channels.fetch.mockResolvedValueOnce(
        new MockThreadChannel("thread-001")
      );
      await thread.post("Report", [{ content: "# Report", name: "report.md" }]);

      expect(mockThreadSend).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "Report",
          files: expect.arrayContaining([expect.any(MockAttachmentBuilder)]),
        })
      );
    });

    it("should pass files through msg.reply(content, files)", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postMessage("Hello");

      await Promise.resolve(
        msg.reply("Reply with file", [
          { content: Buffer.from("data"), name: "file.bin" },
        ])
      );

      expect(mockTextChannelData.send).toHaveBeenCalledTimes(2);
      const replyArgs = mockTextChannelData.send.mock.calls[1][0];
      expect(replyArgs.files).toHaveLength(1);
      expect(replyArgs.files[0]).toBeInstanceOf(MockAttachmentBuilder);
      expect(replyArgs.messageReference).toEqual({ messageId: "msg-123" });
    });

    it("should wire thread message reply() to post in the same thread", async () => {
      const channel = await client.connect(channelId);
      const thread = await channel.createThread("Root", "Session");

      // Post a message in the thread
      mockClient.channels.fetch.mockResolvedValueOnce(
        new MockThreadChannel("thread-001")
      );
      const threadMsg = await thread.post("First message");

      // Reply to that thread message — should go to the same thread
      mockClient.channels.fetch.mockResolvedValueOnce(
        new MockThreadChannel("thread-001")
      );
      await Promise.resolve(threadMsg.reply("Reply in thread"));

      expect(mockThreadSend).toHaveBeenCalledTimes(2);
      expect(mockThreadSend).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ content: "First message" })
      );
      expect(mockThreadSend).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ content: "Reply in thread" })
      );
    });

    it("should return enhanced Thread from msg.startThread()", async () => {
      const channel = await client.connect(channelId);
      const msg = await channel.postMessage("Start thread here");
      const thread = await msg.startThread("My Thread");

      expect(thread).toBeInstanceOf(Thread);
      expect(thread.id).toBe("thread-001");
      expect(typeof thread.post).toBe("function");
      expect(typeof thread.onReply).toBe("function");
      expect(typeof thread.offReply).toBe("function");
      expect(typeof thread.delete).toBe("function");
    });

    it("should reconnect to an existing thread via channel.openThread()", async () => {
      const channel = await client.connect(channelId);
      const thread = channel.openThread("thread-001");

      expect(thread).toBeInstanceOf(Thread);
      expect(thread.id).toBe("thread-001");
      expect(thread.channelId).toBe(channelId);
      expect(thread.platform).toBe("discord");
    });

    it("should post messages via openThread()", async () => {
      const channel = await client.connect(channelId);
      const thread = channel.openThread("thread-001");

      mockClient.channels.fetch.mockResolvedValueOnce(
        new MockThreadChannel("thread-001")
      );
      const msg = await thread.post("Reconnected message");

      expect(mockThreadSend).toHaveBeenCalledWith(
        expect.objectContaining({ content: "Reconnected message" })
      );
      expect(msg).toBeInstanceOf(Message);
    });

    it("should receive replies via openThread().onReply()", async () => {
      const channel = await client.connect(channelId);
      const thread = channel.openThread("thread-001");

      const callback = vi.fn();
      thread.onReply(callback);

      const handler = getMessageHandler();
      await handler!({
        id: "reply-msg-1",
        channelId: "thread-001",
        content: "Reply to reopened thread",
        author: { id: "user-001", username: "TestUser" },
        createdAt: new Date(),
        attachments: new Map(),
      });

      expect(callback).toHaveBeenCalledTimes(1);
      const msg = callback.mock.calls[0][0] as Message;
      expect(msg.content).toBe("Reply to reopened thread");
    });
  });
});
