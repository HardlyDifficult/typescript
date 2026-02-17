import { describe, it, expect, vi } from "vitest";
import { retry } from "../src/retry";

describe("retry", () => {
  it("should return the result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retry(fn, { maxAttempts: 3 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and succeed", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("ok");

    const result = await retry(fn, { maxAttempts: 3 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw the last error after exhausting attempts", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"));

    await expect(retry(fn, { maxAttempts: 2 })).rejects.toThrow("fail 2");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should call onRetry between attempts", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("ok");

    await retry(fn, { maxAttempts: 3, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 2);
  });

  it("should not call onRetry on the final failure", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(retry(fn, { maxAttempts: 2, onRetry })).rejects.toThrow(
      "always fails"
    );
    // Only called after attempt 1, not after attempt 2 (the final one)
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  it("should wrap non-Error throws in an Error", async () => {
    const fn = vi.fn().mockRejectedValue("string error");

    await expect(retry(fn, { maxAttempts: 1 })).rejects.toThrow(
      "string error"
    );
  });

  it("should work with maxAttempts of 1 (no retry)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(retry(fn, { maxAttempts: 1 })).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should support async onRetry for adding delays", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    const delays: number[] = [];
    const result = await retry(fn, {
      maxAttempts: 2,
      onRetry: async (_error, attempt) => {
        delays.push(attempt);
      },
    });

    expect(result).toBe("ok");
    expect(delays).toEqual([1]);
  });
});
