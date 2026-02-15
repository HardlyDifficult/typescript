import { MESSAGE_LIMITS } from "./constants.js";
import type { Message } from "./Message.js";
import type { Platform } from "./types.js";

/**
 * Buffers text and periodically updates a single thread message in place.
 *
 * Created via {@link Thread.editableStream}. Unlike {@link StreamingReply}
 * which posts a new message on every flush, this class edits the same
 * message so the user sees a single message that grows over time.
 *
 * When the accumulated content exceeds the platform's message-length
 * limit, the beginning is truncated with an `…` prefix so the most
 * recent output is always visible.
 */
export class EditableStreamReply {
  private buffer = "";
  private lastFlushed = "";
  private currentMessage: Message | null = null;
  private flushing = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly postFn: (content: string) => Promise<Message>,
    private readonly platform: Platform,
    flushIntervalMs: number
  ) {
    this.intervalId = setInterval(() => {
      this.flush().catch(() => {
        // Interval flush errors are swallowed; callers observe errors
        // via the flush() and stop() return values.
      });
    }, flushIntervalMs);
  }

  /**
   * Append text to the accumulated buffer. The message will be updated
   * on the next flush (either automatic or manual).
   */
  append(text: string): void {
    this.buffer += text;
  }

  /**
   * The full accumulated content, including text not yet flushed.
   * Useful for reading back the complete response after {@link stop}.
   */
  get content(): string {
    return this.buffer;
  }

  /**
   * Post (first time) or edit (subsequent) the message with the full
   * accumulated buffer. No-op if the buffer hasn't changed since the
   * last flush or is empty/whitespace-only.
   */
  async flush(): Promise<void> {
    if (this.buffer === this.lastFlushed || !this.buffer.trim()) {
      return;
    }
    if (this.flushing) {
      return;
    }

    this.flushing = true;
    this.lastFlushed = this.buffer;

    const limit = MESSAGE_LIMITS[this.platform];
    const text =
      this.buffer.length > limit
        ? `\u2026${this.buffer.slice(-(limit - 1))}`
        : this.buffer;

    try {
      if (!this.currentMessage) {
        this.currentMessage = await this.postFn(text);
      } else {
        await this.currentMessage.update(text);
      }
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Stop the automatic flush timer and flush any remaining buffered text.
   */
  async stop(): Promise<void> {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    await this.flush();
  }
}
