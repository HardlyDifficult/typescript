import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Options for configuring a StateTracker instance.
 * The type T is inferred from the `default` property.
 */
export interface StateTrackerOptions<T> {
  /** Unique identifier for this state (e.g., "myapp-offset-mainnet") */
  key: string;
  /** Default value returned when no persisted state exists or loading fails */
  default: T;
  /** Directory to store state files (default: ~/.app-state or STATE_TRACKER_DIR env var) */
  stateDirectory?: string;
}

/**
 * Persists state to disk for recovery across restarts.
 *
 * Uses synchronous file I/O for simplicity. This is acceptable because:
 * - State saves occur infrequently
 * - The files are small (< 100 bytes typically)
 * - Synchronous writes ensure consistency without complex async coordination
 *
 * ## Durability Guarantee
 *
 * StateTracker uses atomic writes (write to temp file, then rename) to ensure
 * previously persisted state is never lost, even if the process crashes:
 *
 * - If a crash occurs before or during `save()`, the previous state file remains intact
 * - If a crash occurs after `save()` completes, the new state is fully persisted
 * - The only data that can be lost is an update that was in progress but didn't complete
 *
 * This guarantee relies on the atomicity of `rename()` on POSIX filesystems.
 *
 * @typeParam T - The type of value to persist, inferred from the `default` option
 */
export class StateTracker<T> {
  private readonly filePath: string;
  private readonly defaultValue: T;

  /**
   * Sanitize the key to prevent path traversal and unsafe filenames.
   * Only allow alphanumeric characters, hyphens, and underscores.
   */
  private static sanitizeKey(key: string): string {
    const trimmed = key.trim();
    if (trimmed === '') {
      throw new Error('StateTracker key must be a non-empty string');
    }
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      throw new Error(
        'StateTracker key contains invalid characters (only alphanumeric, hyphens, and underscores allowed)',
      );
    }
    return trimmed;
  }

  /**
   * Get the default state directory.
   * Uses STATE_TRACKER_DIR environment variable if set, otherwise ~/.app-state
   */
  private static getDefaultStateDirectory(): string {
    const envDir = process.env.STATE_TRACKER_DIR;
    if (envDir !== undefined && envDir !== '') {
      return envDir;
    }
    return path.join(os.homedir(), '.app-state');
  }

  constructor(options: StateTrackerOptions<T>) {
    const sanitizedKey = StateTracker.sanitizeKey(options.key);
    this.defaultValue = options.default;
    const stateDirectory = options.stateDirectory ?? StateTracker.getDefaultStateDirectory();

    if (!fs.existsSync(stateDirectory)) {
      fs.mkdirSync(stateDirectory, { recursive: true });
    }
    this.filePath = path.join(stateDirectory, `${sanitizedKey}.json`);
  }

  /**
   * Load the persisted state value from disk.
   *
   * @returns The persisted value, or the default value if no state exists or loading fails
   */
  load(): T {
    if (!fs.existsSync(this.filePath)) {
      return this.defaultValue;
    }
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      const state = JSON.parse(data) as Record<string, unknown>;
      const { value } = state;
      if (value === undefined) {
        return this.defaultValue;
      }
      return value as T;
    } catch {
      return this.defaultValue;
    }
  }

  /**
   * Save a state value to disk.
   *
   * Uses atomic write (temp file + rename) to ensure durability.
   * Previously persisted state is never lost, even on crash.
   *
   * @param value - The value to persist
   */
  save(value: T): void {
    const state: Record<string, unknown> = {
      value,
      lastUpdated: new Date().toISOString(),
    };
    // Atomic write: write to temp file then rename
    // This ensures the main file is never in a partially-written state
    const tempFilePath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempFilePath, JSON.stringify(state, null, 2), 'utf-8');
    fs.renameSync(tempFilePath, this.filePath);
  }

  /**
   * Get the path to the state file (for logging/debugging).
   */
  getFilePath(): string {
    return this.filePath;
  }
}
