import { batchStore } from "./BatchStore";
import { extractMentionId, findBestMemberMatch } from "./memberMatching";
import { Message, type MessageOperations } from "./Message";
import { MessageBatch } from "./MessageBatch";
import { PendingMessage } from "./PendingMessage";
import { Thread, type ThreadOperations } from "./Thread";
import type {
  BatchQueryOptions,
  BeginBatchOptions,
  DeleteMessageOptions,
  DisconnectCallback,
  ErrorCallback,
  FileAttachment,
  Member,
  MessageCallback,
  MessageContent,
  MessageData,
  MessageEvent,
  MessageQueryOptions,
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
  deleteMessage(
    messageId: string,
    channelId: string,
    options?: DeleteMessageOptions
  ): Promise<void>;
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
  getMessages(
    channelId: string,
    options?: MessageQueryOptions
  ): Promise<MessageData[]>;
  getThreads(channelId: string): Promise<ThreadData[]>;
  deleteThread(threadId: string, channelId: string): Promise<void>;
  getMembers(channelId: string): Promise<Member[]>;
  onDisconnect(callback: DisconnectCallback): () => void;
  onError(callback: ErrorCallback): () => void;
  subscribeToThread(
    threadId: string,
    channelId: string,
    callback: MessageCallback
  ): () => void;
  postToThread(
    threadId: string,
    channelId: string,
    content: MessageContent,
    options?: { files?: FileAttachment[] }
  ): Promise<MessageData>;
}

/** Default interval (ms) for refreshing the typing indicator. Discord expires after ~10s. */
const TYPING_REFRESH_MS = 8000;

