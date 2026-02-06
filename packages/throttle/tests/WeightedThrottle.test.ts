import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WeightedThrottle } from '../src/WeightedThrottle';

describe('WeightedThrottle', () => {
  let testDir: string;

  beforeEach(() => {
    vi.useFakeTimers();
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'weighted-throttle-test-'));
  });

  afterEach(() => {
    vi.useRealTimers();
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should throw for non-positive unitsPerSecond', () => {
      expect(() => new WeightedThrottle({ unitsPerSecond: 0 })).toThrow('positive unitsPerSecond');
      expect(() => new WeightedThrottle({ unitsPerSecond: -10 })).toThrow(
        'positive unitsPerSecond',
      );
      expect(() => new WeightedThrottle({ unitsPerSecond: NaN })).toThrow(
        'positive unitsPerSecond',
      );
    });

    it('should accept positive unitsPerSecond', () => {
      expect(() => new WeightedThrottle({ unitsPerSecond: 100 })).not.toThrow();
      expect(() => new WeightedThrottle({ unitsPerSecond: 0.5 })).not.toThrow();
    });
  });

  describe('wait', () => {
    it('should not delay when weight is 0', async () => {
      const onSleep = vi.fn();
      const throttle = new WeightedThrottle({ unitsPerSecond: 100, onSleep });

      await throttle.wait(0);

      expect(onSleep).not.toHaveBeenCalled();
    });

    it('should not delay when weight is negative', async () => {
      const onSleep = vi.fn();
      const throttle = new WeightedThrottle({ unitsPerSecond: 100, onSleep });

      await throttle.wait(-10);

      expect(onSleep).not.toHaveBeenCalled();
    });

    it('should calculate delay based on weight / unitsPerSecond', async () => {
      const onSleep = vi.fn();
      const throttle = new WeightedThrottle({ unitsPerSecond: 10, onSleep });

      const promise1 = throttle.wait(10);
      await vi.runAllTimersAsync();
      await promise1;

      const promise2 = throttle.wait(10);
      expect(onSleep).toHaveBeenCalledWith(1000, expect.objectContaining({ weight: 10 }));

      await vi.runAllTimersAsync();
      await promise2;
    });

    it('should call onSleep with correct info', async () => {
      const onSleep = vi.fn();
      const throttle = new WeightedThrottle({ unitsPerSecond: 50, onSleep });

      await throttle.wait(25);
      await vi.runAllTimersAsync();

      const promise = throttle.wait(25);

      expect(onSleep).toHaveBeenCalledWith(
        expect.any(Number),
        expect.objectContaining({
          weight: 25,
          limitPerSecond: 50,
          scheduledStart: expect.any(Number),
        }),
      );

      await vi.runAllTimersAsync();
      await promise;
    });

    it('should queue multiple waits correctly', async () => {
      const delays: number[] = [];
      const onSleep = vi.fn((ms: number) => delays.push(ms));
      const throttle = new WeightedThrottle({ unitsPerSecond: 10, onSleep });

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
  });

  describe('persistence', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    afterEach(() => {
      vi.useFakeTimers();
    });

    it('should persist state when persistKey provided', async () => {
      const throttle = new WeightedThrottle({
        unitsPerSecond: 100,
        persistKey: 'test-throttle',
        stateDirectory: testDir,
      });

      await throttle.wait(100);

      const stateFile = path.join(testDir, 'test-throttle.json');
      expect(fs.existsSync(stateFile)).toBe(true);

      const content = JSON.parse(fs.readFileSync(stateFile, 'utf-8')) as Record<string, unknown>;
      expect(content.value).toBeGreaterThan(Date.now() - 5000);
    });

    it('should resume from persisted state after restart', async () => {
      const throttle1 = new WeightedThrottle({
        unitsPerSecond: 10,
        persistKey: 'persist-test',
        stateDirectory: testDir,
      });

      await throttle1.wait(10);

      const onSleep = vi.fn();
      const throttle2 = new WeightedThrottle({
        unitsPerSecond: 10,
        persistKey: 'persist-test',
        stateDirectory: testDir,
        onSleep,
      });

      const startTime = Date.now();
      await throttle2.wait(10);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(800);
    });
  });

  describe('with real timers', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it('should actually delay execution based on weight', async () => {
      const throttle = new WeightedThrottle({ unitsPerSecond: 100 });

      await throttle.wait(10);

      const startTime = Date.now();
      await throttle.wait(10);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeGreaterThanOrEqual(80);
      expect(elapsed).toBeLessThan(200);
    });
  });
});
