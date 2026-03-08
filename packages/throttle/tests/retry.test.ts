import { afterEach, describe, it, expect, vi } from "vitest";
import { retry } from "../src/retry";

describe("retry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return the result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await retry(fn, { attempts: 3 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on failure and succeed", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("ok");

    const result = await retry(fn, { attempts: 3 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("should throw the last error after exhausting attempts", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"));

    await expect(retry(fn, { attempts: 2 })).rejects.toThrow("fail 2");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should call onRetry between attempts", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"))
      .mockResolvedValue("ok");

    await retry(fn, { attempts: 3, onRetry });

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ attempt: 1, delayMs: 0, retriesLeft: 2 })
    );
    expect(onRetry).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ attempt: 2, delayMs: 0, retriesLeft: 1 })
    );
  });

  it("should not call onRetry on the final failure", async () => {
    const onRetry = vi.fn();
    const fn = vi.fn().mockRejectedValue(new Error("always fails"));

    await expect(retry(fn, { attempts: 2, onRetry })).rejects.toThrow(
      "always fails"
    );
    // Only called after attempt 1, not after attempt 2 (the final one)
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ attempt: 1, delayMs: 0, retriesLeft: 1 })
    );
  });

  it("should wrap non-Error throws in an Error", async () => {
    const fn = vi.fn().mockRejectedValue("string error");

    await expect(retry(fn, { attempts: 1 })).rejects.toThrow("string error");
  });

  it("should work with attempts of 1 (no retry)", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(retry(fn, { attempts: 1 })).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("supports built-in exponential backoff", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    const promise = retry(fn, {
      attempts: 2,
      backoff: { initialDelayMs: 250, maxDelayMs: 250 },
    });

    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(249);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("supports fixed retry delays", async () => {
    vi.useFakeTimers();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    const promise = retry(fn, { attempts: 2, backoff: 100 });

    await vi.advanceTimersByTimeAsync(99);
    expect(fn).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("stops retrying when the predicate says not to", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    const when = vi.fn().mockResolvedValue(false);

    await expect(
      retry(fn, { attempts: 3, when, backoff: true })
    ).rejects.toThrow("fail");

    expect(fn).toHaveBeenCalledTimes(1);
    expect(when).toHaveBeenCalledWith(expect.any(Error), 1);
  });

  it("validates attempts", async () => {
    await expect(retry(async () => "ok", { attempts: 0 })).rejects.toThrow(
      "positive integer"
    );
  });

  it("supports async onRetry hooks", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValue("ok");

    const delays: number[] = [];
    const result = await retry(fn, {
      attempts: 2,
      onRetry: async (_error, info) => {
        delays.push(info.attempt);
      },
    });

    expect(result).toBe("ok");
    expect(delays).toEqual([1]);
  });
});
