import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { LogEntry, LoggerPlugin } from "../types.js";

export class FilePlugin implements LoggerPlugin {
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    mkdirSync(dirname(filePath), { recursive: true });
  }

  log(entry: LogEntry): void {
    const line = JSON.stringify(entry) + "\n";
    try {
      appendFileSync(this.filePath, line);
    } catch {
      /* swallow */
    }
  }
}
