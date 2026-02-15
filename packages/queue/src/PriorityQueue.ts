/**
 * Prioritized FIFO queue.
 *
 * Items with higher priority are dequeued first.
 * Within the same priority level, items are dequeued in insertion order (FIFO).
 *
 * Uses a multi-bucket approach: one array per priority level.
 * O(1) enqueue, O(1) dequeue.
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
  toArray(): ReadonlyArray<QueueItem<T>>;

  /** Clear all items from the queue. */
  clear(): void;
}

/**
 * Create a new priority queue.
 */
export function createPriorityQueue<T>(): PriorityQueue<T> {
  const buckets: Record<Priority, QueueItem<T>[]> = {
    high: [],
    medium: [],
    low: [],
  };
  const listeners = new Set<(item: QueueItem<T>) => void>();
  let counter = 0;

  function getSize(): number {
    return buckets.high.length + buckets.medium.length + buckets.low.length;
  }

  return {
    enqueue(data: T, priority: Priority = "medium"): QueueItem<T> {
      const item: QueueItem<T> = {
        data,
        priority,
        enqueuedAt: Date.now(),
        id: `q_${++counter}`,
      };
      buckets[priority].push(item);
      for (const cb of listeners) {
        cb(item);
      }
      return item;
    },

    dequeue(): QueueItem<T> | undefined {
      for (const p of PRIORITY_ORDER) {
        if (buckets[p].length > 0) {
          return buckets[p].shift();
        }
      }
      return undefined;
    },

    peek(): QueueItem<T> | undefined {
      for (const p of PRIORITY_ORDER) {
        const first = buckets[p][0];
        if (first !== undefined) {
          return first;
        }
      }
      return undefined;
    },

    remove(id: string): boolean {
      for (const p of PRIORITY_ORDER) {
        const idx = buckets[p].findIndex((item) => item.id === id);
        if (idx !== -1) {
          buckets[p].splice(idx, 1);
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

    toArray(): ReadonlyArray<QueueItem<T>> {
      return [...buckets.high, ...buckets.medium, ...buckets.low];
    },

    clear(): void {
      buckets.high.length = 0;
      buckets.medium.length = 0;
      buckets.low.length = 0;
    },
  };
}
