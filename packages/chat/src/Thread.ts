import { Message, type MessageOperations } from "./Message.js";
import type {
  FileAttachment,
  MessageCallback,
  MessageContent,
  MessageData,
  MessageEvent,
  Platform,
  ThreadData,
} from "./types.js";

/**
 * Internal operations provided by Channel to power Thread methods.
 * Not exported — Thread consumers interact via the public API only.
 */
export interface ThreadOperations {
  delete: () => Promise<void>;
  post: (
    content: MessageContent,
    files?: FileAttachment[]
  ) => Promise<MessageData>;
  subscribe: (callback: MessageCallback) => () => void;
  createMessageOps: () => MessageOperations;
}

/**
 * A thread with messaging capabilities: post messages, listen for replies,
 * and clean up when done.
 *
 * @example
 * ```typescript
 * const thread = await channel.createThread("Hello!", "Session");
 * await thread.post("How can I help?");
 *
 * thread.onReply(async (msg) => {
 *   await thread.post(`Got: ${msg.content}`);
 * });
 *
 * await thread.delete();
 * ```
 */
export class Thread {
  public readonly id: string;
  public readonly channelId: string;
  public readonly platform: Platform;

  private ops: ThreadOperations;
  private replyUnsubscribers: (() => void)[] = [];

  constructor(data: ThreadData, ops: ThreadOperations) {
    this.id = data.id;
    this.channelId = data.channelId;
    this.platform = data.platform;
    this.ops = ops;
  }

  /**
   * Post a message in this thread
   * @param content - Message content (string or Document)
   * @param files - Optional file attachments
   * @returns Message object for the posted message
   */
  async post(
    content: MessageContent,
    files?: FileAttachment[]
  ): Promise<Message> {
    const data = await this.ops.post(content, files);
    return new Message(data, this.ops.createMessageOps());
  }

  /**
   * Subscribe to replies in this thread.
   * @param callback - Function called with a Message for each reply
   * @returns Unsubscribe function
   */
  onReply(callback: (message: Message) => void | Promise<void>): () => void {
    const unsubscribe = this.ops.subscribe((event: MessageEvent) => {
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
        this.ops.createMessageOps()
      );
      return callback(message);
    });
    this.replyUnsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * Stop listening for all replies in this thread
   */
  offReply(): void {
    for (const unsub of this.replyUnsubscribers) {
      unsub();
    }
    this.replyUnsubscribers = [];
  }

  /**
   * Delete this thread and stop all reply listeners
   */
  async delete(): Promise<void> {
    this.offReply();
    await this.ops.delete();
  }
}
