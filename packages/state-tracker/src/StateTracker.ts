import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Options for configuring a StateTracker instance.
 */
export interface StateTrackerOptions {
  /** Unique identifier for this state (e.g., "myapp-offset-mainnet") */
  key: string;
  /** Property name to use in JSON file (default: "value") */
  propertyName?: string;
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
 * @typeParam T - The type of value to persist (default: number)
 */
export class StateTracker<T = number> {
  private readonly filePath: string;
  private readonly propertyName: string;

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

  constructor(options: StateTrackerOptions) {
    const sanitizedKey = StateTracker.sanitizeKey(options.key);
    this.propertyName = options.propertyName ?? 'value';
    const stateDirectory = options.stateDirectory ?? StateTracker.getDefaultStateDirectory();

    if (!fs.existsSync(stateDirectory)) {
      fs.mkdirSync(stateDirectory, { recursive: true });
    }
    this.filePath = path.join(stateDirectory, `${sanitizedKey}.json`);
  }

  /**
   * Load the persisted state value from disk.
   *
   * @param defaultValue - Value to return if no persisted state exists or if loading fails
   * @returns The persisted value or the default value
   */
  load(defaultValue: T): T {
    if (!fs.existsSync(this.filePath)) {
      return defaultValue;
    }
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      const state = JSON.parse(data) as Record<string, unknown>;
      const value = state[this.propertyName];
      if (value === undefined) {
        return defaultValue;
      }
      return value as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Save a state value to disk.
   *
   * @param value - The value to persist
   */
  save(value: T): void {
    const state: Record<string, unknown> = {
      [this.propertyName]: value,
      lastUpdated: new Date().toISOString(),
    };
    // Atomic write: write to temp file then rename
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
