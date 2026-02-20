/**
 * Job lifecycle management for threaded commands
 *
 * Manages the cancel/delete emoji flow for long-running jobs:
 * - While running: cancel emoji on the original message to cancel
 * - Thread replies of "cancel" or "stop" also cancel the job
 * - On completion: swaps cancel for dismiss emoji to delete message + thread
 */

import type { Message } from "../Message";
import type { Thread } from "../Thread";

/** Cancel emoji shown while a job is running */
export const EMOJI_CANCEL = "\u274C"; // ❌

/** Dismiss emoji shown after a job completes (click to delete) */
export const EMOJI_DISMISS = "\uD83D\uDDD1\uFE0F"; // 🗑️

export interface JobLifecycleOptions {
  /** The original user message (thread anchor — will have emojis added) */
  originalMessage: Message;
  /** The thread created for this job's output */
  thread: Thread;
  /** AbortController to signal cancellation */
  abortController: AbortController;
  /** Only react to this user's emoji clicks and thread replies */
  ownerUsername: string;
}

export interface JobLifecycleHandle {
  /** Call when the job completes (success or failure). Swaps cancel for delete emoji. */
  complete(): void;
}

/**
 * Set up cancel emoji on the original message and cancel-text listener in the thread.
 * Returns a handle whose `complete()` method swaps to the delete emoji.
 */
export function setupJobLifecycle(
  options: JobLifecycleOptions
): JobLifecycleHandle {
  const { originalMessage, thread, abortController, ownerUsername } = options;
  let completed = false;

  // Add cancel emoji and listen for clicks (use setReactions so trackedEmojis
  // is populated — complete() relies on setReactions diff to remove the cancel emoji)
  originalMessage.setReactions([EMOJI_CANCEL]);
  originalMessage.onReaction((event) => {
    if (completed) {
      return;
    }
    if (event.emoji !== EMOJI_CANCEL) {
      return;
    }
    if (event.user.username !== ownerUsername) {
      return;
    }
    abortController.abort();
  });

  // Listen for "cancel" / "stop" text replies in the thread
  const unsubReply = thread.onReply((msg) => {
    if (completed) {
      return;
    }
    if (msg.author?.username !== ownerUsername) {
      return;
    }
    const text = (msg.content ?? "").trim().toLowerCase();
    if (text === "cancel" || text === "stop") {
      abortController.abort();
    }
  });

  return {
    complete() {
      if (completed) {
        return;
      }
      completed = true;

      // Stop listening for cancel signals
      originalMessage.offReaction();
      unsubReply();

      // Swap cancel emoji for delete emoji
      originalMessage.setReactions([EMOJI_DISMISS], (event) => {
        if (event.emoji !== EMOJI_DISMISS) {
          return;
        }
        if (event.user.username !== ownerUsername) {
          return;
        }

        // Delete the original message and the entire thread
        originalMessage.delete().catch(() => {
          /* swallow */
        });
        thread.delete().catch(() => {
          /* swallow */
        });
      });
    },
  };
}
