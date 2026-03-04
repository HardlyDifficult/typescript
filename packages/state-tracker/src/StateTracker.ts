import * as fsPromises from "fs/promises";
import * as os from "os";
import * as path from "path";

export type StateTrackerEventLevel = "debug" | "info" | "warn" | "error";

export interface StateTrackerEvent {
  level: StateTrackerEventLevel;
  message: string;
  context?: Record<string, unknown>;
}

export interface StorageAdapter {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
}

export interface StateTrackerOptions<T> {
  key: string;
  default: T;
  stateDirectory?: string;
  storageAdapter?: StorageAdapter;
  autoSaveMs?: number;
  onEvent?: (event: StateTrackerEvent) => void;
}

export interface StateTrackerMigration<TCurrent, TLegacy = unknown> {
  readonly name?: string;
  isLegacy(input: unknown): input is TLegacy;
  migrate(legacy: TLegacy): TCurrent;
}

export interface StateTrackerLoadOrDefaultOptions<T> {
  migrations?: readonly StateTrackerMigration<T>[];
}

export type StateTrackerSaveMeta = Record<string, unknown>;

/** Defines a state migration with type-safe legacy-to-current conversion. */
export function defineStateMigration<TCurrent, TLegacy>(
  migration: StateTrackerMigration<TCurrent, TLegacy>
): StateTrackerMigration<TCurrent, TLegacy> {
  return migration;
}

/** Atomic JSON state persistence with pluggable storage (file or custom adapter), auto-save, and graceful degradation to in-memory mode. */
export class StateTracker<T> {
  private readonly storageKey: string;
  private readonly storageAdapter?: StorageAdapter;
  private readonly filePath?: string;
  private readonly defaultValue: T;
  private readonly autoSaveMs: number;
  private readonly onEvent?: (event: StateTrackerEvent) => void;

  private _state: T;
  private _loaded = false;
  private _storageAvailable = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private static sanitizeKey(key: string): string {
    const trimmed = key.trim();
    if (trimmed === "") {
      throw new Error("StateTracker key must be a non-empty string");
    }
    if (!/^[A-Za-z0-9_-]+$/.test(trimmed)) {
      throw new Error(
        "StateTracker key contains invalid characters (only alphanumeric, hyphens, and underscores allowed)"
      );
    }
    return trimmed;
  }

  private static getDefaultStateDirectory(): string {
    const envDir = process.env.STATE_TRACKER_DIR;
    if (envDir !== undefined && envDir !== "") {
      return envDir;
    }
    return path.join(os.homedir(), ".app-state");
  }

  constructor(options: StateTrackerOptions<T>) {
    const sanitizedKey = StateTracker.sanitizeKey(options.key);
    this.storageKey = sanitizedKey;
    this.defaultValue = structuredClone(options.default);
    this._state = structuredClone(options.default);
    this.autoSaveMs = options.autoSaveMs ?? 0;
    this.onEvent = options.onEvent;

    if (options.storageAdapter !== undefined) {
      this.storageAdapter = options.storageAdapter;
    } else {
      const stateDirectory =
        options.stateDirectory ?? StateTracker.getDefaultStateDirectory();
      this.filePath = path.join(stateDirectory, `${sanitizedKey}.json`);
    }
  }

  /** Read-only getter for cached in-memory state */
  get state(): Readonly<T> {
    return structuredClone(this._state);
  }

  /** Whether storage is working */
  get isPersistent(): boolean {
    return this._storageAvailable;
  }

  private emit(
    level: StateTrackerEventLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (this.onEvent) {
      this.onEvent({ level, message, context });
    }
  }

  private buildEnvelope(value: T): Record<string, unknown> {
    return {
      value,
      lastUpdated: new Date().toISOString(),
    };
  }

  private mergeWithDefaults(value: unknown): T {
    if (
      value !== null &&
      typeof value === "object" &&
      typeof this.defaultValue === "object" &&
      this.defaultValue !== null &&
      !Array.isArray(value)
    ) {
      return {
        ...structuredClone(this.defaultValue),
        ...(value as Record<string, unknown>),
      } as T;
    }
    return value as T;
  }

