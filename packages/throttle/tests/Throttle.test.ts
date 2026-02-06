import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Throttle } from "../src/Throttle";

describe("Throttle", () => {
  let testDir: string;

  beforeEach(() => {
    vi.useFakeTimers();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "throttle-test-"));
  });

  afterEach(() => {
    vi.useRealTimers();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("constructor", () => {
    it("should reject non-positive minimumDelay", () => {
      expect(
        () => new Throttle({ minimumDelay: { value: 0, unit: "seconds" } })
      ).toThrow("minimumDelay must be a positive duration");
      expect(
        () =>
          new Throttle({ minimumDelay: { value: -100, unit: "milliseconds" } })
      ).toThrow("minimumDelay must be a positive duration");
    });
  });

  describe("wait", () => {
    it("should resolve immediately on first call", async () => {
      const throttle = new Throttle({
        minimumDelay: { value: 1, unit: "seconds" },
      });
      const onSleep = vi.fn();
      const throttleWithCallback = new Throttle({
        minimumDelay: { value: 1, unit: "seconds" },
        onSleep,
      });

      await throttle.wait();
      await throttleWithCallback.wait();

      expect(onSleep).not.toHaveBeenCalled();
    });

    it("should delay subsequent calls by minimumDelay", async () => {
      const onSleep = vi.fn();
      const throttle = new Throttle({
        minimumDelay: { value: 1, unit: "seconds" },
        onSleep,
      });

      const promise1 = throttle.wait();
      await vi.runAllTimersAsync();
      await promise1;
      expect(onSleep).not.toHaveBeenCalled();

      const promise2 = throttle.wait();
      expect(onSleep).toHaveBeenCalledWith(1000);

      await vi.runAllTimersAsync();
      await promise2;
    });

    it("should call onSleep callback with delay duration", async () => {
      const onSleep = vi.fn();
      const throttle = new Throttle({
        minimumDelay: { value: 500, unit: "milliseconds" },
        onSleep,
      });

      await throttle.wait();
      expect(onSleep).not.toHaveBeenCalled();

      const promise = throttle.wait();
      expect(onSleep).toHaveBeenCalledWith(500);

      await vi.runAllTimersAsync();
      await promise;
    });

    it("should handle concurrent calls in sequence", async () => {
      const onSleep = vi.fn();
      const throttle = new Throttle({
        minimumDelay: { value: 100, unit: "milliseconds" },
        onSleep,
      });

      const promises = [throttle.wait(), throttle.wait(), throttle.wait()];

      await vi.runAllTimersAsync();
      await Promise.all(promises);

      expect(onSleep).toHaveBeenCalledTimes(2);
    });

    it("should accept friendly time units like minutes", async () => {
      const onSleep = vi.fn();
      const throttle = new Throttle({
        minimumDelay: { value: 1.5, unit: "minutes" },
        onSleep,
      });

      const promise1 = throttle.wait();
      await vi.runAllTimersAsync();
      await promise1;

      const promise2 = throttle.wait();
      expect(onSleep).toHaveBeenCalledWith(90_000);

      await vi.runAllTimersAsync();
      await promise2;
    });
  });

  describe("persistence", () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it("should persist state when persistKey provided", async () => {
      const throttle = new Throttle({
        minimumDelay: { value: 1, unit: "seconds" },
        persistKey: "test-throttle",
        stateDirectory: testDir,
      });

      await throttle.wait();

      const stateFile = path.join(testDir, "test-throttle.json");
      expect(fs.existsSync(stateFile)).toBe(true);

      const content = JSON.parse(fs.readFileSync(stateFile, "utf-8")) as Record<
        string,
        unknown
      >;
      expect(content.value).toBeGreaterThan(Date.now() - 5000);
    });

    it("should resume from persisted state after restart", async () => {
      const throttle1 = new Throttle({
        minimumDelay: { value: 1, unit: "seconds" },
        persistKey: "persist-test",
        stateDirectory: testDir,
      });

      await throttle1.wait();

      const onSleep = vi.fn();
      const throttle2 = new Throttle({
        minimumDelay: { value: 1, unit: "seconds" },
        persistKey: "persist-test",
        stateDirectory: testDir,
        onSleep,
      });

      const startTime = Date.now();
      await throttle2.wait();
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(800);
    });
  });

  describe("with real timers", () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it("should actually delay execution", async () => {
      const throttle = new Throttle({
        minimumDelay: { value: 50, unit: "milliseconds" },
      });

      await throttle.wait();

      const startTime = Date.now();

      await throttle.wait();

      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });
});
