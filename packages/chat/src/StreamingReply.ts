import { MESSAGE_LIMITS } from "./constants.js";
import type { Platform } from "./types";

/**
 * Splits text into chunks that fit within a message length limit,
 * breaking at newlines or spaces when possible.
 */
function chunkText(text: string, maxLength: number): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > maxLength) {
    let breakPoint = remaining.lastIndexOf("\n", maxLength);
    if (breakPoint < maxLength / 2) {
      breakPoint = remaining.lastIndexOf(" ", maxLength);
    }
    if (breakPoint < maxLength / 2) {
      breakPoint = maxLength;
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining =
      breakPoint === maxLength
        ? remaining.slice(breakPoint)
        : remaining.slice(breakPoint + 1);
  }

  if (remaining.length > 0) {
    chunks.push(remaining);
  }

  return chunks;
}

/**
 * Buffers text and periodically flushes it as thread replies.
 *
 * Created via {@link Message.streamReply}. Text appended between flushes
 * is batched into a single reply. If the accumulated text exceeds the
 * platform's message-length limit, it is automatically split into
 * multiple replies at natural break points (newlines, spaces).
 */
export class StreamingReply {
  private buffer = "";
  private accumulated = "";
  private readonly abortSignal?: AbortSignal;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly replyFn: (content: string) => PromiseLike<unknown>,
    private readonly platform: Platform,
    flushIntervalMs: number,
    abortSignal?: AbortSignal
  ) {
    this.abortSignal = abortSignal;
    this.intervalId = setInterval(() => {
      this.flush().catch(() => {
        // Interval flush errors are swallowed; callers observe errors
        // via the flush() and stop() return values.
      });
    }, flushIntervalMs);
    this.intervalId.unref();

    if (abortSignal !== undefined) {
      if (abortSignal.aborted) {
        void this.stop();
      } else {
        abortSignal.addEventListener(
          "abort",
          () => {
            void this.stop();
          },
          { once: true }
        );
      }
    }
  }

  /**
   * Append text to the buffer. The text will be sent on the next
   * flush (either automatic or manual). No-op if the stream has
   * been aborted.
   */
  append(text: string): void {
    if (this.abortSignal?.aborted === true) {
      return;
    }
    this.buffer += text;
    this.accumulated += text;
  }

  /**
   * The full accumulated content, including text not yet flushed.
   * Useful for reading back the complete response after {@link stop}.
   */
  get content(): string {
    return this.accumulated;
  }

  /**
   * Flush any buffered text as one or more thread replies.
   * No-op if the buffer is empty or whitespace-only.
   */
  async flush(): Promise<void> {
    if (!this.buffer.trim()) {
      return;
    }
    const text = this.buffer;
    this.buffer = "";
    const limit = MESSAGE_LIMITS[this.platform];
    const chunks = chunkText(text, limit);
    for (const chunk of chunks) {
      await this.replyFn(chunk);
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