  private extractMigrationCandidate(parsed: unknown): unknown {
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      "value" in (parsed as Record<string, unknown>)
    ) {
      return (parsed as Record<string, unknown>).value;
    }
    return parsed;
  }

  private tryApplyMigrations(
    parsed: unknown,
    migrations?: readonly StateTrackerMigration<T>[]
  ): T | undefined {
    if (migrations === undefined || migrations.length === 0) {
      return undefined;
    }

    const candidate = this.extractMigrationCandidate(parsed);
    for (const migration of migrations) {
      if (!migration.isLegacy(candidate)) {
        continue;
      }

      try {
        const migrated = migration.migrate(candidate);
        this.emit("info", "Migrated legacy state payload", {
          migration: migration.name ?? "anonymous",
        });
        return this.mergeWithDefaults(migrated);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.emit("warn", "Legacy state migration failed", {
          migration: migration.name ?? "anonymous",
          error: errorMessage,
        });
        return structuredClone(this.defaultValue);
      }
    }

    return undefined;
  }

  /**
   * Extract value from parsed JSON content.
   * Handles v1 envelope format ({value, lastUpdated}) and legacy
   * PersistentStore format (raw T without envelope, merged with defaults).
   */
  private extractValue(
    parsed: unknown,
    migrations?: readonly StateTrackerMigration<T>[]
  ): T {
    const migrated = this.tryApplyMigrations(parsed, migrations);
    if (migrated !== undefined) {
      return migrated;
    }

    if (
      parsed !== null &&
      typeof parsed === "object" &&
      !Array.isArray(parsed) &&
      "value" in (parsed as Record<string, unknown>)
    ) {
      // v1 envelope format: { value, lastUpdated }
      const envelope = parsed as Record<string, unknown>;
      if (envelope.value === undefined) {
        return structuredClone(this.defaultValue);
      }
      return this.mergeWithDefaults(envelope.value);
    }

    // Legacy PersistentStore format: raw T without envelope
    // Only merge if T is an object type
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      typeof this.defaultValue === "object" &&
      this.defaultValue !== null &&
      !Array.isArray(parsed)
    ) {
      return this.mergeWithDefaults(parsed);
    }

    // Fallback to defaults
    return structuredClone(this.defaultValue);
  }

  /**
   * Async load with graceful degradation.
   * Sets _storageAvailable false on failure instead of throwing.
   * Safe to call multiple times (subsequent calls are no-ops).
   * Accepts optional migrations to transform legacy state shapes.
   */
  async loadAsync(options?: StateTrackerLoadOrDefaultOptions<T>): Promise<void> {
    if (this._loaded) {
      return;
    }

    this._loaded = true;

    try {
      let data: string | null;

      if (this.storageAdapter !== undefined) {
        data = await this.storageAdapter.read(this.storageKey);
        if (data === null) {
          this._storageAvailable = true;
          this.emit("info", "No existing state in adapter, using defaults", {
            key: this.storageKey,
          });
        }
      } else {
        const dir = path.dirname(this.filePath!);
        await fsPromises.mkdir(dir, { recursive: true });
        try {
          data = await fsPromises.readFile(this.filePath!, "utf-8");
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            data = null;
            this._storageAvailable = true;
            this.emit("info", "No existing state file, using defaults", {
              path: this.filePath!,
            });
          } else {
            throw err;
          }
        }
      }

      if (data !== null) {
        const parsed: unknown = JSON.parse(data);
        this._state = this.extractValue(parsed, options?.migrations);
        this._storageAvailable = true;
        if (this.storageAdapter !== undefined) {
          this.emit("debug", "Loaded state from adapter", {
            key: this.storageKey,
          });
        } else {
          this.emit("debug", "Loaded state from disk", {
            path: this.filePath!,
          });
        }
      }
    } catch (err) {
      this._storageAvailable = false;
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.emit("warn", "Storage unavailable, running in-memory", {
        error: errorMessage,
        ...(this.storageAdapter !== undefined
          ? { key: this.storageKey }
          : { path: this.filePath! }),
      });
    }
  }

  /**
   * Async save. Cancels any pending auto-save before writing.
   */
  async saveAsync(): Promise<void> {
    this.cancelPendingSave();

    if (!this._storageAvailable) {
      return;
    }

    try {
      const json = JSON.stringify(this.buildEnvelope(this._state), null, 2);

      if (this.storageAdapter !== undefined) {
        await this.storageAdapter.write(this.storageKey, json);
        this.emit("debug", "Saved state to adapter", { key: this.storageKey });
      } else {
        const tempFilePath = `${this.filePath!}.tmp`;
        await fsPromises.writeFile(tempFilePath, json, "utf-8");
        await fsPromises.rename(tempFilePath, this.filePath!);
        this.emit("debug", "Saved state to disk", { path: this.filePath! });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.emit("error", "Failed to save state", {
        error: errorMessage,
      });
    }
  }

  /** Replace entire state, schedules auto-save. */
  set(newState: T): void {
    this._state = structuredClone(newState);
    this.scheduleSave();
  }

  /**
   * Shallow merge for object types, schedules auto-save.
   * Throws at runtime if T is not an object.
   */
  update(changes: Partial<T>): void {
    if (
      this._state === null ||
      typeof this._state !== "object" ||
      Array.isArray(this._state)
    ) {
      throw new Error(
        "update() can only be used when state is a non-array object"
      );
    }
    this._state = { ...this._state, ...changes };
    this.scheduleSave();
  }

  /** Restore to defaults, schedules auto-save. */
  reset(): void {
    this._state = structuredClone(this.defaultValue);
    this.scheduleSave();
  }

  /** Returns the file path for file-based storage. Throws when using a storageAdapter. */
  getFilePath(): string {
    if (this.filePath === undefined) {
      throw new Error(
        "getFilePath() is not available when using a storageAdapter"
      );
    }
    return this.filePath;
  }

  private scheduleSave(): void {
    if (this.autoSaveMs <= 0 || !this._storageAvailable) {
      return;
    }

    this.cancelPendingSave();

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.saveAsync();
    }, this.autoSaveMs);
  }

  private cancelPendingSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
}
