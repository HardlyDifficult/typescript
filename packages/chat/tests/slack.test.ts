import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { SlackConfig, ReactionEvent } from '../src/types.js';

// Define mocks at module level - Vitest hoists vi.mock() calls automatically
// Use vi.hoisted() to ensure mocks are available before mock setup
const {
  mockPostMessage,
  mockReactionsAdd,
  mockStart,
  mockStop,
  mockEvent,
  mockApp,
  getReactionHandler,
  setReactionHandler,
} = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let reactionAddedHandler: ((args: { event: any }) => Promise<void>) | null = null;

  const mockPostMessage = vi.fn();
  const mockReactionsAdd = vi.fn();
  const mockStart = vi.fn();
  const mockStop = vi.fn();
  const mockEvent = vi.fn();

  const mockApp = {
    start: mockStart,
    stop: mockStop,
    event: mockEvent,
    client: {
      chat: {
        postMessage: mockPostMessage,
      },
      reactions: {
        add: mockReactionsAdd,
      },
    },
  };

  const getReactionHandler = () => reactionAddedHandler;
  const setReactionHandler = (handler: typeof reactionAddedHandler) => {
    reactionAddedHandler = handler;
  };

  return {
    mockPostMessage,
    mockReactionsAdd,
    mockStart,
    mockStop,
    mockEvent,
    mockApp,
    getReactionHandler,
    setReactionHandler,
  };
});

// Mock @slack/bolt
vi.mock('@slack/bolt', () => ({
  App: vi.fn().mockImplementation(() => mockApp),
}));

// Import after mocking
import { SlackChatClient } from '../src/slack/SlackChatClient.js';
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

