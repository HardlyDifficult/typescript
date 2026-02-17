import { randomUUID } from "node:crypto";

import type { BatchQueryOptions, MessageAuthorFilter, Platform } from "./types.js";

export interface BatchMessageRefRecord {
  id: string;
  channelId: string;
  platform: Platform;
  postedAt: number;
}

export interface BatchRecord {
  id: string;
  key?: string;
  author: MessageAuthorFilter;
  channelId: string;
  platform: Platform;
  createdAt: number;
  closedAt?: number;
  messages: BatchMessageRefRecord[];
}

interface BeginBatchRecordOptions {
  key?: string;
  author?: MessageAuthorFilter;
  channelId: string;
  platform: Platform;
}

function channelKey(channelId: string, platform: Platform): string {
  return `${platform}:${channelId}`;
}

function cloneRecord(record: BatchRecord): BatchRecord {
  return {
    ...record,
    messages: record.messages.map((message) => ({ ...message })),
  };
}

class InMemoryBatchStore {
  private byChannel = new Map<string, BatchRecord[]>();
  private byId = new Map<string, { channelKey: string; record: BatchRecord }>();

  beginBatch(options: BeginBatchRecordOptions): BatchRecord {
    const key = channelKey(options.channelId, options.platform);
    const createdAt = Date.now();
    const record: BatchRecord = {
      id: randomUUID(),
      key: options.key,
      author: options.author ?? "me",
      channelId: options.channelId,
      platform: options.platform,
      createdAt,
      messages: [],
    };

    const list = this.byChannel.get(key) ?? [];
    list.push(record);
    this.byChannel.set(key, list);
    this.byId.set(record.id, { channelKey: key, record });
    return cloneRecord(record);
  }

  appendMessage(
    channelId: string,
    platform: Platform,
    batchId: string,
    message: BatchMessageRefRecord
  ): BatchRecord | null {
    const existing = this.byId.get(batchId);
    if (
      existing === undefined ||
      existing.channelKey !== channelKey(channelId, platform)
    ) {
      return null;
    }
    const duplicate = existing.record.messages.some((msg) => msg.id === message.id);
    if (!duplicate) {
      existing.record.messages.push({ ...message });
    }
    return cloneRecord(existing.record);
  }

  finishBatch(
    channelId: string,
    platform: Platform,
    batchId: string
  ): BatchRecord | null {
    const existing = this.byId.get(batchId);
    if (
      existing === undefined ||
      existing.channelKey !== channelKey(channelId, platform)
    ) {
      return null;
    }
    existing.record.closedAt ??= Date.now();
    return cloneRecord(existing.record);
  }

  removeMessages(
    channelId: string,
    platform: Platform,
    batchId: string,
    messageIds: string[]
  ): BatchRecord | null {
    if (messageIds.length === 0) {
      return this.getBatch(channelId, platform, batchId);
    }
    const existing = this.byId.get(batchId);
    if (
      existing === undefined ||
      existing.channelKey !== channelKey(channelId, platform)
    ) {
      return null;
    }
    const toRemove = new Set(messageIds);
    existing.record.messages = existing.record.messages.filter(
      (message) => !toRemove.has(message.id)
    );
    return cloneRecord(existing.record);
  }

  getBatch(
    channelId: string,
    platform: Platform,
    batchId: string
  ): BatchRecord | null {
    const existing = this.byId.get(batchId);
    if (
      existing === undefined ||
      existing.channelKey !== channelKey(channelId, platform)
    ) {
      return null;
    }
    return cloneRecord(existing.record);
  }

  getBatches(
    channelId: string,
    platform: Platform,
    options: BatchQueryOptions = {}
  ): BatchRecord[] {
    const list = this.byChannel.get(channelKey(channelId, platform)) ?? [];
    const includeOpen = options.includeOpen ?? true;
    const filtered = list.filter((record) => {
      if (options.key !== undefined && record.key !== options.key) {
        return false;
      }
      if (options.author !== undefined && record.author !== options.author) {
        return false;
      }
      if (!includeOpen && record.closedAt === undefined) {
        return false;
      }
      return true;
    });

    filtered.sort((a, b) => b.createdAt - a.createdAt);
    const limited =
      options.limit !== undefined
        ? filtered.slice(0, Math.max(0, options.limit))
        : filtered;
    return limited.map((record) => cloneRecord(record));
  }

  reset(): void {
    this.byChannel.clear();
    this.byId.clear();
  }
}

export const batchStore = new InMemoryBatchStore();

/** @internal Testing helper to isolate batch-store state between tests. */
export function resetBatchStore(): void {
  batchStore.reset();
}
