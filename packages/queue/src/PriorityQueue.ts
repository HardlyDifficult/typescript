/**
 * Prioritized FIFO queue.
 *
 * Items with higher priority are dequeued first.
 * Within the same priority level, items are dequeued in insertion order (FIFO).
 *
 * Uses a multi-bucket approach: one logical queue per priority level.
 * Enqueue is O(1), dequeue is O(1) amortized, peek is O(1).
 * Reordering/removal helpers are O(n) within a bucket.
 */

/**
 * Priority levels for the queue.
 * Dequeue order: high first, then medium, then low.
 */
export type Priority = "high" | "medium" | "low";

/** All priority levels in dequeue order (highest first). */
const PRIORITY_ORDER: readonly Priority[] = ["high", "medium", "low"];

/**
 * An item in the queue with metadata.
 */
export interface QueueItem<T> {
  /** The queued data */
  readonly data: T;
  /** Priority level */
  readonly priority: Priority;
  /** When the item was enqueued (epoch ms) */
  readonly enqueuedAt: number;
  /** Unique identifier for this queue entry */
  readonly id: string;
}

/**
 * A prioritized FIFO queue.
 *
 * Items with higher priority are dequeued first.
 * Within the same priority, items are dequeued in insertion order (FIFO).
 */
export interface PriorityQueue<T> {
  /**
   * Add an item to the queue.
   * @param data - The item data
   * @param priority - Priority level (default: 'medium')
   * @returns The queued item with metadata
   */
  enqueue(data: T, priority?: Priority): QueueItem<T>;

  /**
   * Remove and return the highest-priority item (FIFO within same priority).
   * Returns undefined if the queue is empty.
   */
  dequeue(): QueueItem<T> | undefined;

  /**
   * Peek at the next item without removing it.
   * Returns undefined if the queue is empty.
   */
  peek(): QueueItem<T> | undefined;

  /**
   * Remove a specific item by its ID.
   * @returns true if the item was found and removed
   */
  remove(id: string): boolean;

  /** Number of items currently in the queue. */
  readonly size: number;

  /** Whether the queue is empty. */
  readonly isEmpty: boolean;

  /**
   * Register a callback invoked whenever an item is enqueued.
   * @returns An unsubscribe function.
   */
  onEnqueue(callback: (item: QueueItem<T>) => void): () => void;

  /**
   * Get all items in the queue ordered by dequeue priority.
   * Returns a snapshot; does not modify the queue.
   */
  toArray(): readonly QueueItem<T>[];

  /** Clear all items from the queue. */
  clear(): void;

  /**
   * Change the priority of an existing item.
   * Removes it from its current bucket and appends to the new bucket.
   * Preserves data and enqueuedAt; updates priority.
   * @returns true if the item was found and updated
   */
  updatePriority(id: string, newPriority: Priority): boolean;

  /**
   * Move an item before another item within the same priority bucket.
   * Both items must exist and share the same priority.
   * @returns true if the move succeeded
   */
  moveBefore(itemId: string, beforeItemId: string): boolean;

  /**
   * Move an item to the end of its priority bucket.
   * @returns true if the item was found and moved
   */
  moveToEnd(itemId: string): boolean;
}

/**
 * Create a new priority queue.
 */
