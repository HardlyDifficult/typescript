/**
 * TimedFlag - A persistent boolean flag that auto-expires after a duration.
 *
 * Backed by StateTracker for persistence across restarts.
 * Use cases: Do Not Disturb, maintenance mode, temporary feature flags.
 */

import { StateTracker, type StateTrackerEvent } from "./StateTracker.js";

export interface TimedFlagState {
  /** Whether the flag is currently active */
  active: boolean;
  /** ISO timestamp when the flag expires (undefined if inactive or no expiry) */
  endAt?: string;
}

export interface TimedFlagOptions {
  /** Storage key for this flag (alphanumeric, hyphens, underscores) */
  key: string;
  /** Directory to persist state files */
  stateDirectory: string;
  /** Debounce interval for auto-save in milliseconds (default: 2000) */
  autoSaveMs?: number;
  /** Optional event handler for debug/info/warn/error messages */
  onEvent?: (event: StateTrackerEvent) => void;
}

const DEFAULT_STATE: TimedFlagState = {
  active: false,
};

/**
 * A persistent boolean flag with an optional expiry time.
 *
 * @example
 * ```ts
 * const dnd = new TimedFlag({ key: 'dnd', stateDirectory: '/var/data' });
 * await dnd.init();
 *
 * dnd.set({ durationMinutes: 60 });  // active for 1 hour
 * dnd.isActive();                    // true
 * dnd.getEndAt();                    // ISO timestamp
 * dnd.end();                         // cancel early
 * ```
 */
export class TimedFlag {
  private readonly stateTracker: StateTracker<TimedFlagState>;

  constructor(options: TimedFlagOptions) {
    this.stateTracker = new StateTracker<TimedFlagState>({
      key: options.key,
      default: DEFAULT_STATE,
      stateDirectory: options.stateDirectory,
      autoSaveMs: options.autoSaveMs ?? 2000,
      onEvent: options.onEvent,
    });
  }

  /** Load persisted state. Must be called before using other methods. */
  async init(): Promise<void> {
    await this.stateTracker.loadAsync();
  }

  /**
   * Returns true if the flag is active and the end time has not passed.
   * Automatically expires stale state as a side-effect.
   */
  isActive(): boolean {
    this.expireIfNeeded();
    const { active, endAt } = this.stateTracker.state;
    if (!active) {
      return false;
    }
    if (endAt === undefined) {
      return true;
    }
    const endMs = Date.parse(endAt);
    if (Number.isNaN(endMs)) {
      return true;
    } // Invalid date — treat as active
    return Date.now() < endMs;
  }

  /**
   * Returns the ISO timestamp when the flag expires, or undefined if inactive
   * or no end time is set. Useful for scheduling retries after the flag clears.
   */
  getEndAt(): string | undefined {
    if (!this.isActive()) {
      return undefined;
    }
    return this.stateTracker.state.endAt;
  }

  /**
   * Activate the flag for a duration or until a specific time.
   *
   * @param options.durationMinutes - How many minutes to keep the flag active
   * @param options.endAt - ISO timestamp when the flag expires
   *
   * Provide either `durationMinutes` or `endAt`, not both.
   */
  set(options: { durationMinutes?: number; endAt?: string }): void {
    const { durationMinutes, endAt } = options;
    if (durationMinutes !== undefined && endAt !== undefined) {
      throw new Error("Provide either durationMinutes or endAt, not both");
    }
    if (durationMinutes === undefined && endAt === undefined) {
      throw new Error("Provide durationMinutes or endAt");
    }

    let resolvedEndAt: string;
    if (endAt !== undefined) {
      const parsed = Date.parse(endAt);
      if (Number.isNaN(parsed)) {
        throw new Error(`Invalid endAt: ${endAt}`);
      }
      resolvedEndAt = new Date(parsed).toISOString();
    } else {
      // durationMinutes is guaranteed defined when endAt is undefined (checked above)
      resolvedEndAt = new Date(
        Date.now() + durationMinutes! * 60 * 1000
      ).toISOString();
    }

    this.stateTracker.set({ active: true, endAt: resolvedEndAt });
  }

  /** Deactivate the flag early. No-op if the flag is already inactive. */
  end(): void {
    if (!this.stateTracker.state.active) {
      return;
    }
    this.stateTracker.set(DEFAULT_STATE);
  }

  /**
   * If the flag was active but the end time has passed, clear it.
   * Called automatically by `isActive()` and `getState()`.
   */
  expireIfNeeded(): void {
    const { active, endAt } = this.stateTracker.state;
    if (!active || endAt === undefined) {
      return;
    }
    const endMs = Date.parse(endAt);
    if (Number.isNaN(endMs) || Date.now() >= endMs) {
      this.stateTracker.set(DEFAULT_STATE);
    }
  }

  /** Returns the current flag state (after checking for expiry). */
  getState(): TimedFlagState {
    this.expireIfNeeded();
    return { ...this.stateTracker.state };
  }
}
