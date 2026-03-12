/**
 * EventBus - Circular-buffer event bus with groupId deduplication and replay.
 *
 * Features:
 * - Configurable buffer size for replay to late-joining clients
 * - groupId replacement: events with the same groupId replace earlier ones in-place
 * - Context enrichment: auto-adds metadata based on contextKey lookup
 */

import { randomUUID } from "crypto";
import { EventEmitter } from "events";

/** Minimal shape required for events managed by the EventBus. */
export interface EventBusEvent {
  id: string;
  timestamp: string;
  groupId?: string;
}

export interface EventBusOptions {
  /** Maximum number of events to keep in the replay buffer. Default: 500. */
  maxBufferSize?: number;
}

const DEFAULT_MAX_BUFFER_SIZE = 500;

/**
 * Generic circular-buffer event bus with groupId-based in-place replacement
 * and replay support for late-joining listeners.
 *
 * @template TEvent - The event shape, must extend EventBusEvent (id, timestamp, groupId?).
 * @template TContext - Optional per-emitter context shape for auto-enrichment.
 * @template TContextKey - The key on TEvent whose value is used to look up context.
 */
export class EventBus<
  TEvent extends EventBusEvent,
  TContext extends Record<string, unknown> = Record<string, unknown>,
  TContextKey extends keyof TEvent = never,
> {
  private readonly emitter = new EventEmitter();
  private readonly buffer: TEvent[] = [];
  private readonly contexts = new Map<string, TContext>();
  private readonly maxBufferSize: number;
  private readonly contextKey: TContextKey | undefined;

  constructor(options?: EventBusOptions & { contextKey?: TContextKey }) {
    this.maxBufferSize = options?.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
    this.contextKey = options?.contextKey;
  }

  /**
   * Register context for a key value so that events whose contextKey field
   * matches that value are automatically enriched with the provided context.
   */
  setContext(key: string, context: TContext): void {
    this.contexts.set(key, context);
  }

  /** Remove context after it is no longer needed. */
  clearContext(key: string): void {
    this.contexts.delete(key);
  }

  /**
   * Emit an event. Automatically assigns id and timestamp.
   * If a contextKey is configured, the event is enriched with any matching context.
   * If the event has a groupId that already exists in the buffer, that entry is
   * replaced in-place (no append, no eviction).
   */
  emit(partial: Omit<TEvent, "id" | "timestamp">): void {
    let enriched = partial;

    // Auto-enrich with registered context when a contextKey is configured
    if (this.contextKey !== undefined) {
      const keyValue =
        partial[this.contextKey as unknown as keyof typeof partial];
      if (typeof keyValue === "string") {
        const ctx = this.contexts.get(keyValue);
        if (ctx !== undefined) {
          enriched = { ...enriched, ...ctx };
        }
      }
    }

    const event = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      ...enriched,
    } as TEvent;

    // groupId replacement: replace existing event with same groupId in-place
    if (event.groupId !== undefined) {
      const idx = this.buffer.findIndex((e) => e.groupId === event.groupId);
      if (idx !== -1) {
        this.buffer[idx] = event;
        this.emitter.emit("event", event);
        return;
      }
    }

    // Normal append with circular eviction
    this.buffer.push(event);
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }
    this.emitter.emit("event", event);
  }

  /**
   * Subscribe to all future events. Returns an unsubscribe function.
   */
  onEvent(callback: (event: TEvent) => void): () => void {
    this.emitter.on("event", callback);
    return () => {
      this.emitter.off("event", callback);
    };
  }

  /**
   * Return a snapshot of the current replay buffer.
   * Suitable for replaying historical events to a late-joining client.
   */
  getRecentEvents(): TEvent[] {
    return [...this.buffer];
  }

  /**
   * Pre-populate the buffer with historical events (e.g. loaded from disk on startup).
   * Does not broadcast — these events are served via getRecentEvents() on the next replay.
   */
  preloadEvents(events: TEvent[]): void {
    for (const event of events) {
      if (event.groupId !== undefined) {
        const idx = this.buffer.findIndex((e) => e.groupId === event.groupId);
        if (idx !== -1) {
          this.buffer[idx] = event;
          continue;
        }
      }
      this.buffer.push(event);
      if (this.buffer.length > this.maxBufferSize) {
        this.buffer.shift();
      }
    }
  }
}
