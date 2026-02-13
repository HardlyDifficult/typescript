import { Message, type MessageOperations } from "./Message";
import { Thread } from "./Thread";
import type {
  DisconnectCallback,
  ErrorCallback,
  FileAttachment,
  Member,
  MessageCallback,
  MessageContent,
  MessageData,
  MessageEvent,
  Platform,
  ReactionCallback,
  ThreadData,
} from "./types";

/**
 * Interface for platform-specific channel operations
 */
export interface ChannelOperations {
  postMessage(
    channelId: string,
    content: MessageContent,
    options?: {
      threadTs?: string;
      files?: FileAttachment[];
      linkPreviews?: boolean;
    }
  ): Promise<MessageData>;
  updateMessage(
    messageId: string,
    channelId: string,
    content: MessageContent
  ): Promise<void>;
  deleteMessage(messageId: string, channelId: string): Promise<void>;
  addReaction(
    messageId: string,
    channelId: string,
    emoji: string
  ): Promise<void>;
  removeReaction(
    messageId: string,
    channelId: string,
    emoji: string
  ): Promise<void>;
  removeAllReactions(messageId: string, channelId: string): Promise<void>;
  subscribeToReactions(
    channelId: string,
    callback: ReactionCallback
  ): () => void;
  subscribeToMessages(channelId: string, callback: MessageCallback): () => void;
  sendTyping(channelId: string): Promise<void>;
  startThread(
    messageId: string,
    channelId: string,
    name: string,
    autoArchiveDuration?: number
  ): Promise<ThreadData>;
  bulkDelete(channelId: string, count: number): Promise<number>;
  getThreads(channelId: string): Promise<ThreadData[]>;
  deleteThread(threadId: string, channelId: string): Promise<void>;
  getMembers(channelId: string): Promise<Member[]>;
  onDisconnect(callback: DisconnectCallback): () => void;
  onError(callback: ErrorCallback): () => void;
}

/**
 * Represents a connected channel with messaging capabilities
 */
/** Default interval (ms) for refreshing the typing indicator. Discord expires after ~10s. */
const TYPING_REFRESH_MS = 8000;

export class Channel {
  public readonly id: string;
  public readonly platform: Platform;

  private operations: ChannelOperations;
  private messageReactionCallbacks = new Map<string, Set<ReactionCallback>>();
  private unsubscribeFromPlatform: (() => void) | null = null;
  private typingRefCount = 0;
  private typingInterval: ReturnType<typeof setInterval> | null = null;

  constructor(id: string, platform: Platform, operations: ChannelOperations) {
    this.id = id;
    this.platform = platform;
    this.operations = operations;

    // Subscribe to platform reactions and forward to message-specific callbacks
    this.unsubscribeFromPlatform = this.operations.subscribeToReactions(
      id,
      (event) => this.emitReaction(event)
    );
  }

  /**
   * Post a message to this channel
   * @param content - Message content (string or Document)
   * @param options - Optional message options (e.g., files for attachments)
   * @returns Message object with chainable reaction methods
   */
  postMessage(
    content: MessageContent,
    options?: { files?: FileAttachment[]; linkPreviews?: boolean }
  ): Message & PromiseLike<Message> {
    const messagePromise = this.operations.postMessage(
      this.id,
      content,
      options
    );

    // Create a Message that will resolve once the post completes
    return new PendingMessage(
      messagePromise,
      this.createMessageOperations(),
      this.platform
    );
  }

  /**
   * Emit a reaction event to registered message-specific callbacks
   */
  private async emitReaction(
    event: Parameters<ReactionCallback>[0]
  ): Promise<void> {
    const callbacks = this.messageReactionCallbacks.get(event.messageId);
    if (!callbacks) {
      return;
    }
    const promises = Array.from(callbacks).map((cb) =>
      Promise.resolve(cb(event)).catch((err: unknown) => {
        console.error("Reaction callback error:", err);
      })
    );
    await Promise.all(promises);
  }

