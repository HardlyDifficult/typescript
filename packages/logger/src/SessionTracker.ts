import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";

import { MILLISECONDS_PER_DAY } from "@hardlydifficult/date-time";

import type { SessionEntry, SessionEntryType, SessionInfo } from "./types.js";

export interface SessionTrackerOptions {
  /** Directory to store session JSONL files. */
  stateDirectory: string;
  /** Subdirectory within stateDirectory (default: "sessions"). */
  subdirectory?: string;
  /** Max age of session files before cleanup, in ms (default: 7 days). */
  maxAgeMs?: number;
}

const DEFAULT_SUBDIRECTORY = "sessions";
const DEFAULT_MAX_AGE_MS = 7 * MILLISECONDS_PER_DAY; // 7 days
const JSONL_EXTENSION = ".jsonl";

/**
 * Append-only session logger that writes structured entries to per-session JSONL files.
 *
 * Each session is stored as `{stateDirectory}/{subdirectory}/{sessionId}.jsonl`
 * with one JSON object per line. Designed for debug/analysis — capture full
 * AI interactions (prompts, responses, tool calls) and download via API.
 */
export class SessionTracker {
  private readonly directory: string;
  private readonly maxAgeMs: number;

  constructor(options: SessionTrackerOptions) {
    this.directory = join(
      options.stateDirectory,
      options.subdirectory ?? DEFAULT_SUBDIRECTORY
    );
    this.maxAgeMs = options.maxAgeMs ?? DEFAULT_MAX_AGE_MS;

    try {
      mkdirSync(this.directory, { recursive: true });
    } catch {
      /* swallow — directory may already exist or be unwritable */
    }
  }

  /** Append an entry to a session's JSONL file. Creates the file if needed. */
  append(
    sessionId: string,
    entry: { type: SessionEntryType; data: Record<string, unknown> }
  ): void {
    const fullEntry: SessionEntry = {
      type: entry.type,
      timestamp: new Date().toISOString(),
      data: entry.data,
    };
    const line = `${JSON.stringify(fullEntry)}\n`;
    try {
      appendFileSync(this.filePath(sessionId), line);
    } catch {
      /* swallow — same as FilePlugin */
    }
  }

  /** Read all entries for a session. Returns empty array if session doesn't exist. */
  read(sessionId: string): SessionEntry[] {
    const fp = this.filePath(sessionId);
    if (!existsSync(fp)) {
      return [];
    }
    try {
      const content = readFileSync(fp, "utf-8");
      return content
        .split("\n")
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as SessionEntry);
    } catch {
      return [];
    }
  }

  /** List all tracked sessions with metadata, sorted by lastModifiedAt descending. */
  list(): SessionInfo[] {
    if (!existsSync(this.directory)) {
      return [];
    }
    try {
      const files = readdirSync(this.directory).filter((f) =>
        f.endsWith(JSONL_EXTENSION)
      );
      const sessions: SessionInfo[] = [];

      for (const file of files) {
        const fp = join(this.directory, file);
        try {
          const stat = statSync(fp);
          const content = readFileSync(fp, "utf-8");
          const lines = content.split("\n").filter((l) => l.length > 0);

          let startedAt = stat.birthtime.toISOString();
          if (lines.length > 0) {
            try {
              const first = JSON.parse(lines[0]) as SessionEntry;
              startedAt = first.timestamp;
            } catch {
              /* use birthtime */
            }
          }

          sessions.push({
            sessionId: file.slice(0, -JSONL_EXTENSION.length),
            sizeBytes: stat.size,
            startedAt,
            lastModifiedAt: stat.mtime.toISOString(),
            entryCount: lines.length,
          });
        } catch {
          /* skip unreadable files */
        }
      }

      sessions.sort(
        (a, b) =>
          new Date(b.lastModifiedAt).getTime() -
          new Date(a.lastModifiedAt).getTime()
      );
      return sessions;
    } catch {
      return [];
    }
  }

  /** Check if a session file exists. */
  has(sessionId: string): boolean {
    return existsSync(this.filePath(sessionId));
  }

  /** Delete a specific session file. Returns true if deleted. */
  delete(sessionId: string): boolean {
    const fp = this.filePath(sessionId);
    if (!existsSync(fp)) {
      return false;
    }
    try {
      unlinkSync(fp);
      return true;
    } catch {
      return false;
    }
  }

  /** Delete session files older than maxAgeMs. Returns count of deleted files. */
  cleanup(): number {
    if (!existsSync(this.directory)) {
      return 0;
    }
    let deleted = 0;
    const cutoff = Date.now() - this.maxAgeMs;
    try {
      const files = readdirSync(this.directory).filter((f) =>
        f.endsWith(JSONL_EXTENSION)
      );
      for (const file of files) {
        const fp = join(this.directory, file);
        try {
          const stat = statSync(fp);
          if (stat.mtime.getTime() < cutoff) {
            unlinkSync(fp);
            deleted++;
          }
        } catch {
          /* skip */
        }
      }
    } catch {
      /* swallow */
    }
    return deleted;
  }

  private filePath(sessionId: string): string {
    return join(this.directory, `${sessionId}${JSONL_EXTENSION}`);
  }
}
