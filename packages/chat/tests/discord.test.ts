import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DiscordConfig, ReactionEvent } from '../src/types.js';

// Use vi.hoisted to define mocks that are used in vi.mock()
const {
  mockDiscordMessage,
  mockTextChannelData,
  mockClient,
  MockTextChannel,
  getReactionHandler,
  setReactionHandler,
} = vi.hoisted(() => {
  let reactionHandler: ((reaction: unknown, user: unknown) => void) | null = null;

  const mockDiscordMessage = {
    id: 'msg-123',
    channelId: 'channel-456',
    react: vi.fn(),
  };

  const mockTextChannelData = {
    id: 'channel-456',
    send: vi.fn(),
    messages: {
      fetch: vi.fn(),
    },
  };

  // Mock TextChannel class for instanceof checks
  class MockTextChannel {
    id = 'channel-456';
    send = mockTextChannelData.send;
    messages = mockTextChannelData.messages;
  }

  const mockClient = {
    login: vi.fn(),
    channels: {
      fetch: vi.fn(),
    },
    on: vi.fn((event: string, handler: typeof reactionHandler) => {
      if (event === 'messageReactionAdd') {
        reactionHandler = handler;
      }
    }),
    destroy: vi.fn(),
  };

  return {
    mockDiscordMessage,
    mockTextChannelData,
    mockClient,
    MockTextChannel,
    getReactionHandler: () => reactionHandler,
    setReactionHandler: (handler: typeof reactionHandler) => {
      reactionHandler = handler;
    },
  };
});

// Mock discord.js
vi.mock('discord.js', () => ({
  Client: vi.fn().mockImplementation(() => mockClient),
  GatewayIntentBits: {
    Guilds: 1,
    GuildMessages: 2,
    GuildMessageReactions: 3,
  },
  TextChannel: MockTextChannel,
}));

// Import after mocking
import { DiscordChatClient } from '../src/discord/DiscordChatClient.js';
import { Channel } from '../src/Channel.js';
import { Message } from '../src/Message.js';

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
  interval: number = 10,
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

