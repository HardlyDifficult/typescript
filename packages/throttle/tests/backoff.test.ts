import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getBackoffDelay, sleep, getRandomDelay } from "../src/backoff";

describe("getBackoffDelay", () => {
  it("should use default options", () => {
    expect(getBackoffDelay(0)).toBe(1000);
    expect(getBackoffDelay(1)).toBe(2000);
    expect(getBackoffDelay(2)).toBe(4000);
    expect(getBackoffDelay(3)).toBe(8000);
  });

  it("should accept custom options", () => {
    const options = { initialDelayMs: 500, maxDelayMs: 10000 };
    expect(getBackoffDelay(0, options)).toBe(500);
    expect(getBackoffDelay(1, options)).toBe(1000);
    expect(getBackoffDelay(2, options)).toBe(2000);
    expect(getBackoffDelay(3, options)).toBe(4000);
  });

  it("should cap at maxDelay", () => {
    expect(getBackoffDelay(100)).toBe(60000);
    expect(getBackoffDelay(10, { initialDelayMs: 1000, maxDelayMs: 5000 })).toBe(5000);
  });
});

describe("sleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should resolve after the specified delay", async () => {
    const callback = vi.fn();
    const promise = sleep(1000).then(callback);

    expect(callback).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    await promise;

    expect(callback).toHaveBeenCalled();
  });
});

describe("getRandomDelay", () => {
  it("should return a value within the specified range", () => {
    for (let i = 0; i < 100; i++) {
      const result = getRandomDelay(100, 500);
      expect(result).toBeGreaterThanOrEqual(100);
      expect(result).toBeLessThanOrEqual(500);
    }
  });

  it("should return an integer", () => {
    for (let i = 0; i < 50; i++) {
      const result = getRandomDelay(1, 1000);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it("should return minMs when minMs equals maxMs", () => {
    expect(getRandomDelay(42, 42)).toBe(42);
  });
});
