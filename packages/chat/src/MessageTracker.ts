import type { Message } from "./Message";

/**
 * Tracks posted messages by key for later editing.
 *
 * Useful for status messages that should be updated in-place rather than
 * posting a new message (e.g., "Worker disconnected" → "Worker reconnected").
 */
export interface MessageTracker {
  /** Post a message and track it by key for later editing. */
  post(key: string, content: string): void;
  /** Edit a previously tracked message. Returns false if key not found. */
  edit(key: string, content: string): boolean;
  /** Get the timestamp when a tracked message was posted. */
  getPostedAt(key: string): Date | undefined;
}

/**
 * Create a message tracker that posts messages via the given function
 * and allows editing them later by key.
 *
 * @example
 * ```typescript
 * const tracker = createMessageTracker((content) => channel.postMessage(content));
 *
 * tracker.post("worker-1", "🔴 Worker disconnected: Server A");
 * // Later, when the worker reconnects:
 * tracker.edit("worker-1", "🟢 Worker reconnected: Server A (down for 2m 5s)");
 * ```
 */
export function createMessageTracker(
  postFn: (content: string) => PromiseLike<Message>
): MessageTracker {
  const entries = new Map<
    string,
    { message: PromiseLike<Message>; postedAt: Date }
  >();

  return {
    post(key, content) {
      entries.set(key, { message: postFn(content), postedAt: new Date() });
    },

    edit(key, content) {
      const entry = entries.get(key);
      if (entry === undefined) {
        return false;
      }
      entries.delete(key);
      void Promise.resolve(entry.message)
        .then((msg) => msg.update(content))
        .catch(() => {
          // Swallow — message may have been dismissed or deleted
        });
      return true;
    },

    getPostedAt(key) {
      return entries.get(key)?.postedAt;
    },
  };
}
