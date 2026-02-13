import { describe, it, expect, vi, beforeEach } from "vitest";
import { Logger } from "../src/Logger.js";
import type { LogEntry, LoggerPlugin } from "../src/types.js";

function createSpyPlugin(): LoggerPlugin & {
  log: ReturnType<typeof vi.fn>;
  notify: ReturnType<typeof vi.fn>;
} {
  return {
    log: vi.fn(),
    notify: vi.fn(),
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
        notify: vi.fn(() => {
          throw new Error("boom");
        }),
      };
      const goodPlugin = createSpyPlugin();

      const safeLogger = new Logger("info");
      safeLogger.use(brokenPlugin);
      safeLogger.use(goodPlugin);

      expect(() => safeLogger.notify("test")).not.toThrow();
      expect(goodPlugin.notify).toHaveBeenCalledOnce();
    });
  });

  describe("notify", () => {
    it("calls plugin.notify with the message", () => {
      logger.notify("hello discord");
      expect(plugin.notify).toHaveBeenCalledWith("hello discord");
    });

    it("skips plugins without notify", () => {
      const noNotifyPlugin: LoggerPlugin = { log: vi.fn() };
      const notifyLogger = new Logger("info");
      notifyLogger.use(noNotifyPlugin);
      expect(() => notifyLogger.notify("test")).not.toThrow();
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