  /**
   * Subscribe to reactions for a specific message
   * @internal Used by Message.onReaction
   */
  private subscribeToMessageReactions(
    messageId: string,
    callback: ReactionCallback
  ): () => void {
    let callbacks = this.messageReactionCallbacks.get(messageId);
    if (!callbacks) {
      callbacks = new Set();
      this.messageReactionCallbacks.set(messageId, callbacks);
    }
    callbacks.add(callback);

    return () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        this.messageReactionCallbacks.delete(messageId);
      }
    };
  }

  /**
   * Create MessageOperations from ChannelOperations
   */
  private createMessageOperations(): MessageOperations {
    return {
      addReaction: (messageId: string, channelId: string, emoji: string) =>
        this.operations.addReaction(messageId, channelId, emoji),
      removeReaction: (messageId: string, channelId: string, emoji: string) =>
        this.operations.removeReaction(messageId, channelId, emoji),
      removeAllReactions: (messageId: string, channelId: string) =>
        this.operations.removeAllReactions(messageId, channelId),
      updateMessage: (
        messageId: string,
        channelId: string,
        content: MessageContent
      ) => this.operations.updateMessage(messageId, channelId, content),
      deleteMessage: (messageId: string, channelId: string) =>
        this.operations.deleteMessage(messageId, channelId),
      reply: async (
        channelId: string,
        threadTs: string,
        content: MessageContent
      ) => this.operations.postMessage(channelId, content, { threadTs }),
      subscribeToReactions: (messageId: string, callback: ReactionCallback) =>
        this.subscribeToMessageReactions(messageId, callback),
      startThread: (
        messageId: string,
        channelId: string,
        name: string,
        autoArchiveDuration?: number
      ) =>
        this.operations.startThread(
          messageId,
          channelId,
          name,
          autoArchiveDuration
        ),
      deleteThread: (threadId: string, channelId: string) =>
        this.operations.deleteThread(threadId, channelId),
    };
  }

  /**
   * Subscribe to incoming messages in this channel
   * @param callback - Function called with a Message object for each incoming message
   * @returns Unsubscribe function
   */
  onMessage(callback: (message: Message) => void | Promise<void>): () => void {
    return this.operations.subscribeToMessages(
      this.id,
      (event: MessageEvent) => {
        const message = new Message(
          {
            id: event.id,
            channelId: event.channelId,
            platform: this.platform,
            content: event.content,
            author: event.author,
            timestamp: event.timestamp,
            attachments: event.attachments,
          },
          this.createMessageOperations()
        );
        return callback(message);
      }
    );
  }

  /**
   * Send a one-shot typing indicator in this channel.
   * Prefer beginTyping/endTyping for long-running work.
   */
  async sendTyping(): Promise<void> {
    await this.operations.sendTyping(this.id);
  }

  /**
   * Mark the start of work that should show a typing indicator.
   * The indicator is sent immediately and auto-refreshed until a matching
   * endTyping() call brings the count back to zero. Multiple callers
   * can overlap — the indicator stays active until the last one ends.
   */
  beginTyping(): void {
    this.typingRefCount++;
    if (this.typingRefCount === 1) {
      this.operations.sendTyping(this.id).catch(() => {});
      this.typingInterval = setInterval(() => {
        if (this.typingRefCount > 0) {
          this.operations.sendTyping(this.id).catch(() => {});
        }
      }, TYPING_REFRESH_MS);
    }
  }

  /**
   * Mark the end of one unit of work. When all outstanding beginTyping()
   * calls have been balanced by endTyping(), the refresh interval stops.
   */
  endTyping(): void {
    if (this.typingRefCount > 0) {
      this.typingRefCount--;
    }
    if (this.typingRefCount === 0 && this.typingInterval) {
      clearInterval(this.typingInterval);
      this.typingInterval = null;
    }
  }

  /**
   * Show a typing indicator while executing a function.
   * Uses the ref-counted beginTyping/endTyping internally, so multiple
   * concurrent withTyping calls share a single refresh interval.
   * @param fn - Async function to execute while typing indicator is shown
   * @returns The return value of fn
   */
  async withTyping<T>(fn: () => Promise<T>): Promise<T> {
    this.beginTyping();
    try {
      return await fn();
    } finally {
      this.endTyping();
    }
  }

  /**
   * Post a message with a trash can reaction that the owner can click to dismiss.
   * @param content - Message content (string or Document)
   * @param ownerId - User ID of the person allowed to dismiss the message
   * @returns Message object that callers can interact with before dismissal
   */
  async postDismissable(
    content: MessageContent,
    ownerId: string
  ): Promise<Message> {
    const emoji = this.platform === "slack" ? ":wastebasket:" : "🗑️";
    const emojiMatch = this.platform === "slack" ? "wastebasket" : "🗑️";
    const msg = await this.postMessage(content);
    msg.addReactions([emoji]).onReaction(async (event) => {
      if (event.user.id !== ownerId || event.emoji !== emojiMatch) {
        return;
      }
      msg.offReaction();
      await msg.delete();
    });
    return msg;
  }

  /**
   * Bulk delete messages in this channel
   * @param count - Number of recent messages to delete
   * @returns Number of messages actually deleted
   */
  async bulkDelete(count: number): Promise<number> {
    return this.operations.bulkDelete(this.id, count);
  }

  /**
   * Get all threads in this channel (active and archived)
   * @returns Array of threads with delete capability
   */
  async getThreads(): Promise<Thread[]> {
    const threadsData = await this.operations.getThreads(this.id);
    return threadsData.map(
      (data) =>
        new Thread(data, () =>
          this.operations.deleteThread(data.id, data.channelId)
        )
    );
  }

  /**
   * Get all members of this channel
   * @returns Array of members with mention strings
   */
  async getMembers(): Promise<Member[]> {
    return this.operations.getMembers(this.id);
  }

  /**
   * Disconnect from this channel (cleanup)
   */
  disconnect(): void {
    if (this.unsubscribeFromPlatform) {
      this.unsubscribeFromPlatform();
      this.unsubscribeFromPlatform = null;
    }
    this.messageReactionCallbacks.clear();
    if (this.typingInterval) {
      clearInterval(this.typingInterval);
      this.typingInterval = null;
    }
    this.typingRefCount = 0;
  }
}

