import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as os from "os";
import * as path from "path";

export type StateTrackerEventLevel = "debug" | "info" | "warn" | "error";

export interface StateTrackerEvent {
  level: StateTrackerEventLevel;
  message: string;
  context?: Record<string, unknown>;
}

export interface StateTrackerOptions<T> {
  key: string;
  default: T;
  stateDirectory?: string;
  autoSaveMs?: number;
  onEvent?: (event: StateTrackerEvent) => void;
}

export class StateTracker<T> {
  private readonly filePath: string;
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
    this.defaultValue = structuredClone(options.default);
    this._state = structuredClone(options.default);
    this.autoSaveMs = options.autoSaveMs ?? 0;
    this.onEvent = options.onEvent;
    const stateDirectory =
      options.stateDirectory ?? StateTracker.getDefaultStateDirectory();

    if (!fs.existsSync(stateDirectory)) {
      fs.mkdirSync(stateDirectory, { recursive: true });
    }
    this.filePath = path.join(stateDirectory, `${sanitizedKey}.json`);
  }

  /** Read-only getter for cached in-memory state */
  get state(): Readonly<T> {
    return this._state;
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

  /**
   * Extract value from parsed JSON content.
   * Handles v1 envelope format ({value, lastUpdated}) and legacy
   * PersistentStore format (raw T without envelope, merged with defaults).
   */
  private extractValue(parsed: unknown): T {
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
      return envelope.value as T;
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
      return {
        ...structuredClone(this.defaultValue),
        ...(parsed as Record<string, unknown>),
      } as T;
    }

    // Fallback to defaults
    return structuredClone(this.defaultValue);
  }

  /** Sync load — v1 compatible. Also updates internal state cache. */
  load(): T {
    if (!fs.existsSync(this.filePath)) {
      this._state = structuredClone(this.defaultValue);
      this._loaded = true;
      this._storageAvailable = true;
      return this._state;
    }
    try {
      const data = fs.readFileSync(this.filePath, "utf-8");
      const state = JSON.parse(data) as Record<string, unknown>;
      const { value } = state;
      if (value === undefined) {
        this._state = structuredClone(this.defaultValue);
        this._loaded = true;
        this._storageAvailable = true;
        return this.defaultValue;
      }
      this._state = structuredClone(value as T);
      this._loaded = true;
      this._storageAvailable = true;
      return value as T;
    } catch {
      this._state = structuredClone(this.defaultValue);
      this._loaded = true;
      this._storageAvailable = true;
      return this.defaultValue;
    }
  }

  /** Sync save — v1 compatible. Also updates internal state cache. */
  save(value: T): void {
    this.cancelPendingSave();
    this._state = structuredClone(value);
    const state: Record<string, unknown> = {
      value,
      lastUpdated: new Date().toISOString(),
    };
    const tempFilePath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempFilePath, JSON.stringify(state, null, 2), "utf-8");
    fs.renameSync(tempFilePath, this.filePath);
  }

  /**
   * Async load with graceful degradation.
   * Sets _storageAvailable false on failure instead of throwing.
   * Safe to call multiple times (subsequent calls are no-ops).
   */
  async loadAsync(): Promise<void> {
    if (this._loaded) {
      return;
    }

    this._loaded = true;

    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        this.emit("info", "Creating storage directory", { dir });
        await fsPromises.mkdir(dir, { recursive: true });
      }

      if (fs.existsSync(this.filePath)) {
        const data = await fsPromises.readFile(this.filePath, "utf-8");
        const parsed: unknown = JSON.parse(data);
        this._state = this.extractValue(parsed);
        this._storageAvailable = true;
        this.emit("info", "Loaded state from disk", { path: this.filePath });
      } else {
        this._storageAvailable = true;
        this.emit("info", "No existing state file, using defaults", {
          path: this.filePath,
        });
      }
    } catch (err) {
      this._storageAvailable = false;
      const errorMessage =
        err instanceof Error ? err.message : String(err);
      this.emit("warn", "Storage unavailable, running in-memory", {
        error: errorMessage,
        path: this.filePath,
      });
    }
  }

  /**
   * Async atomic save (temp file + rename).
   * Cancels any pending auto-save before writing.
   */
  async saveAsync(): Promise<void> {
    this.cancelPendingSave();

    if (!this._storageAvailable) {
      return;
    }

    try {
      const state: Record<string, unknown> = {
        value: this._state,
        lastUpdated: new Date().toISOString(),
      };
      const tempFilePath = `${this.filePath}.tmp`;
      await fsPromises.writeFile(
        tempFilePath,
        JSON.stringify(state, null, 2),
        "utf-8"
      );
      await fsPromises.rename(tempFilePath, this.filePath);
      this.emit("debug", "Saved state to disk", { path: this.filePath });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err);
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

  getFilePath(): string {
    return this.filePath;
  }

  private scheduleSave(): void {
    if (this.autoSaveMs <= 0 || !this._storageAvailable) {
      return;
    }

    this.cancelPendingSave();

    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      // Use sync save to avoid issues with untracked promises
      try {
        const state: Record<string, unknown> = {
          value: this._state,
          lastUpdated: new Date().toISOString(),
        };
        const tempFilePath = `${this.filePath}.tmp`;
        fs.writeFileSync(
          tempFilePath,
          JSON.stringify(state, null, 2),
          "utf-8"
        );
        fs.renameSync(tempFilePath, this.filePath);
        this.emit("debug", "Auto-saved state to disk", {
          path: this.filePath,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err);
        this.emit("error", "Failed to auto-save state", {
          error: errorMessage,
        });
      }
    }, this.autoSaveMs);
  }

  private cancelPendingSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
}
