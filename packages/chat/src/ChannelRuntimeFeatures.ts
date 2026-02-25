import type { Message } from "./Message.js";
import type { MessageContent, Platform } from "./types.js";

/** Default interval (ms) for refreshing the typing indicator. Discord expires after ~10s. */
const TYPING_REFRESH_MS = 8000;

/** Shared typing-indicator controller with ref-counted begin/end semantics. */
export class TypingController {
  private refCount = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly sendTyping: () => Promise<void>;

  constructor(sendTyping: () => Promise<void>) {
    this.sendTyping = sendTyping;
  }

  begin(): void {
    this.refCount++;
    if (this.refCount !== 1) {
      return;
    }
    this.sendTyping().catch(() => {
      // Ignore typing indicator failures.
    });
    this.interval = setInterval(() => {
      if (this.refCount > 0) {
        this.sendTyping().catch(() => {
          // Ignore typing indicator failures.
        });
      }
    }, TYPING_REFRESH_MS);
    this.interval.unref?.();
  }

  end(): void {
    if (this.refCount > 0) {
      this.refCount--;
    }
    if (this.refCount === 0 && this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async withTyping<T>(fn: () => Promise<T>): Promise<T> {
    this.begin();
    try {
      return await fn();
    } finally {
      this.end();
    }
  }

  clear(): void {
    this.refCount = 0;
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

/** Post a dismissable message that can be deleted via trash reaction by owner. */
export async function postDismissableMessage(
  platform: Platform,
  postMessage: (content: MessageContent) => Promise<Message>,
  content: MessageContent,
  ownerId: string
): Promise<Message> {
  const emoji = platform === "slack" ? ":wastebasket:" : "🗑️";
  const emojiMatch = platform === "slack" ? "wastebasket" : "🗑️";
  const message = await postMessage(content);
  message.addReactions([emoji]).onReaction(async (event) => {
    if (event.user.id !== ownerId || event.emoji !== emojiMatch) {
      return;
    }
    message.offReaction();
    await message.delete();
  });
  return message;
}