describe('SlackChatClient', () => {
  let client: SlackChatClient;
  const config: SlackConfig = {
    type: 'slack',
    token: 'xoxb-test-token',
    appToken: 'xapp-test-app-token',
    socketMode: true,
  };
  const channelId = 'C1234567890';

  beforeEach(() => {
    vi.clearAllMocks();
    setReactionHandler(null);

    // Clear environment variables
    delete process.env.SLACK_TOKEN;
    delete process.env.SLACK_APP_TOKEN;

    // Reset mock implementations
    mockStart.mockResolvedValue(undefined);
    mockStop.mockResolvedValue(undefined);
    mockPostMessage.mockResolvedValue({ ts: '1234567890.123456' });
    mockReactionsAdd.mockResolvedValue({ ok: true });
    mockEvent.mockImplementation((eventName: string, handler: any) => {
      if (eventName === 'reaction_added') {
        setReactionHandler(handler);
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

  describe('constructor', () => {
    it('should create an App instance with the provided config', async () => {
      const { App } = await import('@slack/bolt');
      expect(App).toHaveBeenCalledWith({
        token: config.token,
        appToken: config.appToken,
        socketMode: true,
      });
    });

    it('should register a reaction_added event handler', () => {
      expect(mockEvent).toHaveBeenCalledWith('reaction_added', expect.any(Function));
      expect(getReactionHandler()).not.toBeNull();
    });

    it('should default socketMode to true when not specified', async () => {
      const configWithoutSocketMode: SlackConfig = {
        type: 'slack',
        token: 'xoxb-test-token',
        appToken: 'xapp-test-app-token',
      };
      const { App } = await import('@slack/bolt');
      vi.mocked(App).mockClear();

      new SlackChatClient(configWithoutSocketMode);

      expect(App).toHaveBeenCalledWith({
        token: configWithoutSocketMode.token,
        appToken: configWithoutSocketMode.appToken,
        socketMode: true,
      });
    });
  });

  describe('config', () => {
    it('should use explicit config values', async () => {
      const { App } = await import('@slack/bolt');
      vi.mocked(App).mockClear();

      const explicitConfig: SlackConfig = {
        type: 'slack',
        token: 'explicit-token',
        appToken: 'explicit-app-token',
        socketMode: true,
      };

      new SlackChatClient(explicitConfig);

      expect(App).toHaveBeenCalledWith({
        token: 'explicit-token',
        appToken: 'explicit-app-token',
        socketMode: true,
      });
    });

    it('should use environment variables as defaults', async () => {
      process.env.SLACK_TOKEN = 'env-token';
      process.env.SLACK_APP_TOKEN = 'env-app-token';

      const { App } = await import('@slack/bolt');
      vi.mocked(App).mockClear();

      const envConfig: SlackConfig = {
        type: 'slack',
        token: process.env.SLACK_TOKEN,
        appToken: process.env.SLACK_APP_TOKEN,
      };

      new SlackChatClient(envConfig);

      expect(App).toHaveBeenCalledWith({
        token: 'env-token',
        appToken: 'env-app-token',
        socketMode: true,
      });
    });

    it('should allow explicit config to override environment variables', async () => {
      process.env.SLACK_TOKEN = 'env-token';
      process.env.SLACK_APP_TOKEN = 'env-app-token';

      const { App } = await import('@slack/bolt');
      vi.mocked(App).mockClear();

      const overrideConfig: SlackConfig = {
        type: 'slack',
        token: 'override-token',
        appToken: 'override-app-token',
      };

      new SlackChatClient(overrideConfig);

      expect(App).toHaveBeenCalledWith({
        token: 'override-token',
        appToken: 'override-app-token',
        socketMode: true,
      });
    });
  });

  describe('connect()', () => {
    it('should start the app', async () => {
      await client.connect(channelId);

      expect(mockStart).toHaveBeenCalledTimes(1);
    });

    it('should return a Channel object', async () => {
      const channel = await client.connect(channelId);

      expect(channel).toBeInstanceOf(Channel);
      expect(channel.id).toBe(channelId);
      expect(channel.platform).toBe('slack');
    });

    it('should throw error if connection fails', async () => {
      const error = new Error('Connection failed');
      mockStart.mockRejectedValue(error);

      await expect(client.connect(channelId)).rejects.toThrow('Connection failed');
    });
  });

  describe('disconnect()', () => {
    it('should stop the app', async () => {
      await client.connect(channelId);

      await client.disconnect();

      expect(mockStop).toHaveBeenCalledTimes(1);
    });

    it('should clear reaction callbacks', async () => {
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
            reaction: 'thumbsup',
            user: 'U123456',
            item: { channel: channelId, ts: '1234567890.123456' },
            event_ts: '1234567890.123456',
          },
        });
      }

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Channel.postMessage()', () => {
    it('should call app.client.chat.postMessage()', async () => {
      const channel = await client.connect(channelId);
      const text = 'Hello, world!';

      const message = channel.postMessage(text);
      await waitForMessage(message);

      expect(mockPostMessage).toHaveBeenCalledWith({
        channel: channelId,
        text: text,
      });
    });

    it('should return a Message object with ts as id', async () => {
      const expectedTs = '1234567890.123456';
      mockPostMessage.mockResolvedValue({ ts: expectedTs });

      const channel = await client.connect(channelId);
      const message = channel.postMessage('Hello!');
      await waitForMessage(message);

      expect(message).toBeInstanceOf(Message);
      expect(message.id).toBe(expectedTs);
      expect(message.channelId).toBe(channelId);
      expect(message.platform).toBe('slack');
    });
  });

  describe('Message.addReactions()', () => {
    it('should call app.client.reactions.add()', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test');
      await waitForMessage(message);

      message.addReactions(['thumbsup']);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledWith({
        channel: channelId,
        timestamp: message.id,
        name: 'thumbsup',
      });
    });

    it('should strip leading colons from emoji names', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test');
      await waitForMessage(message);

      message.addReactions([':thumbsup']);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledWith({
        channel: channelId,
        timestamp: message.id,
        name: 'thumbsup',
      });
    });

    it('should strip trailing colons from emoji names', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test');
      await waitForMessage(message);

      message.addReactions(['thumbsup:']);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledWith({
        channel: channelId,
        timestamp: message.id,
        name: 'thumbsup',
      });
    });

    it('should strip both leading and trailing colons from emoji names', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test');
      await waitForMessage(message);

      message.addReactions([':thumbsup:']);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledWith({
        channel: channelId,
        timestamp: message.id,
        name: 'thumbsup',
      });
    });

    it('should call app.client.reactions.add() for each emoji', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test');
      await waitForMessage(message);

      message.addReactions(['thumbsup', 'heart', 'rocket']);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledTimes(3);
    });

    it('should support arrays of emojis', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test');
      await waitForMessage(message);
      const emojis = ['one', 'two', 'three', 'four', 'five'];

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

    it('should support chaining multiple addReactions() calls', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test');
      await waitForMessage(message);

      const result = message.addReactions(['thumbsup', 'heart']).addReactions(['rocket']);

      expect(result).toBe(message);

      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenCalledTimes(3);
    });

    it('should strip colons from all emojis in the array', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test');
      await waitForMessage(message);

      message.addReactions([':thumbsup:', ':heart:', ':rocket:']);
      await waitForMessage(message);

      expect(mockReactionsAdd).toHaveBeenNthCalledWith(1, {
        channel: channelId,
        timestamp: message.id,
        name: 'thumbsup',
      });
      expect(mockReactionsAdd).toHaveBeenNthCalledWith(2, {
        channel: channelId,
        timestamp: message.id,
        name: 'heart',
      });
      expect(mockReactionsAdd).toHaveBeenNthCalledWith(3, {
        channel: channelId,
        timestamp: message.id,
        name: 'rocket',
      });
    });

    it('should handle empty array', async () => {
      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test');
      await waitForMessage(message);

      message.addReactions([]);
      await waitForMessage(message);

      expect(mockReactionsAdd).not.toHaveBeenCalled();
    });

    it('should allow chaining addReactions right after postMessage', async () => {
      const channel = await client.connect(channelId);

      const message = channel.postMessage('Test').addReactions(['thumbsup']);
      await waitForMessage(message);

      expect(message).toBeInstanceOf(Message);
      expect(mockReactionsAdd).toHaveBeenCalledTimes(1);
    });

    it('should add reactions sequentially (not in parallel)', async () => {
      const callOrder: string[] = [];

      mockReactionsAdd.mockImplementation(async ({ name }: { name: string }) => {
        callOrder.push(`start-${name}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
        callOrder.push(`end-${name}`);
        return { ok: true };
      });

      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test');
      await waitForMessage(message);
      message.addReactions(['1', '2']);
      await waitForMessage(message);

      // Reactions should be sequential: start-1, end-1, start-2, end-2
      expect(callOrder).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
    });
  });

  describe('Channel.onReaction()', () => {
    it('should register callbacks', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();

      channel.onReaction(callback);

      // Verify callback is registered by checking handler exists
      expect(getReactionHandler()).not.toBeNull();
    });

    it('should call callback when reaction_added event is emitted', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onReaction(callback);

      // Simulate a reaction_added event
      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'thumbsup',
          user: 'U123456',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should provide correct User object with id', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onReaction(callback);

      const userId = 'U987654321';
      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'heart',
          user: userId,
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ id: userId }),
        }),
      );

      const callArg = callback.mock.calls[0][0] as ReactionEvent;
      expect(callArg.user.id).toBe(userId);
      expect(callArg.user.username).toBeUndefined();
    });

    it('should provide correct emoji in the event', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onReaction(callback);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'rocket',
          user: 'U123456',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      const callArg = callback.mock.calls[0][0] as ReactionEvent;
      expect(callArg.emoji).toBe('rocket');
    });

    it('should provide correct messageId in the event', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onReaction(callback);

      const messageTs = '9999999999.999999';
      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'thumbsup',
          user: 'U123456',
          item: { channel: channelId, ts: messageTs },
          event_ts: '1609459200.000000',
        },
      });

      const callArg = callback.mock.calls[0][0] as ReactionEvent;
      expect(callArg.messageId).toBe(messageTs);
    });

    it('should provide correct channelId in the event', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onReaction(callback);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'thumbsup',
          user: 'U123456',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      const callArg = callback.mock.calls[0][0] as ReactionEvent;
      expect(callArg.channelId).toBe(channelId);
    });

    it('should provide correct timestamp in the event', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onReaction(callback);

      const eventTs = '1609459200.123456';
      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'thumbsup',
          user: 'U123456',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: eventTs,
        },
      });

      const callArg = callback.mock.calls[0][0] as ReactionEvent;
      expect(callArg.timestamp).toEqual(new Date(parseFloat(eventTs) * 1000));
    });

    it('should return unsubscribe function that works', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      const unsubscribe = channel.onReaction(callback);

      const handler = getReactionHandler();

      // First event should trigger callback
      await handler!({
        event: {
          reaction: 'thumbsup',
          user: 'U123456',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Second event should NOT trigger callback
      await handler!({
        event: {
          reaction: 'heart',
          user: 'U123456',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      expect(callback).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should support multiple callbacks', async () => {
      const channel = await client.connect(channelId);
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      channel.onReaction(callback1);
      channel.onReaction(callback2);
      channel.onReaction(callback3);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'thumbsup',
          user: 'U123456',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('should only unsubscribe the specific callback', async () => {
      const channel = await client.connect(channelId);
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      const unsubscribe1 = channel.onReaction(callback1);
      channel.onReaction(callback2);

      // Unsubscribe only callback1
      unsubscribe1();

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'thumbsup',
          user: 'U123456',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should not call callbacks for different channels', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onReaction(callback);

      // Event for a different channel
      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'thumbsup',
          user: 'U123456',
          item: { channel: 'C_DIFFERENT_CHANNEL', ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle async callbacks', async () => {
      const channel = await client.connect(channelId);
      const results: number[] = [];

      const asyncCallback = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        results.push(1);
      });

      channel.onReaction(asyncCallback);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'thumbsup',
          user: 'U123456',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      expect(asyncCallback).toHaveBeenCalledTimes(1);
      expect(results).toContain(1);
    });

    it('should handle callback errors gracefully', async () => {
      const channel = await client.connect(channelId);
      // Use an async callback that rejects - the implementation catches rejected promises
      // (Note: sync throws are caught inside Promise.resolve() but propagate during map)
      const errorCallback = vi.fn().mockImplementation(async () => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();

      // Spy on console.error to verify it's called
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      channel.onReaction(errorCallback);
      channel.onReaction(normalCallback);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'thumbsup',
          user: 'U123456',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      // Both callbacks should have been called
      expect(errorCallback).toHaveBeenCalledTimes(1);
      expect(normalCallback).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Channel.disconnect()', () => {
    it('should clear reaction callbacks when channel is disconnected', async () => {
      const channel = await client.connect(channelId);
      const callback = vi.fn();
      channel.onReaction(callback);

      // Disconnect the channel
      channel.disconnect();

      // The channel's callbacks are cleared
      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'thumbsup',
          user: 'U123456',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      // Callback should not be called
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('subscribeToReactions()', () => {
    it('should add callback to reaction callbacks map', async () => {
      await client.connect(channelId);
      const callback = vi.fn();

      client.subscribeToReactions(channelId, callback);

      // Trigger event to verify callback was registered
      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'thumbsup',
          user: 'U123456',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should return unsubscribe function', async () => {
      await client.connect(channelId);
      const callback = vi.fn();

      const unsubscribe = client.subscribeToReactions(channelId, callback);
      unsubscribe();

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'thumbsup',
          user: 'U123456',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should support multiple subscriptions to different channels', async () => {
      await client.connect(channelId);
      const channel1Id = 'C1111111111';
      const channel2Id = 'C2222222222';
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      client.subscribeToReactions(channel1Id, callback1);
      client.subscribeToReactions(channel2Id, callback2);

      const handler = getReactionHandler();

      // Event for channel1
      await handler!({
        event: {
          reaction: 'thumbsup',
          user: 'U123456',
          item: { channel: channel1Id, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();

      // Event for channel2
      await handler!({
        event: {
          reaction: 'heart',
          user: 'U123456',
          item: { channel: channel2Id, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });
  });

  describe('addReaction()', () => {
    it('should work when connected', async () => {
      await client.connect(channelId);

      await client.addReaction('1234567890.123456', channelId, 'thumbsup');

      expect(mockReactionsAdd).toHaveBeenCalledWith({
        channel: channelId,
        timestamp: '1234567890.123456',
        name: 'thumbsup',
      });
    });
  });

  describe('User object', () => {
    it('should be a plain object with id property', async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      channel.onReaction(callback);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'star',
          user: 'U123456',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      expect(typeof receivedEvent!.user).toBe('object');
      expect(receivedEvent!.user.id).toBe('U123456');
    });

    it('should have undefined username (Slack does not provide username in reaction events)', async () => {
      const channel = await client.connect(channelId);
      let receivedEvent: ReactionEvent | null = null;
      const callback = vi.fn().mockImplementation((event: ReactionEvent) => {
        receivedEvent = event;
      });
      channel.onReaction(callback);

      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'star',
          user: 'U654321',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      expect(receivedEvent!.user.id).toBe('U654321');
      expect(receivedEvent!.user.username).toBeUndefined();
    });
  });

  describe('Message awaiting behavior', () => {
    it('should await message post completion', async () => {
      let postResolved = false;
      mockPostMessage.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        postResolved = true;
        return { ts: '1234567890.123456' };
      });

      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test');
      await waitForMessage(message);

      expect(postResolved).toBe(true);
      expect(message.id).toBe('1234567890.123456');
    });

    it('should await all reactions after chaining', async () => {
      const reactionOrder: string[] = [];
      mockReactionsAdd.mockImplementation(async ({ name }: { name: string }) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        reactionOrder.push(name);
        return { ok: true };
      });

      const channel = await client.connect(channelId);
      const message = channel.postMessage('Test');
      await waitForMessage(message);

      message.addReactions(['first', 'second', 'third']);
      await waitForMessage(message);

      expect(reactionOrder).toEqual(['first', 'second', 'third']);
    });

    it('should allow chaining directly on postMessage return', async () => {
      const channel = await client.connect(channelId);

      // This should work - chain reactions on postMessage return
      const message = channel.postMessage('Test').addReactions(['thumbsup', 'heart']);
      await waitForMessage(message);

      expect(message.id).toBe('1234567890.123456');
      expect(mockReactionsAdd).toHaveBeenCalledTimes(2);
    });
  });

  describe('integration: full workflow', () => {
    it('should support posting a message with reactions and listening for reactions', async () => {
      const channel = await client.connect(channelId);

      // Set up reaction listener
      const reactions: ReactionEvent[] = [];
      channel.onReaction((event) => {
        reactions.push(event);
      });

      // Post a message with reactions
      const message = channel.postMessage('Pick a number:');
      message.addReactions(['one', 'two', 'three']);
      await waitForMessage(message);

      expect(mockPostMessage).toHaveBeenCalledTimes(1);
      expect(mockReactionsAdd).toHaveBeenCalledTimes(3);

      // Simulate a user reacting
      const handler = getReactionHandler();
      await handler!({
        event: {
          reaction: 'two',
          user: 'U_VOTER',
          item: { channel: channelId, ts: '1234567890.123456' },
          event_ts: '1609459200.000000',
        },
      });

      expect(reactions).toHaveLength(1);
      expect(reactions[0].emoji).toBe('two');
      expect(reactions[0].user.id).toBe('U_VOTER');
    });
  });
});
