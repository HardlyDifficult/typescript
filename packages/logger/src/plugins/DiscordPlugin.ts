import type { LogEntry, LoggerPlugin } from "../types.js";

export type DiscordSender = (message: string) => void;

export class DiscordPlugin implements LoggerPlugin {
  private sender: DiscordSender | null = null;

  setSender(sender: DiscordSender): void {
    this.sender = sender;
  }

  log(entry: LogEntry): void {
    if (!this.sender) {
      return;
    }
    if (entry.level !== "warn" && entry.level !== "error") {
      return;
    }

    const prefix = entry.level === "error" ? "\u{1f6a8}" : "\u{26a0}\u{fe0f}";
    const discordMessage =
      entry.context && Object.keys(entry.context).length > 0
        ? `${prefix} **${entry.level.toUpperCase()}**: ${entry.message}\n\`\`\`json\n${JSON.stringify(entry.context, null, 2)}\n\`\`\``
        : `${prefix} **${entry.level.toUpperCase()}**: ${entry.message}`;

    try {
      this.sender(discordMessage);
    } catch {
      /* swallow */
    }
  }

  notify(message: string): void {
    if (!this.sender) {
      return;
    }
    try {
      this.sender(message);
    } catch {
      /* swallow */
    }
  }
}
