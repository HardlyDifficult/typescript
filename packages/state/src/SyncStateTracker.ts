import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Represents the persisted sync state.
 */
export interface SyncState {
  /** The last offset we successfully processed */
  lastSuccessfulOffset: number;
  /** The end position at the time of our last successful sync */
  endAtSync: number;
  /** ISO timestamp of last update */
  lastUpdated: string;
  /** Additional metadata for debugging */
  metadata?: Record<string, unknown>;
}

/**
 * Options for configuring a SyncStateTracker instance.
 */
export interface SyncStateTrackerOptions {
  /** Namespace for the state file (e.g., "myapp") */
  namespace: string;
  /** Key within the namespace (e.g., "mainnet-sync") */
  key: string;
  /** Optional: Custom directory for state files (defaults to ~/.sync-state) */
  stateDirectory?: string;
}

/**
 * Get the default state directory.
 * Can be overridden via SYNC_STATE_DIR environment variable.
 */
function getDefaultStateDirectory(): string {
  const envDir = process.env.SYNC_STATE_DIR;
  if (envDir !== undefined && envDir !== '') {
    return envDir;
  }
  return path.join(os.homedir(), '.sync-state');
}

/**
 * Local file-based tracking of sync progress.
 *
 * This utility tracks the last successfully synced offset in a local file that
 * persists across deploys. Features:
 *
 * 1. Detects resets by comparing stored offset vs current end
 * 2. Uses atomic writes (temp file then rename) to prevent corruption
 * 3. Tracks metadata for debugging
 *
 * File location: Defaults to ~/.sync-state/{namespace}-{key}.json
 */
export class SyncStateTracker {
  private readonly stateFilePath: string;
  private readonly namespace: string;
  private readonly key: string;
  private readonly directoryWritable: boolean;
  private readonly stateDirectory: string;
  private cachedState: SyncState | null = null;

  constructor(options: SyncStateTrackerOptions) {
    this.namespace = options.namespace;
    this.key = options.key;
    this.stateDirectory = options.stateDirectory ?? getDefaultStateDirectory();

    // Ensure state directory exists - handle permission errors gracefully
    let isWritable = true;
    if (!fs.existsSync(this.stateDirectory)) {
      try {
        fs.mkdirSync(this.stateDirectory, { recursive: true });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(
          `Failed to create sync state directory: ${this.stateDirectory}. Error: ${errorMsg}. ` +
            `Will continue without local state tracking.`,
        );
        isWritable = false;
      }
    }

    this.directoryWritable = isWritable;
    this.stateFilePath = path.join(this.stateDirectory, `${this.namespace}-${this.key}.json`);
  }

  /**
   * Check if the state directory is writable.
   */
  isWritable(): boolean {
    return this.directoryWritable;
  }

  /**
   * Get the current sync state from the local file.
   * Returns null if no state file exists (first run).
   */
  getState(): SyncState | null {
    if (this.cachedState !== null) {
      return this.cachedState;
    }

    // If directory isn't writable, we can't read state either
    if (!this.directoryWritable) {
      return null;
    }

    try {
      if (!fs.existsSync(this.stateFilePath)) {
        return null;
      }

      const content = fs.readFileSync(this.stateFilePath, 'utf-8');
      const state = JSON.parse(content) as SyncState;

      // Validate the state has required fields
      if (
        typeof state.lastSuccessfulOffset !== 'number' ||
        typeof state.endAtSync !== 'number' ||
        typeof state.lastUpdated !== 'string'
      ) {
        console.error(`Invalid sync state file format, ignoring: ${this.stateFilePath}`);
        return null;
      }

      this.cachedState = state;
      return state;
    } catch (error) {
      console.error(
        `Failed to read sync state file: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  /**
   * Update the sync state after successful processing.
   *
   * Uses atomic write pattern (write to temp file, then rename) to prevent
   * corruption if the process crashes during write.
   *
   * @param offset - The offset we just successfully processed
   * @param end - The current end position (for detecting future resets)
   * @param metadata - Optional metadata to store
   */
  updateState(offset: number, end: number, metadata?: Record<string, unknown>): void {
    // Skip if directory isn't writable
    if (!this.directoryWritable) {
      return;
    }

    const state: SyncState = {
      lastSuccessfulOffset: offset,
      endAtSync: end,
      lastUpdated: new Date().toISOString(),
      metadata: metadata ?? {
        hostname: process.env.HOSTNAME ?? 'unknown',
        processId: process.pid,
      },
    };

    try {
      // Atomic write: write to temp file first, then rename
      // This prevents corruption if process crashes mid-write
      const tempPath = `${this.stateFilePath}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(state, null, 2));
      fs.renameSync(tempPath, this.stateFilePath);
      this.cachedState = state;
    } catch (error) {
      console.error(
        `Failed to write sync state file: ${error instanceof Error ? error.message : String(error)}`,
      );
      // Don't throw - this is not critical for operation
    }
  }

  /**
   * Determine the starting offset based on local state and current end.
   *
   * Logic:
   * 1. If no local state exists, return null (caller should use fallback)
   * 2. If local state exists but offset > currentEnd, data was reset -> return 0
   * 3. If local state exists and offset <= currentEnd, return offset - 1 (safety margin)
   *
   * @param currentEnd - The current end position from the source
   * @returns Starting offset to use, or null if no local state (use fallback)
   */
  getStartingOffset(currentEnd: number): { offset: number; wasReset: boolean } | null {
    const state = this.getState();

    if (state === null) {
      // No local state - caller should use fallback
      return null;
    }

    // Check if data was reset (our stored offset is beyond current end)
    if (state.lastSuccessfulOffset > currentEnd) {
      return { offset: 0, wasReset: true };
    }

    // Valid state - use it with safety margin
    const safeOffset = Math.max(0, state.lastSuccessfulOffset - 1);
    return { offset: safeOffset, wasReset: false };
  }

  /**
   * Clear the local state (for testing or manual reset).
   * Removes the state file and clears the cache.
   */
  clear(): void {
    this.cachedState = null;
    if (this.directoryWritable && fs.existsSync(this.stateFilePath)) {
      try {
        fs.unlinkSync(this.stateFilePath);
      } catch (error) {
        console.error(
          `Failed to clear sync state file: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  /**
   * Get the path to the state file (for logging/debugging).
   */
  getStateFilePath(): string {
    return this.stateFilePath;
  }
}
