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

  describe('wait', () => {
    it('should resolve immediately on first call', async () => {
      const throttle = new Throttle({ minimumDelayMs: 1000 });
      const onSleep = vi.fn();
      const throttleWithCallback = new Throttle({ minimumDelayMs: 1000, onSleep });

      await throttle.wait();
      await throttleWithCallback.wait();

      expect(onSleep).not.toHaveBeenCalled();
    });

    it('should delay subsequent calls by minimumDelayMs', async () => {
      const onSleep = vi.fn();
      const throttle = new Throttle({ minimumDelayMs: 1000, onSleep });

      // First call - no delay
      const promise1 = throttle.wait();
      await vi.runAllTimersAsync();
      await promise1;
      expect(onSleep).not.toHaveBeenCalled();

      // Second call should be delayed
      const promise2 = throttle.wait();
      expect(onSleep).toHaveBeenCalledWith(1000);

      await vi.runAllTimersAsync();
      await promise2;
    });

    it('should call onSleep callback with delay duration', async () => {
      const onSleep = vi.fn();
      const throttle = new Throttle({ minimumDelayMs: 500, onSleep });

      // First call - no sleep
      await throttle.wait();
      expect(onSleep).not.toHaveBeenCalled();

      // Second call - should sleep
      const promise = throttle.wait();
      expect(onSleep).toHaveBeenCalledWith(500);

      await vi.runAllTimersAsync();
      await promise;
    });

    it('should handle concurrent calls in sequence', async () => {
      const onSleep = vi.fn();
      const throttle = new Throttle({ minimumDelayMs: 100, onSleep });

      // Start all waits at once
      const promises = [throttle.wait(), throttle.wait(), throttle.wait()];

      // Run all timers
      await vi.runAllTimersAsync();
      await Promise.all(promises);

      // Should have slept twice (second and third calls)
      expect(onSleep).toHaveBeenCalledTimes(2);
    });
  });

  describe('with real timers', () => {
    beforeEach(() => {
      vi.useRealTimers();
    });

    it('should actually delay execution', async () => {
      const throttle = new Throttle({ minimumDelayMs: 50 });

      // First call
      await throttle.wait();

      // Record time
      const startTime = Date.now();

      // Second call should be delayed
      await throttle.wait();

      const elapsed = Date.now() - startTime;
      // Allow some tolerance for timing
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });
});