/** A platform-agnostic channel that provides messaging, reactions, typing indicators, and thread management. */
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
   * Create a thread: posts a root message, starts a thread on it,
   * and returns a Thread with post/onReply/delete capabilities.
   * @param content - Root message content (string or Document)
   * @param name - Thread name (used by Discord, ignored by Slack)
   * @param autoArchiveDuration - Auto-archive in minutes (Discord only: 60, 1440, 4320, 10080)
   * @returns Thread object
   */
  async createThread(
    content: MessageContent,
    name: string,
    autoArchiveDuration?: number
  ): Promise<Thread> {
    const rootMsg = await this.operations.postMessage(this.id, content);
    const threadData = await this.operations.startThread(
      rootMsg.id,
      this.id,
      name,
      autoArchiveDuration
    );
    return this.buildThread(threadData);
  }

  /**
   * Reconnect to an existing thread by ID.
   * Use when you have a thread ID from a previous createThread() or msg.startThread() call.
   * @param threadId - The thread ID (Discord: thread channel ID, Slack: parent message ts)
   * @returns Thread object with post/onReply/delete capabilities
   */
  openThread(threadId: string): Thread {
    return this.buildThread({
      id: threadId,
      channelId: this.id,
      platform: this.platform,
    });
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
      deleteMessage: (
        messageId: string,
        channelId: string,
        options?: DeleteMessageOptions
      ) => this.operations.deleteMessage(messageId, channelId, options),
      reply: async (
        channelId: string,
        threadTs: string,
        content: MessageContent,
        files?: FileAttachment[]
      ) => this.operations.postMessage(channelId, content, { threadTs, files }),
      subscribeToReactions: (messageId: string, callback: ReactionCallback) =>
        this.subscribeToMessageReactions(messageId, callback),
      startThread: async (
        messageId: string,
        channelId: string,
        name: string,
        autoArchiveDuration?: number
      ) => {
        const data = await this.operations.startThread(
          messageId,
          channelId,
          name,
          autoArchiveDuration
        );
        return this.buildThread(data);
      },
    };
  }

  /**
   * Build a Thread with full messaging operations
   */
  private buildThread(data: ThreadData): Thread {
    const ops: ThreadOperations = {
      delete: () => this.operations.deleteThread(data.id, data.channelId),
      post: (content: MessageContent, files?: FileAttachment[]) =>
        this.operations.postToThread(data.id, data.channelId, content, {
          files,
        }),
      subscribe: (callback: MessageCallback) =>
        this.operations.subscribeToThread(data.id, data.channelId, callback),
      createMessageOps: () => this.createThreadMessageOps(data),
    };
    return new Thread(data, ops);
  }

  /**
   * Create MessageOperations for messages inside a thread.
   * reply() is wired to post in the same thread.
   */
  private createThreadMessageOps(data: ThreadData): MessageOperations {
    const baseOps = this.createMessageOperations();
    return {
      ...baseOps,
      reply: async (
        _channelId: string,
        _threadTs: string,
        content: MessageContent,
        files?: FileAttachment[]
      ) =>
        this.operations.postToThread(data.id, data.channelId, content, {
          files,
        }),
    };
  }

  /**
   * Build a MessageBatch object backed by the internal batch store.
   */
  private buildBatch(batchId: string): MessageBatch {
    const snapshot = batchStore.getBatch(this.id, this.platform, batchId);
    if (snapshot === null) {
      throw new Error(`Batch ${batchId} was not found for this channel`);
    }
    return new MessageBatch(snapshot, {
      postMessage: (
        content: MessageContent,
        options?: { files?: FileAttachment[]; linkPreviews?: boolean }
      ) => this.postMessage(content, options),
      appendMessage: (id, message) => {
        batchStore.appendMessage(this.id, this.platform, id, {
          id: message.id,
          channelId: message.channelId,
          platform: message.platform,
          postedAt: message.postedAt.getTime(),
        });
      },
      removeMessages: (id, messageIds) => {
        batchStore.removeMessages(this.id, this.platform, id, messageIds);
      },
      deleteMessage: (messageId: string, options?: DeleteMessageOptions) =>
        this.operations.deleteMessage(messageId, this.id, options),
      finish: async (id: string) => {
        batchStore.finishBatch(this.id, this.platform, id);
      },
      getSnapshot: (id: string) => batchStore.getBatch(this.id, this.platform, id),
    });
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
      this.operations.sendTyping(this.id).catch(() => {
        // Ignore typing indicator failures
      });
      this.typingInterval = setInterval(() => {
        if (this.typingRefCount > 0) {
          this.operations.sendTyping(this.id).catch(() => {
            // Ignore typing indicator failures
          });
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
   * Begin a logical message batch for grouping related posts.
   * Batches can later be queried with getBatches()/getBatch().
   */
  async beginBatch(options: BeginBatchOptions = {}): Promise<MessageBatch> {
    const snapshot = batchStore.beginBatch({
      key: options.key,
      author: options.author,
      channelId: this.id,
      platform: this.platform,
    });
    return this.buildBatch(snapshot.id);
  }

  /**
   * Execute a callback with an auto-finishing message batch.
   * finish() is guaranteed in finally, even when callback throws.
   */
  async withBatch<T>(
    callback: (batch: MessageBatch) => Promise<T>
  ): Promise<T>;
  async withBatch<T>(
    options: BeginBatchOptions,
    callback: (batch: MessageBatch) => Promise<T>
  ): Promise<T>;
  async withBatch<T>(
    optionsOrCallback:
      | BeginBatchOptions
      | ((batch: MessageBatch) => Promise<T>),
    maybeCallback?: (batch: MessageBatch) => Promise<T>
  ): Promise<T> {
    const callback =
      typeof optionsOrCallback === "function"
        ? optionsOrCallback
        : maybeCallback;
    const options = typeof optionsOrCallback === "function" ? {} : optionsOrCallback;
    if (callback === undefined) {
      throw new Error("withBatch requires a callback");
    }

    const batch = await this.beginBatch(options);
    try {
      return await callback(batch);
    } finally {
      await batch.finish();
    }
  }

  /**
   * Retrieve a batch by ID within this channel.
   */
  async getBatch(id: string): Promise<MessageBatch | null> {
    const snapshot = batchStore.getBatch(this.id, this.platform, id);
    if (snapshot === null) {
      return null;
    }
    return this.buildBatch(snapshot.id);
  }

  /**
   * List batches in this channel, newest first.
   */
  async getBatches(options: BatchQueryOptions = {}): Promise<MessageBatch[]> {
    const snapshots = batchStore.getBatches(this.id, this.platform, options);
    return snapshots.map((snapshot) => this.buildBatch(snapshot.id));
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
    return threadsData.map((data) => this.buildThread(data));
  }

  /**
   * Get all members of this channel
   * @returns Array of members with mention strings
   */
  async getMembers(): Promise<Member[]> {
    return this.operations.getMembers(this.id);
  }

  /**
   * Find a channel member by fuzzy query (mention, username, display name, or email).
   * Returns null when no unambiguous match is found.
   */
  async findMember(query: string): Promise<Member | null> {
    const members = await this.getMembers();
    return findBestMemberMatch(members, query);
  }

  /**
   * Resolve a user query to a mention string (e.g., "<@U123>").
   * Returns null when no unambiguous match is found.
   */
  async resolveMention(query: string): Promise<string | null> {
    const member = await this.findMember(query);
    return member?.mention ?? null;
  }

  /**
   * Get recent messages in this channel.
   * Supports filtering by author and timestamp window.
   */
  async getMessages(options: MessageQueryOptions = {}): Promise<Message[]> {
    const { author: optionAuthor } = options;
    let author = optionAuthor;
    if (author !== undefined && author !== "me") {
      const mentionId = extractMentionId(author);
      if (mentionId !== null) {
        author = mentionId;
      } else {
        const member = await this.findMember(author);
        if (member !== null) {
          author = member.id;
        }
      }
    }

    const data = await this.operations.getMessages(this.id, {
      ...options,
      author,
    });

    return data.map(
      (message) => new Message(message, this.createMessageOperations())
    );
  }

  /**
   * Convenience helper to fetch recent messages authored by the connected bot.
   */
  async getRecentBotMessages(limit = 50): Promise<Message[]> {
    return this.getMessages({ limit, author: "me" });
  }

  /**
   * Opinionated cleanup helper: keep the newest N messages and delete the rest.
   * Returns the number of deleted messages.
   */
  async pruneMessages(
    options: MessageQueryOptions & {
      keep?: number;
      cascadeReplies?: boolean;
    } = {}
  ): Promise<number> {
    const keep = Math.max(0, options.keep ?? 0);
    const cascadeReplies = options.cascadeReplies ?? true;
    const messages = await this.getMessages({
      limit: options.limit,
      author: options.author,
      after: options.after,
      before: options.before,
    });

    const toDelete = messages.slice(keep);
    for (const message of toDelete) {
      await message.delete({ cascadeReplies });
    }
    return toDelete.length;
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
