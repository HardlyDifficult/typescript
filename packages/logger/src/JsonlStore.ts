/**
 * JsonlStore - Append-only JSONL persistence with auto-trim and pagination.
 *
 * Stores one JSON object per line. Caps at a configurable max line count.
 * Provides loadRecent and loadBefore for cursor-based pagination.
 */

import fs from "fs";
import path from "path";

export interface JsonlStoreOptions {
  /** Directory where the JSONL file lives. Must exist for persistence. */
  directory: string;
  /** Filename for the JSONL file. Default: 'events.jsonl'. */
  filename?: string;
  /** Maximum lines before auto-trim. Default: 5000. */
  maxLines?: number;
  /** Optional error logger. */
  onError?: (message: string, context?: Record<string, unknown>) => void;
}

/**
 *
 */
export class JsonlStore<T> {
  /** Path to the JSONL log file. */
  readonly filePath: string;

  /**
   * True when the storage directory exists and writes will be persisted.
   * False when the directory is not mounted — operations degrade gracefully
   * to no-ops.
   */
  readonly isPersistent: boolean;

  private readonly maxLines: number;
  private readonly onError: (
    message: string,
    context?: Record<string, unknown>
  ) => void;

  /** In-memory line count, incremented on each append. Initialized from the
   *  file on construction so trimming stays accurate across restarts. */
  private lineCount = 0;

  /** Prevents concurrent trim operations. */
  private trimInProgress = false;

  constructor(options: JsonlStoreOptions) {
    const {
      directory,
      filename = "events.jsonl",
      maxLines = 5_000,
      onError,
    } = options;
    this.maxLines = maxLines;
    this.onError =
      onError ??
      (() => {
        /* no-op */
      });

    this.isPersistent = fs.existsSync(directory);
    this.filePath = path.join(directory, filename);

    if (this.isPersistent && fs.existsSync(this.filePath)) {
      try {
        const content = fs.readFileSync(this.filePath, "utf8");
        this.lineCount = content.trim().split("\n").filter(Boolean).length;
      } catch {
        this.lineCount = 0;
      }
    }
  }

  /** Append a single record to the JSONL file (sync, fire-and-forget on error). */
  append(record: T): void {
    if (!this.isPersistent) {
      return;
    }
    try {
      fs.appendFileSync(this.filePath, `${JSON.stringify(record)}\n`, "utf8");
      this.lineCount++;
      if (this.lineCount > this.maxLines * 1.1) {
        this.trimAsync();
      }
    } catch (err) {
      this.onError("JsonlStore: failed to append record", {
        error: String(err),
      });
    }
  }

  /**
   * Return the most recent `limit` records from the file.
   * Per-line parse errors are silently skipped so a single corrupted entry
   * cannot prevent loading.
   */
  loadRecent(limit = 500): T[] {
    if (!this.isPersistent || !fs.existsSync(this.filePath)) {
      return [];
    }
    try {
      const content = fs.readFileSync(this.filePath, "utf8");
      const lines = content.trim().split("\n").filter(Boolean);
      return lines.slice(-limit).flatMap((line) => {
        try {
          return [JSON.parse(line) as T];
        } catch {
          return [];
        }
      });
    } catch (err) {
      this.onError("JsonlStore: failed to load records", {
        error: String(err),
      });
      return [];
    }
  }

  /**
   * Return up to `limit` records whose `timestampField` value is strictly
   * before `beforeTimestamp`, in ascending order.
   * Used for cursor-based pagination.
   */
  loadBefore(
    timestampField: keyof T,
    beforeTimestamp: string,
    limit = 100
  ): { records: T[]; hasMore: boolean } {
    if (!this.isPersistent || !fs.existsSync(this.filePath)) {
      return { records: [], hasMore: false };
    }
    try {
      const content = fs.readFileSync(this.filePath, "utf8");
      const lines = content.trim().split("\n").filter(Boolean);
      const all = lines.flatMap((line) => {
        try {
          return [JSON.parse(line) as T];
        } catch {
          return [];
        }
      });
      const filtered = all.filter((r) => {
        const ts = r[timestampField];
        return typeof ts === "string" && ts < beforeTimestamp;
      });
      const hasMore = filtered.length > limit;
      const records = filtered.slice(-limit);
      return { records, hasMore };
    } catch (err) {
      this.onError("JsonlStore: failed to load records", {
        error: String(err),
      });
      return { records: [], hasMore: false };
    }
  }

  /** Trim the file to maxLines asynchronously using tmp+rename for atomicity. */
  private trimAsync(): void {
    if (this.trimInProgress) {
      return;
    }
    this.trimInProgress = true;
    setImmediate(() => {
      try {
        const content = fs.readFileSync(this.filePath, "utf8");
        const lines = content.trim().split("\n").filter(Boolean);
        if (lines.length <= this.maxLines) {
          this.lineCount = lines.length;
          this.trimInProgress = false;
          return;
        }
        const kept = lines.slice(-this.maxLines);
        const tmpPath = `${this.filePath}.tmp`;
        fs.writeFileSync(tmpPath, `${kept.join("\n")}\n`, "utf8");
        fs.renameSync(tmpPath, this.filePath);
        this.lineCount = this.maxLines;
      } catch (err) {
        this.onError("JsonlStore: trim failed", { error: String(err) });
      } finally {
        this.trimInProgress = false;
      }
    });
  }
}