/**
 * A Message that is still being posted.
 * Implements PromiseLike so it can be directly awaited:
 *   const msg = await channel.postMessage('Hello');
 *
 * Also supports synchronous chaining before awaiting:
 *   await channel.postMessage('Vote!').addReactions(['👍', '👎']).onReaction(cb);
 */
class PendingMessage extends Message implements PromiseLike<Message> {
  private postPromise: Promise<MessageData>;
  private deferredReactionCallbacks: ReactionCallback[] = [];
  private resolved = false;

  constructor(
    postPromise: Promise<MessageData>,
    operations: MessageOperations,
    platform: Platform
  ) {
    // Initialize with placeholder data using the correct platform
    super({ id: "", channelId: "", platform }, operations);
    this.postPromise = postPromise;

    // Update our data when the post resolves and subscribe any deferred listeners
    this.postPromise
      .then((data) => {
        // Update the readonly properties via Object.defineProperty
        Object.defineProperty(this, "id", { value: data.id });
        Object.defineProperty(this, "channelId", { value: data.channelId });
        Object.defineProperty(this, "platform", { value: data.platform });

        // Subscribe deferred reaction callbacks now that we have the message ID
        for (const callback of this.deferredReactionCallbacks) {
          const unsubscribe = this.operations.subscribeToReactions(
            data.id,
            callback
          );
          this.reactionUnsubscribers.push(unsubscribe);
        }
        this.resolved = true;
      })
      .catch(() => {
        // Errors surfaced when awaited via then()
      });
  }

  /**
   * Override addReactions to wait for post to complete first
   */
  override addReactions(emojis: string[]): this {
    // Chain after the post completes, capturing current pendingReactions
    const currentPendingReactions = this.pendingReactions;
    this.pendingReactions = this.postPromise.then(
      () => currentPendingReactions
    );
    for (const emoji of emojis) {
      this.pendingReactions = this.pendingReactions.then(() =>
        this.operations.addReaction(this.id, this.channelId, emoji)
      );
    }
    return this;
  }

  /**
   * Override removeReactions to wait for post to complete first
   */
  override removeReactions(emojis: string[]): this {
    const currentPendingReactions = this.pendingReactions;
    this.pendingReactions = this.postPromise.then(
      () => currentPendingReactions
    );
    for (const emoji of emojis) {
      this.pendingReactions = this.pendingReactions.then(() =>
        this.operations.removeReaction(this.id, this.channelId, emoji)
      );
    }
    return this;
  }

  /**
   * Override removeAllReactions to wait for post to complete first
   */
  override removeAllReactions(): this {
    const currentPendingReactions = this.pendingReactions;
    this.pendingReactions = this.postPromise.then(
      () => currentPendingReactions
    );
    this.pendingReactions = this.pendingReactions.then(() =>
      this.operations.removeAllReactions(this.id, this.channelId)
    );
    return this;
  }

  /**
   * Override onReaction to defer subscription until post completes
   */
  override onReaction(callback: ReactionCallback): this {
    if (this.resolved) {
      super.onReaction(callback);
    } else {
      this.deferredReactionCallbacks.push(callback);
    }
    return this;
  }

  /**
   * Override offReaction to also clear deferred callbacks
   */
  override offReaction(): void {
    this.deferredReactionCallbacks = [];
    super.offReaction();
  }

  /**
   * Makes PendingMessage directly awaitable.
   * Resolves to a plain Message (not thenable) to prevent infinite await loops.
   */
  then<TResult1 = Message, TResult2 = never>(
    onfulfilled?: ((value: Message) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    const resolved = this.postPromise.then(async () => {
      await this.pendingReactions;
      // Return a plain Message (no then()) to stop await from recursing
      return this.toSnapshot();
    });
    return resolved.then(onfulfilled, onrejected);
  }

  /**
   * Wait for post and all pending reactions to complete.
   */
  override async waitForReactions(): Promise<void> {
    await this.postPromise;
    await this.pendingReactions;
  }
}
