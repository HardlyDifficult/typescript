import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiscordPlugin } from "../src/plugins/DiscordPlugin.js";
import type { LogEntry } from "../src/types.js";

function makeEntry(
  level: LogEntry["level"],
  message: string,
  context?: Record<string, unknown>
): LogEntry {
  return {
    level,
    message,
    timestamp: "2025-01-15T10:30:00.000Z",
    ...(context !== undefined ? { context } : {}),
  };
}

describe("DiscordPlugin", () => {
  let plugin: DiscordPlugin;
  let sender: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    plugin = new DiscordPlugin();
    sender = vi.fn();
  });

  describe("before setSender", () => {
    it("does nothing for warn entries", () => {
      plugin.log(makeEntry("warn", "test"));
      // No error thrown, no sender called
    });

    it("does nothing for notify", () => {
      plugin.notify!("test");
      // No error thrown
    });
  });

  describe("level filtering", () => {
    beforeEach(() => {
      plugin.setSender(sender);
    });

    it("does not send debug entries", () => {
      plugin.log(makeEntry("debug", "test"));
      expect(sender).not.toHaveBeenCalled();
    });

    it("does not send info entries", () => {
      plugin.log(makeEntry("info", "test"));
      expect(sender).not.toHaveBeenCalled();
    });

    it("sends warn entries", () => {
      plugin.log(makeEntry("warn", "test"));
      expect(sender).toHaveBeenCalledOnce();
    });

    it("sends error entries", () => {
      plugin.log(makeEntry("error", "test"));
      expect(sender).toHaveBeenCalledOnce();
    });
  });

  describe("formatting", () => {
    beforeEach(() => {
      plugin.setSender(sender);
    });

    it("formats warn with warning emoji and bold level", () => {
      plugin.log(makeEntry("warn", "something bad"));
      const msg = sender.mock.calls[0][0] as string;
      expect(msg).toBe("\u{26a0}\u{fe0f} **WARN**: something bad");
    });

    it("formats error with siren emoji and bold level", () => {
      plugin.log(makeEntry("error", "critical failure"));
      const msg = sender.mock.calls[0][0] as string;
      expect(msg).toBe("\u{1f6a8} **ERROR**: critical failure");
    });

    it("includes JSON code block when context is present", () => {
      plugin.log(makeEntry("error", "with context", { key: "value" }));
      const msg = sender.mock.calls[0][0] as string;
      expect(msg).toContain("```json\n");
      expect(msg).toContain('"key": "value"');
      expect(msg).toContain("```");
    });

    it("does not include code block when context is empty", () => {
      plugin.log(makeEntry("warn", "no context", {}));
      const msg = sender.mock.calls[0][0] as string;
      expect(msg).not.toContain("```");
    });
  });

  describe("notify", () => {
    it("sends message directly via sender", () => {
      plugin.setSender(sender);
      plugin.notify!("direct notification");
      expect(sender).toHaveBeenCalledWith("direct notification");
    });
  });

  describe("error swallowing", () => {
    it("swallows sender errors in log", () => {
      const throwingSender = vi.fn(() => {
        throw new Error("discord down");
      });
      plugin.setSender(throwingSender);
      expect(() =>
        plugin.log(makeEntry("error", "should not throw"))
      ).not.toThrow();
    });

    it("swallows sender errors in notify", () => {
      const throwingSender = vi.fn(() => {
        throw new Error("discord down");
      });
      plugin.setSender(throwingSender);
      expect(() => plugin.notify!("should not throw")).not.toThrow();
    });
  });
});
