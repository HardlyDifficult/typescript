import type { RequestTrackerEvents } from "./types.js";

/**
 * Tracks active requests and manages draining state.
 *
 * Centralizes the pattern of rejecting new work during drain
 * and notifying listeners when the last request completes.
 */
export class RequestTracker {
  private _active = 0;
  private _draining = false;
  private readonly listeners = new Map<
    keyof RequestTrackerEvents,
    Set<RequestTrackerEvents[keyof RequestTrackerEvents]>
  >();

  /**
   * Subscribe to a RequestTracker event.
   * Returns an unsubscribe function.
   */
  on<K extends keyof RequestTrackerEvents>(
    event: K,
    listener: RequestTrackerEvents[K]
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  /**
   * Try to accept a new request.
   * Returns false if draining — caller should send a rejection response.
   */
  tryAccept(): boolean {
    if (this._draining) {
      return false;
    }
    this._active++;
    return true;
  }

  /**
   * Mark a request as complete.
   * Decrements the active count and emits drained when the last
   * request finishes during a drain.
   */
  complete(): void {
    this._active--;
    if (this._draining && this._active === 0) {
      this.emit("drained");
    }
  }

  /**
   * Enter draining mode — no new requests will be accepted.
   * Idempotent: subsequent calls are ignored.
   * Emits draining immediately and drained when active reaches zero.
   */
  startDraining(reason: string): void {
    if (this._draining) {
      return;
    }
    this._draining = true;
    this.emit("draining", reason);
    if (this._active === 0) {
      this.emit("drained");
    }
  }

  /** Whether the tracker is in draining mode */
  get draining(): boolean {
    return this._draining;
  }

  /** Number of currently active requests */
  get active(): number {
    return this._active;
  }

  private emit(event: "drained"): void;
  private emit(event: "draining", reason: string): void;
  private emit(event: keyof RequestTrackerEvents, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }

    const errors: unknown[] = [];
    for (const listener of [...set]) {
      try {
        (listener as (...a: unknown[]) => void)(...args);
      } catch (error) {
        errors.push(error);
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(
        errors,
        `request tracker listener error: ${event}`
      );
    }
  }
}
