import type { BatchRecord } from "./BatchStore.js";
import type { Message } from "./Message.js";
import type {
  BatchDeleteSummary,
  BatchKeepLatestSummary,
  BatchMessageRef,
  DeleteMessageOptions,
  FileAttachment,
  MessageContent,
  MessageData,
  Platform,
} from "./types.js";

interface MessageBatchOperations {
  postMessage(
    content: MessageContent,
    options?: { files?: FileAttachment[]; linkPreviews?: boolean }
  ): Message & PromiseLike<Message>;
  appendMessage(batchId: string, message: BatchMessageRef): void;
  removeMessages(batchId: string, messageIds: string[]): void;
  deleteMessage(messageId: string, options?: DeleteMessageOptions): Promise<void>;
  finish(batchId: string): Promise<void>;
  getSnapshot(batchId: string): BatchRecord | null;
}

function toPublicMessageRef(data: MessageData): BatchMessageRef {
  return {
    id: data.id,
    channelId: data.channelId,
    platform: data.platform,
    postedAt: new Date(),
  };
}

function fromRecordMessage(message: {
  id: string;
  channelId: string;
  platform: Platform;
  postedAt: number;
}): BatchMessageRef {
  return {
    id: message.id,
    channelId: message.channelId,
    platform: message.platform,
    postedAt: new Date(message.postedAt),
  };
}

/**
 * Represents a logical batch/group of posted messages in a channel.
 */
export class MessageBatch {
  public readonly id: string;
  public readonly key?: string;
  public readonly author: string;
  public readonly channelId: string;
  public readonly platform: Platform;
  public readonly createdAt: Date;

  private readonly operations: MessageBatchOperations;

  constructor(snapshot: BatchRecord, operations: MessageBatchOperations) {
    this.id = snapshot.id;
    this.key = snapshot.key;
    this.author = snapshot.author;
    this.channelId = snapshot.channelId;
    this.platform = snapshot.platform;
    this.createdAt = new Date(snapshot.createdAt);
    this.operations = operations;
  }

  private get snapshot(): BatchRecord | null {
    return this.operations.getSnapshot(this.id);
  }

  /**
   * Whether this batch has been explicitly finished.
   */
  get isFinished(): boolean {
    return this.snapshot?.closedAt !== undefined;
  }

  /**
   * Timestamp when finish() was called, or null for open batches.
   */
  get closedAt(): Date | null {
    const closedAt = this.snapshot?.closedAt;
    return closedAt !== undefined ? new Date(closedAt) : null;
  }

  /**
   * Message references posted through this batch.
   */
  get messages(): BatchMessageRef[] {
    const snapshot = this.snapshot;
    if (snapshot === null) {
      return [];
    }
    return snapshot.messages.map((message) => fromRecordMessage(message));
  }

  /**
   * Post a message and associate it with this batch.
   */
  post(
    content: MessageContent,
    options?: { files?: FileAttachment[]; linkPreviews?: boolean }
  ): Message & PromiseLike<Message> {
    const pending = this.operations.postMessage(content, options);
    void Promise.resolve(pending)
      .then((message) => {
        if (message.id === "") {
          // Slack file uploads can return empty message IDs; skip unaddressable refs.
          return;
        }
        this.operations.appendMessage(this.id, toPublicMessageRef(message));
      })
      .catch(() => {
        // Failures are surfaced to caller when awaiting the returned pending message.
      });
    return pending;
  }

  /**
   * Mark this batch as complete.
   */
  async finish(): Promise<void> {
    await this.operations.finish(this.id);
  }

  /**
   * Delete all tracked messages in this batch.
   */
  async deleteAll(
    options?: DeleteMessageOptions
  ): Promise<BatchDeleteSummary> {
    return this.deleteRefs(this.messages, options);
  }

  /**
   * Keep only the newest N tracked messages and delete the rest.
   */
  async keepLatest(
    n: number,
    options?: DeleteMessageOptions
  ): Promise<BatchKeepLatestSummary> {
    const keep = Math.max(0, Math.floor(n));
    const newestFirst = [...this.messages].sort(
      (a, b) => b.postedAt.getTime() - a.postedAt.getTime()
    );
    const keepIds = new Set(newestFirst.slice(0, keep).map((message) => message.id));
    const toDelete = this.messages.filter((message) => !keepIds.has(message.id));
    const result = await this.deleteRefs(toDelete, options);
    return {
      ...result,
      kept: Math.min(keep, newestFirst.length),
    };
  }

  private async deleteRefs(
    refs: BatchMessageRef[],
    options?: DeleteMessageOptions
  ): Promise<BatchDeleteSummary> {
    let deleted = 0;
    let failed = 0;
    const deletedIds: string[] = [];
    for (const ref of refs) {
      try {
        await this.operations.deleteMessage(ref.id, options);
        deleted += 1;
        deletedIds.push(ref.id);
      } catch {
        failed += 1;
      }
    }
    this.operations.removeMessages(this.id, deletedIds);
    return { deleted, failed };
  }
}
