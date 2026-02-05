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
  /** Directory to store state files (default: ~/.app-state) */
  stateDirectory?: string;
  /** If true, log on every save (default: false) */
  verbose?: boolean;
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
  private readonly key: string;
  private readonly propertyName: string;
  private readonly verbose: boolean;
  private readonly stateDirectory: string;

  /**
   * Sanitize the key to prevent path traversal attacks.
   */
  private static sanitizeKey(key: string): string {
    const trimmed = key.trim();
    if (trimmed === '') {
      throw new Error('StateTracker key must be a non-empty string');
    }
    if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
      throw new Error('StateTracker key contains invalid path characters');
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
    this.key = sanitizedKey;
    this.propertyName = options.propertyName ?? 'value';
    this.verbose = options.verbose ?? false;
    this.stateDirectory = options.stateDirectory ?? StateTracker.getDefaultStateDirectory();
    this.ensureStateDir();
    this.filePath = path.join(this.stateDirectory, `${sanitizedKey}.json`);
  }

  private ensureStateDir(): void {
    if (!fs.existsSync(this.stateDirectory)) {
      fs.mkdirSync(this.stateDirectory, { recursive: true });
    }
  }

  /**
   * Load the persisted state value from disk.
   *
   * @param defaultValue - Value to return if no persisted state exists or if loading fails
   * @returns The persisted value or the default value
   */
  load(defaultValue: T): T {
    if (!fs.existsSync(this.filePath)) {
      if (this.verbose) {
        // eslint-disable-next-line no-console
        console.log(`No previous state found for ${this.key}, starting from default`);
      }
      return defaultValue;
    }
    try {
      const data = fs.readFileSync(this.filePath, 'utf-8');
      const state = JSON.parse(data) as Record<string, unknown>;
      const value = state[this.propertyName];
      if (value === undefined) {
        if (this.verbose) {
          console.error(`Invalid state for ${this.key}: missing ${this.propertyName}`);
        }
        return defaultValue;
      }
      const lastUpdated = state.lastUpdated as string | undefined;
      if (this.verbose) {
        // eslint-disable-next-line no-console
        console.log(
          `Resuming from ${this.propertyName} (last updated: ${lastUpdated ?? 'unknown'}) from ${this.filePath}`,
        );
      }
      return value as T;
    } catch (error) {
      console.error(
        `Failed to load state ${this.key}, starting from default:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      return defaultValue;
    }
  }

  /**
   * Save a state value to disk.
   *
   * @param value - The value to persist
   */
  save(value: T): void {
    try {
      const state: Record<string, unknown> = {
        [this.propertyName]: value,
        lastUpdated: new Date().toISOString(),
      };
      fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf-8');
      if (this.verbose) {
        // eslint-disable-next-line no-console
        console.log(`Saved state ${this.key}: ${this.propertyName}=${String(value)}`);
      }
    } catch (error) {
      console.error(
        `Failed to save state ${this.key}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
    }
  }

  /**
   * Get the path to the state file (for logging/debugging).
   */
  getFilePath(): string {
    return this.filePath;
  }
}
