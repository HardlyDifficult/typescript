import { batchStore } from "./BatchStore.js";
import type { Message } from "./Message.js";
import { MessageBatch } from "./MessageBatch.js";
import type {
  BatchQueryOptions,
  BeginBatchOptions,
  DeleteMessageOptions,
  FileAttachment,
  MessageContent,
  Platform,
} from "./types.js";

export interface ChannelBatchAdapter {
  id: string;
  platform: Platform;
  postMessage(
    content: MessageContent,
    options?: { files?: FileAttachment[]; linkPreviews?: boolean }
  ): Message & PromiseLike<Message>;
  deleteMessage(
    messageId: string,
    options?: DeleteMessageOptions
  ): Promise<void>;
}

/** Creates a channel batch adapter from individual callback functions. */
export function createChannelBatchAdapter(
  id: string,
  platform: Platform,
  postMessage: (
    content: MessageContent,
    options?: { files?: FileAttachment[]; linkPreviews?: boolean }
  ) => Message & PromiseLike<Message>,
  deleteMessage: (
    messageId: string,
    options?: DeleteMessageOptions
  ) => Promise<void>
): ChannelBatchAdapter {
  return {
    id,
    platform,
    postMessage,
    deleteMessage,
  };
}

function buildBatch(
  adapter: ChannelBatchAdapter,
  batchId: string
): MessageBatch {
  const snapshot = batchStore.getBatch(adapter.id, adapter.platform, batchId);
  if (snapshot === null) {
    throw new Error(`Batch ${batchId} was not found for this channel`);
  }
  return new MessageBatch(snapshot, {
    postMessage: (
      content: MessageContent,
      options?: { files?: FileAttachment[]; linkPreviews?: boolean }
    ) => adapter.postMessage(content, options),
    appendMessage: (id, message) => {
      batchStore.appendMessage(adapter.id, adapter.platform, id, {
        id: message.id,
        channelId: message.channelId,
        platform: message.platform,
        postedAt: message.postedAt.getTime(),
      });
    },
    removeMessages: (id, messageIds) => {
      batchStore.removeMessages(adapter.id, adapter.platform, id, messageIds);
    },
    deleteMessage: (messageId: string, options?: DeleteMessageOptions) =>
      adapter.deleteMessage(messageId, options),
    finish: (id: string) => {
      batchStore.finishBatch(adapter.id, adapter.platform, id);
      return Promise.resolve();
    },
    getSnapshot: (id: string) =>
      batchStore.getBatch(adapter.id, adapter.platform, id),
  });
}

/** Begins a new message batch for the given channel. */
export function beginChannelBatch(
  adapter: ChannelBatchAdapter,
  options: BeginBatchOptions = {}
): Promise<MessageBatch> {
  const snapshot = batchStore.beginBatch({
    key: options.key,
    author: options.author,
    channelId: adapter.id,
    platform: adapter.platform,
  });
  return Promise.resolve(buildBatch(adapter, snapshot.id));
}

/** Retrieves a single message batch by ID, or null if not found. */
export function getChannelBatch(
  adapter: ChannelBatchAdapter,
  id: string
): Promise<MessageBatch | null> {
  const snapshot = batchStore.getBatch(adapter.id, adapter.platform, id);
  if (snapshot === null) {
    return Promise.resolve(null);
  }
  return Promise.resolve(buildBatch(adapter, snapshot.id));
}

/** Retrieves all message batches for the given channel, optionally filtered. */
export function getChannelBatches(
  adapter: ChannelBatchAdapter,
  options: BatchQueryOptions = {}
): Promise<MessageBatch[]> {
  const snapshots = batchStore.getBatches(
    adapter.id,
    adapter.platform,
    options
  );
  return Promise.resolve(
    snapshots.map((snapshot) => buildBatch(adapter, snapshot.id))
  );
}

export function withChannelBatch<T>(
  adapter: ChannelBatchAdapter,
  callback: (batch: MessageBatch) => Promise<T>
): Promise<T>;
export function withChannelBatch<T>(
  adapter: ChannelBatchAdapter,
  options: BeginBatchOptions,
  callback: (batch: MessageBatch) => Promise<T>
): Promise<T>;
/** Runs a callback within a new batch, automatically finishing it when done. */
export async function withChannelBatch<T>(
  adapter: ChannelBatchAdapter,
  optionsOrCallback: BeginBatchOptions | ((batch: MessageBatch) => Promise<T>),
  maybeCallback?: (batch: MessageBatch) => Promise<T>
): Promise<T> {
  const callback =
    typeof optionsOrCallback === "function" ? optionsOrCallback : maybeCallback;
  const options =
    typeof optionsOrCallback === "function" ? {} : optionsOrCallback;

  if (callback === undefined) {
    throw new Error("withBatch requires a callback");
  }

  const batch = await beginChannelBatch(adapter, options);
  try {
    return await callback(batch);
  } finally {
    await batch.finish();
  }
}

/** Dispatches to withChannelBatch after resolving the overloaded arguments. */
export function withChannelBatchFromArgs<T>(
  adapter: ChannelBatchAdapter,
  optionsOrCallback: BeginBatchOptions | ((batch: MessageBatch) => Promise<T>),
  maybeCallback?: (batch: MessageBatch) => Promise<T>
): Promise<T> {
  if (typeof optionsOrCallback === "function") {
    return withChannelBatch(adapter, optionsOrCallback);
  }
  if (maybeCallback === undefined) {
    throw new Error("withBatch requires a callback");
  }
  return withChannelBatch(adapter, optionsOrCallback, maybeCallback);
}
