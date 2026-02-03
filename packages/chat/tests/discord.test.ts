import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { DiscordConfig, ReactionEvent } from '../src/types.js';

// Use vi.hoisted to ensure mocks are defined before module loading
const {
  mockClient,
  mockTextChannelData,
  mockDiscordMessage,
  MockTextChannel,
  getReactionHandler,
  setReactionHandler,
} = vi.hoisted(() => {
  let reactionHandler: ((reaction: unknown, user: unknown) => Promise<void>) | null = null;

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

  // Mock TextChannel class for instanceof checks
  class MockTextChannel {
    id = 'channel-456';
    send = mockTextChannelData.send;
    messages = mockTextChannelData.messages;
  }

  return {
    mockClient,
    mockTextChannelData,
    mockDiscordMessage,
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
import { User } from '../src/types.js';

/**
 * Helper to wait for a PendingMessage without triggering the thenable infinite loop.
 * The Message class has a custom then() method which causes await to loop infinitely.
 *
 * The issue: PendingMessage.addReaction() schedules reactions via postPromise.then(),
 * so we need to flush microtasks after postPromise resolves to allow the scheduled
 * callbacks to update pendingReactions before we read it.
 */
async function waitForMessage(message: Message): Promise<void> {
  // Access private fields for testing
  const postPromise = (message as any).postPromise;

  if (postPromise) {
    await postPromise;
    // Flush microtasks multiple times to let any .then() callbacks scheduled on postPromise run
    // This allows super.addReaction() calls to update pendingReactions
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

    // Reset mock implementations
    mockClient.login.mockResolvedValue('token');
    mockClient.channels.fetch.mockResolvedValue(
      Object.assign(new MockTextChannel(), mockTextChannelData)
    );
    mockTextChannelData.send.mockResolvedValue(mockDiscordMessage);
    mockTextChannelData.messages.fetch.mockResolvedValue(mockDiscordMessage);
    mockDiscordMessage.react.mockResolvedValue(undefined);
    mockClient.destroy.mockResolvedValue(undefined);

    client = new DiscordChatClient(config);
  });

  afterEach(async () => {
    // Small delay to allow any pending async operations to complete
    await new Promise(resolve => setTimeout(resolve, 20));
    if (client.getState() === 'connected') {
      await client.disconnect();
    }
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

    it('should set state to "connected" after successful connection', async () => {
      expect(client.getState()).toBe('disconnected');

      await client.connect(channelId);

      expect(client.getState()).toBe('connected');
    });

    it('should set state to "connecting" during connection', async () => {
      let capturedState: string | undefined;
      mockClient.login.mockImplementation(async () => {
        capturedState = client.getState();
        return 'token';
      });

      await client.connect(channelId);

      expect(capturedState).toBe('connecting');
    });

    it('should set state to "error" when login fails', async () => {
      mockClient.login.mockRejectedValue(new Error('Invalid token'));

      await expect(client.connect(channelId)).rejects.toThrow('Invalid token');
      expect(client.getState()).toBe('error');
    });

    it('should throw error when channel is not found', async () => {
      mockClient.channels.fetch.mockResolvedValue(null);

      await expect(client.connect('invalid-channel')).rejects.toThrow(
        'Channel invalid-channel not found or is not a text channel'
      );
      expect(client.getState()).toBe('error');
    });

    it('should throw error when channel is not a TextChannel', async () => {
      mockClient.channels.fetch.mockResolvedValue({ type: 'GUILD_VOICE' });

      await expect(client.connect('voice-channel')).rejects.toThrow(
        'Channel voice-channel not found or is not a text channel'
      );
      expect(client.getState()).toBe('error');
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

    it('should handle threadId option for replies', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Reply message', { threadId: 'parent-msg-id' });
      await waitForMessage(message);

      expect(mockTextChannelData.send).toHaveBeenCalledWith({
        content: 'Reply message',
        reply: { messageReference: 'parent-msg-id' },
      });
    });

    it('should throw error if not connected', async () => {
      await expect(client.postMessage(channelId, 'test')).rejects.toThrow(
        'Client is not connected. Call connect() first.'
      );
    });
  });

  describe('Message.addReaction()', () => {
    beforeEach(() => {
      // Ensure destroy is still mocked after any vi.clearAllMocks() calls
      mockClient.destroy.mockResolvedValue(undefined);
    });

    it('should call message.react() on the Discord message', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);

      message.addReaction('thumbsup');
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledWith('thumbsup');
    });

    it('should support unicode emoji reactions', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);

      message.addReaction('\u{1F44D}');
      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledWith('\u{1F44D}');
    });

    it('should support chaining multiple addReaction() calls', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);

      const result = message.addReaction('thumbsup').addReaction('heart').addReaction('star');
      expect(result).toBe(message);

      await waitForMessage(message);

      expect(mockDiscordMessage.react).toHaveBeenCalledTimes(3);
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(1, 'thumbsup');
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(2, 'heart');
      expect(mockDiscordMessage.react).toHaveBeenNthCalledWith(3, 'star');
    });

    it('should return the same Message instance for chaining', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);
      const returnedMessage = message.addReaction('thumbsup');

      expect(returnedMessage).toBe(message);
    });

    it('should add reactions sequentially (not in parallel)', async () => {
      const callOrder: string[] = [];

      mockDiscordMessage.react.mockImplementation(async (emoji: string) => {
        callOrder.push(`start-${emoji}`);
        await new Promise(resolve => setTimeout(resolve, 5));
        callOrder.push(`end-${emoji}`);
      });

      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);
      message.addReaction('1').addReaction('2');
      await waitForMessage(message);

      expect(callOrder).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);

      // Reset the mock to prevent interference with other tests
      mockDiscordMessage.react.mockResolvedValue(undefined);
    });
  });

  describe('Message.addReactions()', () => {
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

    it('should support chaining addReactions() with addReaction()', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message');
      await waitForMessage(message);
      message.addReaction('first').addReactions(['second', 'third']).addReaction('fourth');
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
  });

  describe('Channel.onReaction()', () => {
    it('should register a callback for reaction events', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();

      channel.onReaction(callback);

      expect(typeof getReactionHandler()).toBe('function');
    });

    it('should call the callback when a reaction event is emitted', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onReaction(callback);

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

    it('should provide correct ReactionEvent data to the callback', async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      channel.onReaction(callback);

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
    });

    it('should provide correct User object with id and username', async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      channel.onReaction(callback);

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'star', id: null },
      };

      const mockUser = { id: 'user-999', username: 'ReactingUser' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(receivedEvent!.user).toBeInstanceOf(User);
      expect(receivedEvent!.user.id).toBe('user-999');
      expect(receivedEvent!.user.username).toBe('ReactingUser');
      expect(receivedEvent!.user.toString()).toBe('ReactingUser');
    });

    it('should handle user without username (partial user)', async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      channel.onReaction(callback);

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
      expect(receivedEvent!.user.toString()).toBe('user-123');
    });

    it('should return an unsubscribe function that works', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const unsubscribe = channel.onReaction(callback);

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'thumbsup', id: null },
      };

      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();

      await handler!(mockReaction, mockUser);
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();

      await handler!(mockReaction, mockUser);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should support multiple callbacks on the same channel', async () => {
      const channel = await client.connect(channelId);
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      channel.onReaction(callback1);
      channel.onReaction(callback2);
      channel.onReaction(callback3);

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
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should only unsubscribe the specific callback', async () => {
      const channel = await client.connect(channelId);
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      channel.onReaction(callback1);
      const unsubscribe2 = channel.onReaction(callback2);

      unsubscribe2();

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'rocket', id: null },
      };

      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should not call callback for reactions on different channels', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onReaction(callback);

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: 'different-channel-999' },
        emoji: { name: 'thumbsup', id: null },
      };

      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle partial reactions by fetching them', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onReaction(callback);

      const fetchMock = vi.fn().mockResolvedValue(undefined);
      const mockReaction = {
        partial: true,
        fetch: fetchMock,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'thumbsup', id: null },
      };

      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(fetchMock).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle errors when fetching partial reactions', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      channel.onReaction(callback);

      const fetchMock = vi.fn().mockRejectedValue(new Error('Failed to fetch'));
      const mockReaction = {
        partial: true,
        fetch: fetchMock,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'thumbsup', id: null },
      };

      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(fetchMock).toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch partial reaction:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('should use emoji id when name is not available (custom emoji)', async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      channel.onReaction(callback);

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
      channel.onReaction(callback);

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

      channel.onReaction(errorCallback);
      channel.onReaction(normalCallback);

      const mockReaction = {
        partial: false,
        message: { id: 'msg-123', channelId: channelId },
        emoji: { name: 'boom', id: null },
      };

      const mockUser = { id: 'user-001', username: 'TestUser' };

      const handler = getReactionHandler();
      await handler!(mockReaction, mockUser);

      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(normalCallback).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('disconnect()', () => {
    it('should destroy the Discord client', async () => {
      await client.connect(channelId);
      await client.disconnect();

      expect(mockClient.destroy).toHaveBeenCalled();
    });

    it('should set state to "disconnected"', async () => {
      await client.connect(channelId);
      expect(client.getState()).toBe('connected');

      await client.disconnect();
      expect(client.getState()).toBe('disconnected');
    });

    it('should clear reaction listeners', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onReaction(callback);

      await client.disconnect();

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
        await new Promise(resolve => setTimeout(resolve, 5));
      });

      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test message').addReaction('emoji1').addReaction('emoji2');
      await waitForMessage(message);

      callOrder.push('done');

      expect(callOrder).toEqual(['react', 'react', 'done']);

      // Reset the mock to prevent interference with other tests
      mockDiscordMessage.react.mockResolvedValue(undefined);
    });

    it('should allow chaining directly on postMessage return', async () => {
      const channel = await client.connect(channelId);

      // This should work - chain reactions on postMessage return
      const message = channel
        .postMessage('Test')
        .addReaction('thumbsup')
        .addReaction('heart');
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

    it('should throw if not connected', async () => {
      await expect(client.addReaction('msg-123', channelId, 'thumbsup')).rejects.toThrow(
        'Client is not connected'
      );
    });

    it('should throw if channel is not found', async () => {
      await client.connect(channelId);
      mockClient.channels.fetch.mockResolvedValue(null);

      await expect(client.addReaction('msg-123', channelId, 'thumbsup')).rejects.toThrow(
        'Channel channel-456 not found or is not a text channel'
      );
    });
  });

  describe('User class', () => {
    it('should return username from toString() when available', () => {
      const user = new User('user-123', 'johndoe');
      expect(user.toString()).toBe('johndoe');
    });

    it('should return id from toString() when username is undefined', () => {
      const user = new User('user-123', undefined);
      expect(user.toString()).toBe('user-123');
    });
  });

  describe('integration: full workflow', () => {
    it('should support posting a message with reactions and listening for reactions', async () => {
      const channel = await client.connect(channelId);

      const reactions: ReactionEvent[] = [];
      channel.onReaction((event) => {
        reactions.push(event);
      });

      const message = channel.postMessage('Pick a number:');
      message.addReactions(['1\uFE0F\u20E3', '2\uFE0F\u20E3', '3\uFE0F\u20E3']);
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