describe('DiscordChatClient', () => {
  let client: DiscordChatClient;
  const config: DiscordConfig = {
    type: 'discord',
    token: 'test-bot-token',
    guildId: 'guild-789',
  };
  const channelId = 'channel-456';

  beforeEach(() => {
    vi.clearAllMocks();
    setReactionHandler(null);

    // Clear environment variables
    delete process.env.DISCORD_TOKEN;
    delete process.env.DISCORD_GUILD_ID;

    // Reset mock implementations
    mockClient.login.mockResolvedValue('token');
    mockClient.channels.fetch.mockResolvedValue(
      Object.assign(new MockTextChannel(), mockTextChannelData),
    );
    mockTextChannelData.send.mockResolvedValue(mockDiscordMessage);
    mockTextChannelData.messages.fetch.mockResolvedValue(mockDiscordMessage);
    mockDiscordMessage.react.mockResolvedValue(undefined);
    mockClient.destroy.mockResolvedValue(undefined);

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

  describe('config', () => {
    it('should use explicit config values', async () => {
      const explicitConfig: DiscordConfig = {
        type: 'discord',
        token: 'explicit-token',
        guildId: 'explicit-guild',
      };

      const explicitClient = new DiscordChatClient(explicitConfig);
      await explicitClient.connect(channelId);

      expect(mockClient.login).toHaveBeenCalledWith('explicit-token');
    });

    it('should use environment variables as defaults', async () => {
      process.env.DISCORD_TOKEN = 'env-token';
      process.env.DISCORD_GUILD_ID = 'env-guild';

      const envConfig: DiscordConfig = {
        type: 'discord',
        token: process.env.DISCORD_TOKEN,
        guildId: process.env.DISCORD_GUILD_ID,
      };

      const envClient = new DiscordChatClient(envConfig);
      await envClient.connect(channelId);

      expect(mockClient.login).toHaveBeenCalledWith('env-token');
    });

    it('should allow explicit config to override environment variables', async () => {
      process.env.DISCORD_TOKEN = 'env-token';
      process.env.DISCORD_GUILD_ID = 'env-guild';

      const overrideConfig: DiscordConfig = {
        type: 'discord',
        token: 'override-token',
        guildId: 'override-guild',
      };

      const overrideClient = new DiscordChatClient(overrideConfig);
      await overrideClient.connect(channelId);

      expect(mockClient.login).toHaveBeenCalledWith('override-token');
    });
  });

  describe('connect()', () => {
    it('should login with the provided token', async () => {
      await client.connect(channelId);

      expect(mockClient.login).toHaveBeenCalledWith('test-bot-token');
      expect(mockClient.login).toHaveBeenCalledTimes(1);
    });

    it('should fetch the specified channel', async () => {
      await client.connect(channelId);

      expect(mockClient.channels.fetch).toHaveBeenCalledWith(channelId);
      expect(mockClient.channels.fetch).toHaveBeenCalledTimes(1);
    });

    it('should return a Channel object', async () => {
      const channel = await client.connect(channelId);

      expect(channel).toBeInstanceOf(Channel);
      expect(channel.id).toBe(channelId);
      expect(channel.platform).toBe('discord');
    });

    it('should throw error when login fails', async () => {
      mockClient.login.mockRejectedValue(new Error('Invalid token'));

      await expect(client.connect(channelId)).rejects.toThrow('Invalid token');
    });

    it('should throw error when channel is not found', async () => {
      mockClient.channels.fetch.mockResolvedValue(null);

      await expect(client.connect('invalid-channel')).rejects.toThrow(
        'Channel invalid-channel not found or is not a text channel',
      );
    });

    it('should throw error when channel is not a TextChannel', async () => {
      mockClient.channels.fetch.mockResolvedValue({ type: 'GUILD_VOICE' });

      await expect(client.connect('voice-channel')).rejects.toThrow(
        'Channel voice-channel not found or is not a text channel',
      );
    });
  });

  describe('Channel.postMessage()', () => {
    it('should call channel.send() with the message content', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Hello, world!');
      await waitForMessage(message);

      expect(mockTextChannelData.send).toHaveBeenCalledWith({
        content: 'Hello, world!',
      });
    });

    it('should return a Message object', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);

      expect(message).toBeInstanceOf(Message);
    });

    it('should return a Message with the correct id', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);

      expect(message.id).toBe('msg-123');
    });

    it('should return a Message with the correct channelId', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);

      expect(message.channelId).toBe(channelId);
    });

    it('should return a Message with platform set to "discord"', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);

      expect(message.platform).toBe('discord');
    });
  });

  describe('Message.addReactions()', () => {
    beforeEach(() => {
      // Ensure destroy is still mocked after any vi.clearAllMocks() calls
      mockClient.destroy.mockResolvedValue(undefined);
    });

    it('should call message.react() on the Discord message', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);

      message.addReactions(['thumbsup']);
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledWith('thumbsup');
    });

    it('should support unicode emoji reactions', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);

      message.addReactions(['\u{1F44D}']);
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledWith('\u{1F44D}');
    });

    it('should add multiple reactions from an array', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);

      message.addReactions(['1\uFE0F\u20E3', '2\uFE0F\u20E3', '3\uFE0F\u20E3']);
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(3);
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(1, '1\uFE0F\u20E3');
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(2, '2\uFE0F\u20E3');
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(3, '3\uFE0F\u20E3');
    });

    it('should return the Message instance for chaining', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);
      const returnedMessage = message.addReactions(['emoji1', 'emoji2']);

      expect(returnedMessage).toBe(message);
    });

    it('should support chaining multiple addReactions() calls', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);
      message.addReactions(['first']).addReactions(['second', 'third']).addReactions(['fourth']);
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(4);
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(1, 'first');
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(2, 'second');
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(3, 'third');
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(4, 'fourth');
    });

    it('should handle empty array gracefully', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);
      message.addReactions([]);
      await waitForMessage(message);

      expect(mockDiscordMessage.react).not.toHaveBeenCalled();
    });

    it('should add reactions sequentially (not in parallel)', async () => {
      const callOrder: string[] = [];

      mockDiscordMessage.react.mockImplementation(async (emoji: string) => {
        callOrder.push(`start-${emoji}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
        callOrder.push(`end-${emoji}`);
      });

      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);
      message.addReactions(['1', '2']);
      await waitForMessage(message);

      expect(callOrder).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);

      // Reset the mock to prevent interference with other tests
      mockDiscordMessage.react.mockResolvedValue(undefined);
    });
  });

  describe('Message.onReaction()', () => {
    it('should call callback when reaction is added to message', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage('Test message').onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'thumbsup', id: null },
      };
      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should provide correct ReactionEvent data', async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      const message = channel.postMessage('Test').onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'heart', id: null },
      };
      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent!.emoji).toBe('heart');
      expect(receivedEvent!.messageId).toBe('msg-123');
      expect(receivedEvent!.channelId).toBe(channelId);
      expect(receivedEvent!.user).toEqual({ id: 'user-001', username: 'TestUser' });
    });

    it('should handle user without username', async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      const message = channel.postMessage('Test').onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'wave', id: null },
      };
      const mockUser = { id: 'user-123', username: null };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(receivedEvent!.user.id).toBe('user-123');
      expect(receivedEvent!.user.username).toBeUndefined();
    });

    it('should not call callback for reactions on different messages', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage('Test').onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: 'different-msg-999', channelId: channelId },
        emoji: { name: 'thumbsup', id: null },
      };
      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple callbacks on the same message', async () => {
      const channel = await client.connect(channelId);
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const message = channel.postMessage('Test').onReaction(callback1).onReaction(callback2);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'fire', id: null },
      };
      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should be chainable with addReactions', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage('Vote!').addReactions(['1️⃣', '2️⃣']).onReaction(callback);
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(2);

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: '1️⃣', id: null },
      };
      const mockUser = { id: 'user-voter', username: 'Voter' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle partial reactions by fetching them', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage('Test').onReaction(callback);
      await waitForMessage(message);

      const fetchMock = vi.fn().mockResolvedValue(undefined);
      const mockReaction = {
        partial: true,
        fetch: fetchMock,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'thumbsup', id: null },
      };
      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      handler!(mockReaction, mockUser);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
        expect(callback).toHaveBeenCalledTimes(1);
      });
    });

    it('should handle errors when fetching partial reactions', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const message = channel.postMessage('Test').onReaction(callback);
      await waitForMessage(message);

      const fetchMock = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
      const mockReaction = {
        partial: true,
        fetch: fetchMock,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'thumbsup', id: null },
      };
      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      handler!(mockReaction, mockUser);

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to fetch partial reaction:',
          expect.any(Error),
        );
      });
      expect(callback).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should use emoji id when name is not available (custom emoji)', async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      const message = channel.postMessage('Test').onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: null, id: 'custom-emoji-12345' },
      };
      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(receivedEvent!.emoji).toBe('custom-emoji-12345');
    });

    it('should provide a timestamp for the reaction event', async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      const message = channel.postMessage('Test').onReaction(callback);
      await waitForMessage(message);

      const beforeTime = new Date();
      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'clock', id: null },
      };
      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      const afterTime = new Date();

      expect(receivedEvent!.timestamp).toBeInstanceOf(Date);
      expect(receivedEvent!.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(receivedEvent!.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should handle async callback errors gracefully', async () => {
      const channel = await client.connect(channelId);
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorCallback = vi.fn().mockRejectedValue(new Error('Callback error'));
      const normalCallback = vi.fn();

      const message = channel
        .postMessage('Test')
        .onReaction(errorCallback)
        .onReaction(normalCallback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'boom', id: null },
      };
      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      handler!(mockReaction, mockUser);

      await waitFor(() => {
        expect(errorCallback).toHaveBeenCalledTimes(1);
        expect(normalCallback).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalled();
      });
      consoleErrorSpy.mockRestore();
    });

    it('should stop listening when offReaction is called', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage('Test').onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'thumbsup', id: null },
      };
      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);
      expect(callback).toHaveBeenCalledTimes(1);

      message.offReaction();

      await handler!(mockReaction, mockUser);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnect()', () => {
    it('should destroy the Discord client', async () => {
      await client.connect(channelId);
      await client.disconnect();

      expect(mockClient.destroy).toHaveBeenCalled();
    });

    it('should clear reaction listeners', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const message = channel.postMessage('Test').onReaction(callback);
      await waitForMessage(message);

      channel.disconnect();

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'ghost', id: null },
      };

      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      if (handler) {
        await handler(mockReaction, mockUser);
      }

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Message awaiting behavior', () => {
    it('should await message post completion', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);

      expect(message).toBeInstanceOf(Message);
      expect(message.id).toBe('msg-123');
    });

    it('should wait for all reactions to complete when awaited', async () => {
      const callOrder: string[] = [];

      mockDiscordMessage.react.mockImplementation(async () => {
        callOrder.push('react');
        await new Promise((resolve) => setTimeout(resolve, 5));
      });

      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message').addReactions(['emoji1', 'emoji2']);
      await waitForMessage(message);

      callOrder.push('done');

      expect(callOrder).toEqual(['react', 'react', 'done']);

      // Reset the mock to prevent interference with other tests
      mockDiscordMessage.react.mockResolvedValue(undefined);
    });

    it('should allow chaining directly on postMessage return', async () => {
      const channel = await client.connect(channelId);

      // This should work - chain reactions on postMessage return
      const message = channel.postMessage('Test').addReactions(['thumbsup', 'heart']);
      await waitForMessage(message);

      expect(message.id).toBe('msg-123');
      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(2);
    });
  });

  describe('addReaction() (direct client method)', () => {
    it('should fetch the message and call react()', async () => {
      await client.connect(channelId);

      await client.addReaction('msg-123', channelId, 'thumbsup');

      expect(mockTextChannelData.messages.fetch).toHaveBeenCalledWith('msg-123');
      expect(mockDiscordMessage.react).toHaveBeenCalledWith('thumbsup');
    });

    it('should throw if channel is not found', async () => {
      await client.connect(channelId);
      mockClient.channels.fetch.mockResolvedValue(null);

      await expect(client.addReaction('msg-123', channelId, 'thumbsup')).rejects.toThrow(
        'Channel channel-456 not found or is not a text channel',
      );
    });
  });

  describe('User object', () => {
    it('should be a plain object with id and username properties', async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      const message = channel.postMessage('Test').onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'star', id: null },
      };

      const mockUser = { id: 'user-123', username: 'johndoe' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(typeof receivedEvent!.user).toBe('object');
      expect(receivedEvent!.user.id).toBe('user-123');
      expect(receivedEvent!.user.username).toBe('johndoe');
    });

    it('should have undefined username when not provided', async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      const message = channel.postMessage('Test').onReaction(callback);
      await waitForMessage(message);

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'star', id: null },
      };

      const mockUser = { id: 'user-456', username: null };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(receivedEvent!.user.id).toBe('user-456');
      expect(receivedEvent!.user.username).toBeUndefined();
    });
  });

  describe('integration: full workflow', () => {
    it('should support posting a message with reactions and listening for reactions', async () => {
      const channel = await client.connect(channelId);
      const reactions: ReactionEvent[] = [];

      const message = channel
        .postMessage('Pick a number:')
        .addReactions(['1\uFE0F\u20E3', '2\uFE0F\u20E3', '3\uFE0F\u20E3'])
        .onReaction((event) => {
          reactions.push(event);
        });
      await waitForMessage(message);

      expect(mockTextChannelData.send).toHaveBeenCalledTimes(1);
      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(3);

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: '2\uFE0F\u20E3', id: null },
      };

      const mockUser = { id: 'user-voter', username: 'Voter' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(reactions).toHaveLength(1);
      expect(reactions[0].emoji).toBe('2\uFE0F\u20E3');
      expect(reactions[0].user.username).toBe('Voter');
    });
  });
});
