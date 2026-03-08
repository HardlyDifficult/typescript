import { describe, it, expect, vi, beforeEach } from "vitest";
import { Logger } from "../src/Logger.js";
import type { LogEntry, LoggerPlugin } from "../src/types.js";

function createSpyPlugin(): LoggerPlugin & {
  log: ReturnType<typeof vi.fn>;
  alert: ReturnType<typeof vi.fn>;
} {
  return {
    log: vi.fn(),
    alert: vi.fn(),
  };
}

describe("Logger", () => {
  let logger: Logger;
  let plugin: ReturnType<typeof createSpyPlugin>;

  beforeEach(() => {
    logger = new Logger("info");
    plugin = createSpyPlugin();
    logger.use(plugin);
  });

  describe("level filtering", () => {
    it("filters debug messages when minLevel is info", () => {
      logger.debug("should be filtered");
      expect(plugin.log).not.toHaveBeenCalled();
    });

    it("passes info messages when minLevel is info", () => {
      logger.info("hello");
      expect(plugin.log).toHaveBeenCalledOnce();
      expect(plugin.log.mock.calls[0][0].level).toBe("info");
      expect(plugin.log.mock.calls[0][0].message).toBe("hello");
    });

    it("passes warn messages when minLevel is info", () => {
      logger.warn("warning");
      expect(plugin.log).toHaveBeenCalledOnce();
      expect(plugin.log.mock.calls[0][0].level).toBe("warn");
    });

    it("passes error messages when minLevel is info", () => {
      logger.error("error");
      expect(plugin.log).toHaveBeenCalledOnce();
      expect(plugin.log.mock.calls[0][0].level).toBe("error");
    });

    it("passes debug messages when minLevel is debug", () => {
      const debugLogger = new Logger("debug");
      debugLogger.use(plugin);
      debugLogger.debug("debug msg");
      expect(plugin.log).toHaveBeenCalledOnce();
      expect(plugin.log.mock.calls[0][0].level).toBe("debug");
    });

    it("filters info and debug when minLevel is warn", () => {
      const warnLogger = new Logger("warn");
      warnLogger.use(plugin);
      warnLogger.debug("filtered");
      warnLogger.info("filtered");
      expect(plugin.log).not.toHaveBeenCalled();
      warnLogger.warn("passed");
      expect(plugin.log).toHaveBeenCalledOnce();
    });
  });

  describe("plugin receives log entries", () => {
    it("provides a well-formed LogEntry", () => {
      logger.info("test message", { key: "value" });
      expect(plugin.log).toHaveBeenCalledOnce();
      const entry: LogEntry = plugin.log.mock.calls[0][0];
      expect(entry.level).toBe("info");
      expect(entry.message).toBe("test message");
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(entry.context).toEqual({ key: "value" });
    });

    it("omits context when not provided", () => {
      logger.info("no context");
      const entry: LogEntry = plugin.log.mock.calls[0][0];
      expect(entry.context).toBeUndefined();
    });

    it("normalizes errors, bigint values, and circular references", () => {
      const error = new Error("boom");
      const circular: Record<string, unknown> = { name: "loop" };
      circular.self = circular;

      logger.error("failed", {
        error,
        attempts: 2n,
        circular,
      });

      const entry: LogEntry = plugin.log.mock.calls[0][0];
      expect(entry.context).toMatchObject({
        attempts: "2",
        circular: {
          name: "loop",
          self: "[Circular]",
        },
        error: {
          message: "boom",
          name: "Error",
        },
      });
    });
  });

  describe("child", () => {
    it("merges bound context with per-call context", () => {
      const scoped = logger.child({
        service: "billing",
        region: "us-east-1",
      });
      scoped.info("charged", { orderId: "ord-123" });

      const entry: LogEntry = plugin.log.mock.calls[0][0];
      expect(entry.context).toEqual({
        service: "billing",
        region: "us-east-1",
        orderId: "ord-123",
      });
    });

    it("does not mutate the parent logger context", () => {
      const scoped = logger.child({ service: "billing" });
      scoped.info("scoped");
      logger.info("plain");

      const scopedEntry: LogEntry = plugin.log.mock.calls[0][0];
      const plainEntry: LogEntry = plugin.log.mock.calls[1][0];

      expect(scopedEntry.context).toEqual({ service: "billing" });
      expect(plainEntry.context).toBeUndefined();
    });
  });

  describe("multiple plugins", () => {
    it("all plugins receive entries", () => {
      const plugin2 = createSpyPlugin();
      logger.use(plugin2);
      logger.info("broadcast");
      expect(plugin.log).toHaveBeenCalledOnce();
      expect(plugin2.log).toHaveBeenCalledOnce();
    });
  });

  describe("error swallowing", () => {
    it("one broken plugin does not affect others", () => {
      const brokenPlugin: LoggerPlugin = {
        log: vi.fn(() => {
          throw new Error("boom");
        }),
      };
      const goodPlugin = createSpyPlugin();

      const safeLogger = new Logger("info");
      safeLogger.use(brokenPlugin);
      safeLogger.use(goodPlugin);

      safeLogger.info("test");
      expect(goodPlugin.log).toHaveBeenCalledOnce();
    });

    it("swallows notify errors", () => {
      const brokenPlugin: LoggerPlugin = {
        log: vi.fn(),
        alert: vi.fn(() => {
          throw new Error("boom");
        }),
      };
      const goodPlugin = createSpyPlugin();

      const safeLogger = new Logger("info");
      safeLogger.use(brokenPlugin);
      safeLogger.use(goodPlugin);

      expect(() => safeLogger.alert("test")).not.toThrow();
      expect(goodPlugin.alert).toHaveBeenCalledOnce();
    });
  });

  describe("alert", () => {
    it("calls plugin.alert with the message", () => {
      logger.alert("hello discord");
      expect(plugin.alert).toHaveBeenCalledWith("hello discord");
    });

    it("keeps notify as a compatibility alias", () => {
      logger.notify("legacy");
      expect(plugin.alert).toHaveBeenCalledWith("legacy");
    });

    it("skips plugins without alert", () => {
      const noAlertPlugin: LoggerPlugin = { log: vi.fn() };
      const alertLogger = new Logger("info");
      alertLogger.use(noAlertPlugin);
      expect(() => alertLogger.alert("test")).not.toThrow();
    });
  });

  describe("use() chaining", () => {
    it("returns this for chaining", () => {
      const freshLogger = new Logger("info");
      const result = freshLogger.use(plugin);
      expect(result).toBe(freshLogger);
    });

    it("supports chaining multiple plugins", () => {
      const plugin2 = createSpyPlugin();
      const freshLogger = new Logger("info");
      freshLogger.use(plugin).use(plugin2);
      freshLogger.info("chained");
      expect(plugin.log).toHaveBeenCalledOnce();
      expect(plugin2.log).toHaveBeenCalledOnce();
    });
  });
});
