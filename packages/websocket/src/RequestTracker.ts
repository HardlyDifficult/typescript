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
    string,
    Set<(...args: unknown[]) => void>
  >();

  /**
   * Subscribe to a RequestTracker event.
   * Returns an unsubscribe function.
   */
  on<K extends keyof RequestTrackerEvents>(
    event: K,
    listener: RequestTrackerEvents[K],
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    const fn = listener as (...args: unknown[]) => void;
    set.add(fn);
    return () => {
      set.delete(fn);
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

  private emit(event: string, ...args: unknown[]): void {
    const set = this.listeners.get(event);
    if (!set) {
      return;
    }
    for (const listener of set) {
      (listener as (...a: unknown[]) => void)(...args);
    }
  }
}