export function createPriorityQueue<T>(): PriorityQueue<T> {
  interface Bucket {
    items: QueueItem<T>[];
    head: number;
  }

  const buckets: Record<Priority, Bucket> = {
    high: { items: [], head: 0 },
    medium: { items: [], head: 0 },
    low: { items: [], head: 0 },
  };
  const listeners = new Set<(item: QueueItem<T>) => void>();
  let counter = 0;

  function bucketSize(bucket: Bucket): number {
    return bucket.items.length - bucket.head;
  }

  function maybeCompactBucket(bucket: Bucket): void {
    if (bucket.head === 0) {
      return;
    }
    if (bucket.head >= bucket.items.length) {
      bucket.items = [];
      bucket.head = 0;
      return;
    }
    if (bucket.head > 32 && bucket.head * 2 >= bucket.items.length) {
      bucket.items = bucket.items.slice(bucket.head);
      bucket.head = 0;
    }
  }

  function findIndex(bucket: Bucket, id: string): number {
    for (let i = bucket.head; i < bucket.items.length; i++) {
      if (bucket.items[i].id === id) {
        return i;
      }
    }
    return -1;
  }

  function getSize(): number {
    return (
      bucketSize(buckets.high) +
      bucketSize(buckets.medium) +
      bucketSize(buckets.low)
    );
  }

  return {
    enqueue(data: T, priority: Priority = "medium"): QueueItem<T> {
      const item: QueueItem<T> = {
        data,
        priority,
        enqueuedAt: Date.now(),
        id: `q_${String(++counter)}`,
      };
      buckets[priority].items.push(item);
      for (const cb of listeners) {
        cb(item);
      }
      return item;
    },

    dequeue(): QueueItem<T> | undefined {
      for (const p of PRIORITY_ORDER) {
        const bucket = buckets[p];
        if (bucket.head < bucket.items.length) {
          const item = bucket.items[bucket.head];
          bucket.head += 1;
          maybeCompactBucket(bucket);
          return item;
        }
      }
      return undefined;
    },

    peek(): QueueItem<T> | undefined {
      for (const p of PRIORITY_ORDER) {
        const bucket = buckets[p];
        if (bucket.head < bucket.items.length) {
          return bucket.items[bucket.head];
        }
      }
      return undefined;
    },

    remove(id: string): boolean {
      for (const p of PRIORITY_ORDER) {
        const bucket = buckets[p];
        const idx = findIndex(bucket, id);
        if (idx !== -1) {
          bucket.items.splice(idx, 1);
          maybeCompactBucket(bucket);
          return true;
        }
      }
      return false;
    },

    get size() {
      return getSize();
    },

    get isEmpty() {
      return getSize() === 0;
    },

    onEnqueue(callback: (item: QueueItem<T>) => void): () => void {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },

    toArray(): readonly QueueItem<T>[] {
      return [
        ...buckets.high.items.slice(buckets.high.head),
        ...buckets.medium.items.slice(buckets.medium.head),
        ...buckets.low.items.slice(buckets.low.head),
      ];
    },

    clear(): void {
      buckets.high.items = [];
      buckets.high.head = 0;
      buckets.medium.items = [];
      buckets.medium.head = 0;
      buckets.low.items = [];
      buckets.low.head = 0;
    },

    updatePriority(id: string, newPriority: Priority): boolean {
      for (const p of PRIORITY_ORDER) {
        const source = buckets[p];
        const idx = findIndex(source, id);
        if (idx !== -1) {
          if (p === newPriority) {
            return true;
          }
          const [item] = source.items.splice(idx, 1);
          maybeCompactBucket(source);
          // Create new item with updated priority (preserves data + enqueuedAt)
          const updated: QueueItem<T> = {
            data: item.data,
            priority: newPriority,
            enqueuedAt: item.enqueuedAt,
            id: item.id,
          };
          buckets[newPriority].items.push(updated);
          return true;
        }
      }
      return false;
    },

    moveBefore(itemId: string, beforeItemId: string): boolean {
      // Find both items - they must be in the same priority bucket
      for (const p of PRIORITY_ORDER) {
        const bucket = buckets[p];
        const itemIdx = findIndex(bucket, itemId);
        const beforeIdx = findIndex(bucket, beforeItemId);
        if (itemIdx !== -1 && beforeIdx !== -1 && itemIdx !== beforeIdx) {
          const [item] = bucket.items.splice(itemIdx, 1);
          // Recalculate target index after removal
          const newBeforeIdx = findIndex(bucket, beforeItemId);
          bucket.items.splice(newBeforeIdx, 0, item);
          return true;
        }
      }
      return false;
    },

    moveToEnd(itemId: string): boolean {
      for (const p of PRIORITY_ORDER) {
        const bucket = buckets[p];
        const idx = findIndex(bucket, itemId);
        if (idx !== -1 && idx < bucket.items.length - 1) {
          const [item] = bucket.items.splice(idx, 1);
          bucket.items.push(item);
          return true;
        }
        if (idx !== -1 && idx === bucket.items.length - 1) {
          return true; // Already at end
        }
      }
      return false;
    },
  };
}
