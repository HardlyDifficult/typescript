import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import type { LogEntry, LoggerPlugin } from "../types.js";
import { safeJsonStringify } from "../serialize.js";

/** Logger plugin that appends JSON-serialized log entries to a file on disk. */
export class FilePlugin implements LoggerPlugin {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    try {
      mkdirSync(dirname(filePath), { recursive: true });
    } catch {
      /* swallow */
    }
  }

  log(entry: LogEntry): void {
    const line = `${safeJsonStringify(entry)}\n`;
    try {
      appendFileSync(this.filePath, line);
    } catch {
      /* swallow */
    }
  }
}
