import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Throttle } from '../src/Throttle';

describe('Throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should reject non-positive minimumDelayMs', () => {
      expect(() => new Throttle({ minimumDelayMs: 0 })).toThrow(
        'minimumDelayMs must be a positive number',
      );
      expect(() => new Throttle({ minimumDelayMs: -100 })).toThrow(
        'minimumDelayMs must be a positive number',
      );
    });
  });

  describe('run', () => {
    it('should execute task immediately on first call', async () => {
      const throttle = new Throttle({ minimumDelayMs: 1000 });
      const task = vi.fn().mockResolvedValue('result');

      const resultPromise = throttle.run(task);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(task).toHaveBeenCalledTimes(1);
      expect(result).toBe('result');
    });

    it('should delay subsequent calls by minimumDelayMs', async () => {
      const throttle = new Throttle({ minimumDelayMs: 1000 });
      const task1 = vi.fn().mockResolvedValue('first');
      const task2 = vi.fn().mockResolvedValue('second');

      // First call
      const promise1 = throttle.run(task1);
      await vi.runAllTimersAsync();
      await promise1;

      // Second call should be delayed
      const promise2 = throttle.run(task2);

      // Task should not be called yet
      expect(task2).not.toHaveBeenCalled();

      // Advance time
      await vi.advanceTimersByTimeAsync(1000);
      await promise2;

      expect(task2).toHaveBeenCalledTimes(1);
    });

    it('should call onSleep callback with delay duration', async () => {
      const onSleep = vi.fn();
      const throttle = new Throttle({ minimumDelayMs: 500, onSleep });
      const task = vi.fn().mockResolvedValue(undefined);

      // First call - no sleep
      const promise1 = throttle.run(task);
      await vi.runAllTimersAsync();
      await promise1;
      expect(onSleep).not.toHaveBeenCalled();

      // Second call - should sleep
      const promise2 = throttle.run(task);
      expect(onSleep).toHaveBeenCalledWith(500);

      await vi.runAllTimersAsync();
      await promise2;
    });

    it('should return task result correctly', async () => {
      const throttle = new Throttle({ minimumDelayMs: 100 });
      const task = vi.fn().mockResolvedValue({ data: 'test', count: 42 });

      const resultPromise = throttle.run(task);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result).toEqual({ data: 'test', count: 42 });
    });

    it('should propagate task errors', async () => {
      vi.useRealTimers(); // Use real timers to avoid unhandled rejection timing issues
      const throttle = new Throttle({ minimumDelayMs: 10 });
      const error = new Error('Task failed');
      const task = vi.fn().mockRejectedValue(error);

      await expect(throttle.run(task)).rejects.toThrow('Task failed');
      vi.useFakeTimers(); // Restore fake timers for other tests
    });

    it('should handle concurrent calls in sequence', async () => {
      const throttle = new Throttle({ minimumDelayMs: 100 });
      const results: number[] = [];
      const tasks = [
        vi.fn().mockImplementation(async () => {
          results.push(1);
          return 1;
        }),
        vi.fn().mockImplementation(async () => {
          results.push(2);
          return 2;
        }),
        vi.fn().mockImplementation(async () => {
          results.push(3);
          return 3;
        }),
      ];

      // Start all tasks at once
      const promises = tasks.map((task) => throttle.run(task));

      // Run all timers
      await vi.runAllTimersAsync();
      await Promise.all(promises);

      // All tasks should have completed in order
      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe('with real timers', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it('should actually delay execution', async () => {
      const throttle = new Throttle({ minimumDelayMs: 50 });
      const task = vi.fn().mockResolvedValue('done');

      // First call
      await throttle.run(task);

      // Record time
      const startTime = Date.now();

      // Second call should be delayed
      await throttle.run(task);

      const elapsed = Date.now() - startTime;
      // Allow some tolerance for timing
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });
});
