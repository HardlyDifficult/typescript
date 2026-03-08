import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Throttle, throttle } from "../src/Throttle";

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
    it("should throw for non-positive perSecond", () => {
      expect(() => new Throttle({ perSecond: 0 })).toThrow(
        "positive perSecond"
      );
      expect(() => new Throttle({ perSecond: -10 })).toThrow(
        "positive perSecond"
      );
      expect(() => new Throttle({ perSecond: NaN })).toThrow(
        "positive perSecond"
      );
    });

    it("should accept positive perSecond", () => {
      expect(() => new Throttle({ perSecond: 100 })).not.toThrow();
      expect(() => new Throttle({ perSecond: 0.5 })).not.toThrow();
    });

    it("creates throttles through the factory", () => {
      expect(() => throttle({ perSecond: 100 })).not.toThrow();
    });
  });

  describe("wait with default weight", () => {
    it("should resolve immediately on first call", async () => {
      const onDelay = vi.fn();
      const throttle = new Throttle({ perSecond: 1, onDelay });

      await throttle.wait();

      expect(onDelay).not.toHaveBeenCalled();
    });

    it("should delay subsequent calls", async () => {
      const onDelay = vi.fn();
      const throttle = new Throttle({ perSecond: 1, onDelay });

      const promise1 = throttle.wait();
      await vi.runAllTimersAsync();
      await promise1;

      const promise2 = throttle.wait();
      expect(onDelay).toHaveBeenCalledWith(
        1000,
        expect.objectContaining({ weight: 1 })
      );

      await vi.runAllTimersAsync();
      await promise2;
    });

    it("should handle concurrent calls in sequence", async () => {
      const onDelay = vi.fn();
      const throttle = new Throttle({ perSecond: 10, onDelay });

      const promises = [throttle.wait(), throttle.wait(), throttle.wait()];

      await vi.runAllTimersAsync();
      await Promise.all(promises);

      expect(onDelay).toHaveBeenCalledTimes(2);
    });
  });

  describe("wait with explicit weight", () => {
    it("should not delay when weight is 0", async () => {
      const onDelay = vi.fn();
      const throttle = new Throttle({ perSecond: 100, onDelay });

      await throttle.wait(0);

      expect(onDelay).not.toHaveBeenCalled();
    });

    it("should not delay when weight is negative", async () => {
      const onDelay = vi.fn();
      const throttle = new Throttle({ perSecond: 100, onDelay });

      await throttle.wait(-10);

      expect(onDelay).not.toHaveBeenCalled();
    });

    it("should calculate delay based on weight / perSecond", async () => {
      const onDelay = vi.fn();
      const throttle = new Throttle({ perSecond: 10, onDelay });

      const promise1 = throttle.wait(10);
      await vi.runAllTimersAsync();
      await promise1;

      const promise2 = throttle.wait(10);
      expect(onDelay).toHaveBeenCalledWith(
        1000,
        expect.objectContaining({ weight: 10 })
      );

      await vi.runAllTimersAsync();
      await promise2;
    });

    it("should call onDelay with correct info", async () => {
      const onDelay = vi.fn();
      const throttle = new Throttle({ perSecond: 50, onDelay });

      await throttle.wait(25);
      await vi.runAllTimersAsync();

      const promise = throttle.wait(25);

      expect(onDelay).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          weight: 25,
          perSecond: 50,
          scheduledStart: expect.any(Number),
        })
      );

      await vi.runAllTimersAsync();
      await promise;
    });

    it("should queue multiple waits correctly", async () => {
      const delays: number[] = [];
      const onDelay = vi.fn((ms: number) => delays.push(ms));
      const throttle = new Throttle({ perSecond: 10, onDelay });

      const promise1 = throttle.wait(10);
      await vi.runAllTimersAsync();
      await promise1;

      const promise2 = throttle.wait(10);
      await vi.runAllTimersAsync();
      await promise2;

      const promise3 = throttle.wait(10);
      await vi.runAllTimersAsync();
      await promise3;

      expect(delays).toEqual([1000, 1000]);
    });

    it("runs tasks after waiting", async () => {
      const task = vi.fn().mockResolvedValue("ok");
      const throttle = new Throttle({ perSecond: 1 });

      const first = throttle.run(task);
      await vi.runAllTimersAsync();
      await expect(first).resolves.toBe("ok");

      const second = throttle.run(task, 1);
      expect(task).toHaveBeenCalledTimes(1);

      await vi.runAllTimersAsync();
      await expect(second).resolves.toBe("ok");
      expect(task).toHaveBeenCalledTimes(2);
    });
  });

  describe("persistence", () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it("should persist state when a name is provided", async () => {
      const throttle = new Throttle({
        perSecond: 100,
        name: "test-throttle",
        stateDirectory: testDir,
      });

      await throttle.wait(100);

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
        perSecond: 10,
        name: "persist-test",
        stateDirectory: testDir,
      });

      await throttle1.wait(10);

      const throttle2 = new Throttle({
        perSecond: 10,
        name: "persist-test",
        stateDirectory: testDir,
      });

      const startTime = Date.now();
      await throttle2.wait(10);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(800);
    });

    it("should use storageAdapter when provided", async () => {
      const store = new Map<string, string>();
      const adapter = {
        async read(key: string) {
          return store.get(key) ?? null;
        },
        async write(key: string, value: string) {
          store.set(key, value);
        },
      };

      const throttle = new Throttle({
        perSecond: 100,
        name: "adapter-throttle",
        storageAdapter: adapter,
      });

      await throttle.wait(100);

      expect(store.has("adapter-throttle")).toBe(true);
      const saved = JSON.parse(store.get("adapter-throttle")!) as Record<
        string,
        unknown
      >;
      expect(typeof saved.value).toBe("number");
    });
  });

  describe("with real timers", () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it("should actually delay execution", async () => {
      const throttle = new Throttle({ perSecond: 100 });

      await throttle.wait(10);

      const startTime = Date.now();
      await throttle.wait(10);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(80);
      expect(elapsed).toBeLessThan(200);
    });
  });
});
