import * as fsPromises from "fs/promises";
import * as os from "os";
import * as path from "path";

function getDefaultStateDirectory(): string {
  const envDir = process.env.STATE_TRACKER_DIR;
  if (envDir !== undefined && envDir !== "") {
    return envDir;
  }
  return path.join(os.homedir(), ".app-state");
}

export type StateTrackerEventLevel = "debug" | "info" | "warn" | "error";

export interface StateTrackerEvent {
  level: StateTrackerEventLevel;
  message: string;
  context?: Record<string, unknown>;
}

export interface StateStorage {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
}

export type StorageAdapter = StateStorage;

export interface FileStateStorageOptions {
  directory?: string;
}

interface FileStateStorage extends StateStorage {
  readonly kind: "file";
  getFilePath(key: string): string;
}

function isFileStateStorage(
  storage: StateStorage
): storage is FileStateStorage {
  return (
    (storage as { kind?: string }).kind === "file" &&
    typeof (storage as { getFilePath?: unknown }).getFilePath === "function"
  );
}

/** File-based storage for local development, scripts, and single-host services. */
export function createFileStorage(
  options: FileStateStorageOptions = {}
): StateStorage {
  const directory = options.directory ?? getDefaultStateDirectory();

  const storage: FileStateStorage = {
    kind: "file",
    async read(key) {
      const filePath = path.join(directory, `${key}.json`);
      await fsPromises.mkdir(directory, { recursive: true });

      try {
        return await fsPromises.readFile(filePath, "utf-8");
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          return null;
        }
        throw err;
      }
    },
    async write(key, value) {
      const filePath = path.join(directory, `${key}.json`);
      const tempFilePath = `${filePath}.tmp`;

      await fsPromises.mkdir(directory, { recursive: true });
      await fsPromises.writeFile(tempFilePath, value, "utf-8");
      await fsPromises.rename(tempFilePath, filePath);
    },
    getFilePath(key) {
      return path.join(directory, `${key}.json`);
    },
  };

  return storage;
}

export interface StateTrackerOptions<T> {
  key: string;
  default: T;
  storage?: StateStorage;
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

export interface StateTrackerOpenOptions<T>
  extends StateTrackerOptions<T>, StateTrackerLoadOrDefaultOptions<T> {}

export type StateTrackerSaveMeta = Record<string, unknown>;

/** Defines a state migration with type-safe legacy-to-current conversion. */
export function defineStateMigration<TCurrent, TLegacy>(
  migration: StateTrackerMigration<TCurrent, TLegacy>
): StateTrackerMigration<TCurrent, TLegacy> {
  return migration;
}

/** Atomic JSON state persistence with pluggable storage, auto-save, and graceful degradation to in-memory mode. */
export class StateTracker<T> {
  private readonly storageKey: string;
  private readonly storage: StateStorage;
  private readonly fileStorage?: FileStateStorage;
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

  private static resolveStorage<T>(
    options: StateTrackerOptions<T>
  ): StateStorage {
    if (options.storage !== undefined) {
      return options.storage;
    }

    if (options.storageAdapter !== undefined) {
      return options.storageAdapter;
    }

    return createFileStorage({ directory: options.stateDirectory });
  }

  /** Create, load, and return a ready-to-use tracker in one call. */
  static async open<T>(
    options: StateTrackerOpenOptions<T>
  ): Promise<StateTracker<T>> {
    const { migrations, ...trackerOptions } = options;
    const tracker = new StateTracker<T>(trackerOptions);
    await tracker.loadAsync({ migrations });
    return tracker;
  }

  constructor(options: StateTrackerOptions<T>) {
    const sanitizedKey = StateTracker.sanitizeKey(options.key);
    this.storageKey = sanitizedKey;
    this.defaultValue = structuredClone(options.default);
    this._state = structuredClone(options.default);
    this.autoSaveMs = options.autoSaveMs ?? 0;
    this.onEvent = options.onEvent;

    this.storage = StateTracker.resolveStorage(options);
    if (isFileStateStorage(this.storage)) {
      this.fileStorage = this.storage;
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

  private storageContext(): Record<string, unknown> {
    if (this.fileStorage !== undefined) {
      return {
        key: this.storageKey,
        storage: "file",
        path: this.fileStorage.getFilePath(this.storageKey),
      };
    }

    return {
      key: this.storageKey,
      storage: "custom",
    };
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
  async loadAsync(
    options?: StateTrackerLoadOrDefaultOptions<T>
  ): Promise<Readonly<T>> {
    if (this._loaded) {
      return this.state;
    }

    this._loaded = true;

    try {
      const data = await this.storage.read(this.storageKey);
      this._storageAvailable = true;

      if (data === null) {
        this.emit("info", "No persisted state found, using defaults", {
          ...this.storageContext(),
        });
        return this.state;
      }

      const parsed: unknown = JSON.parse(data);
      this._state = this.extractValue(parsed, options?.migrations);
      this.emit("debug", "Loaded state", {
        ...this.storageContext(),
      });
    } catch (err) {
      this._storageAvailable = false;
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.emit("warn", "Storage unavailable, running in-memory", {
        error: errorMessage,
        ...this.storageContext(),
      });
    }

    return this.state;
  }

  /**
   * Async save. Cancels any pending auto-save before writing.
   */
  async saveAsync(): Promise<Readonly<T>> {
    this.cancelPendingSave();

    if (!this._storageAvailable) {
      return this.state;
    }

    try {
      const json = JSON.stringify(this.buildEnvelope(this._state), null, 2);
      await this.storage.write(this.storageKey, json);
      this.emit("debug", "Saved state", {
        ...this.storageContext(),
      });
    } catch (err) {
      this._storageAvailable = false;
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.emit("error", "Failed to save state; persistence disabled", {
        error: errorMessage,
        ...this.storageContext(),
      });
    }

    return this.state;
  }

  /** Replace entire state, schedules auto-save. */
  set(newState: T): Readonly<T> {
    this._state = structuredClone(newState);
    this.scheduleSave();
    return this.state;
  }

  /**
   * Shallow merge for object types, schedules auto-save.
   * Throws at runtime if T is not an object.
   */
  update(changes: Partial<T>): Readonly<T> {
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
    return this.state;
  }

  /**
   * Mutate a cloned draft, then commit the result as the next state.
   * Throws when the current state is a primitive.
   */
  mutate(mutator: (draft: T) => void): Readonly<T> {
    if (this._state === null || typeof this._state !== "object") {
      throw new Error(
        "mutate() can only be used when state is an object or array"
      );
    }

    const draft = structuredClone(this._state);
    mutator(draft);
    this._state = draft;
    this.scheduleSave();
    return this.state;
  }

  /** Restore to defaults, schedules auto-save. */
  reset(): Readonly<T> {
    this._state = structuredClone(this.defaultValue);
    this.scheduleSave();
    return this.state;
  }

  /** Returns the file path for file storage. Throws when using custom storage. */
  getFilePath(): string {
    if (this.fileStorage === undefined) {
      throw new Error("getFilePath() is only available with file storage");
    }
    return this.fileStorage.getFilePath(this.storageKey);
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
