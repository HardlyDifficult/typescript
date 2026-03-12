/**
 * Additional coverage tests for createXSocial.ts
 *
 * Targeting uncovered lines:
 * - line 70: getPost returns null when tweet data is not a valid tweet
 * - line 160: isTweet returns false when value is not an object
 * - line 168: readTweetList returns empty array when data is not an array
 * - line 176: isTweet returns false when id or text is not a string
 * - lines 259-274: sleep() with abort signal path (onAbort during sleep)
 * - line 104: watchLikes default interval (everyMs ?? DEFAULT_WATCH_INTERVAL_MS)
 * - line 154: normalizeTweets with includes.users undefined
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createSocial } from "../src/index.js";

const originalFetch = globalThis.fetch;
const originalToken = process.env.X_BEARER_TOKEN;

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;

  if (originalToken === undefined) {
    delete process.env.X_BEARER_TOKEN;
  } else {
    process.env.X_BEARER_TOKEN = originalToken;
  }
});

describe("createXSocial - additional coverage", () => {
  describe("getPost returns null for invalid tweet data", () => {
    it("returns null when response data is null", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: null }),
      });

      globalThis.fetch = fetchMock as typeof fetch;
      const social = createSocial({ token: "token" });

      const result = await social.post("123");

      // readSingleTweet(null) → isTweet(null) → typeof null === 'object' but null → false → return null
      expect(result).toBeNull();
    });

    it("returns null when response data is a non-object primitive (string)", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: "not-an-object" }),
      });

      globalThis.fetch = fetchMock as typeof fetch;
      const social = createSocial({ token: "token" });

      const result = await social.post("123");

      // isTweet("not-an-object"): typeof "not-an-object" !== "object" → false → null
      expect(result).toBeNull();
    });

    it("returns null when response data is a number", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: 42 }),
      });

      globalThis.fetch = fetchMock as typeof fetch;
      const social = createSocial({ token: "token" });

      const result = await social.post("123");

      // isTweet(42): typeof 42 !== "object" → false → null
      expect(result).toBeNull();
    });

    it("returns null when response data is an object with numeric id (not string)", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { id: 123, text: "hello" }, // id is number, not string
        }),
      });

      globalThis.fetch = fetchMock as typeof fetch;
      const social = createSocial({ token: "token" });

      const result = await social.post("123");

      // isTweet: typeof id !== "string" → false → null
      expect(result).toBeNull();
    });

    it("returns null when response data object has no id field", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { text: "hello" }, // missing id
        }),
      });

      globalThis.fetch = fetchMock as typeof fetch;
      const social = createSocial({ token: "token" });

      const result = await social.post("123");

      expect(result).toBeNull();
    });
  });

  describe("normalizeTweets and readTweetList edge cases", () => {
    it("timeline returns empty array when response data is not an array (object)", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { id: "123", text: "not-an-array" }, // object, not array
        }),
      });

      globalThis.fetch = fetchMock as typeof fetch;
      const social = createSocial({ token: "token" });

      const result = await social.timeline();

      // readTweetList: !Array.isArray(object) → return []
      expect(result).toEqual([]);
    });

    it("timeline returns empty array when response data is null", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: null }),
      });

      globalThis.fetch = fetchMock as typeof fetch;
      const social = createSocial({ token: "token" });

      const result = await social.timeline();

      expect(result).toEqual([]);
    });

    it("timeline returns empty array when response data is a string", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: "invalid" }),
      });

      globalThis.fetch = fetchMock as typeof fetch;
      const social = createSocial({ token: "token" });

      const result = await social.timeline();

      expect(result).toEqual([]);
    });

    it("timeline filters out invalid tweet objects in array", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: "valid-1", text: "valid tweet" },
            { id: 123, text: "invalid id type" }, // id is number → filtered out
            null, // null → typeof null === "object" but isTweet returns false
            "string item", // string → typeof !== "object" → filtered out
            { text: "missing id" }, // missing id → filtered out
          ],
          includes: { users: [] },
        }),
      });

      globalThis.fetch = fetchMock as typeof fetch;
      const social = createSocial({ token: "token" });

      const result = await social.timeline();

      // Only the first item is valid
      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("valid-1");
    });

    it("normalizeTweets handles includes with users=undefined (uses [] fallback)", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "123", text: "hello", author_id: "u1" }],
          includes: {
            // users property is missing/undefined - covers ?? [] branch (line 154)
          },
        }),
      });

      globalThis.fetch = fetchMock as typeof fetch;
      const social = createSocial({ token: "token" });

      const result = await social.timeline();

      // Should still return the tweet, but author will be unknown
      expect(result).toHaveLength(1);
      expect(result[0]?.author.username).toBe("unknown");
    });
  });

  describe("normalizeTweet edge cases", () => {
    it("normalizes tweet without author info (no matching user)", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: "999",
            text: "orphan tweet",
            author_id: "unknown-author",
            created_at: "2025-01-01T00:00:00.000Z",
            public_metrics: {
              like_count: 0,
              reply_count: 0,
              retweet_count: 0,
            },
          },
          includes: {
            users: [], // No users
          },
        }),
      });

      globalThis.fetch = fetchMock as typeof fetch;
      const social = createSocial({ token: "token" });

      const result = await social.post("999");

      expect(result).not.toBeNull();
      expect(result?.author.id).toBe("unknown-author");
      expect(result?.author.username).toBe("unknown");
      expect(result?.url).toBe("https://x.com/i/status/999");
    });

    it("normalizes tweet without author_id", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            id: "888",
            text: "no author id",
            // No author_id field
          },
        }),
      });

      globalThis.fetch = fetchMock as typeof fetch;
      const social = createSocial({ token: "token" });

      const result = await social.post("888");

      expect(result).not.toBeNull();
      expect(result?.author.id).toBe("unknown");
      expect(result?.createdAt).toBe(new Date(0).toISOString());
      expect(result?.metrics.likes).toBe(0);
    });
  });

  describe("default watchLikes interval", () => {
    it("watchLikes uses DEFAULT_WATCH_INTERVAL_MS when no everyMs provided (covers ?? branch line 104)", async () => {
      vi.useFakeTimers();

      const controller = new AbortController();

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "1", text: "tweet" }],
          includes: { users: [{ id: "u1", username: "user", name: "User" }] },
        }),
      });

      globalThis.fetch = fetchMock as typeof fetch;

      const social = createSocial({ token: "token" });
      // Call watchLikes with empty options {} - everyMs is undefined
      // This covers the `?? DEFAULT_WATCH_INTERVAL_MS` branch on line 104
      const iterator = social
        .watchLikes({ signal: controller.signal })
        [Symbol.asyncIterator]();

      const nextProm = iterator.next();

      // Process the first fetch (seeding)
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      // Abort to clean up
      controller.abort();

      await Promise.resolve();
      await Promise.resolve();

      const result = await nextProm;
      expect(result.done).toBe(true);
      expect(fetchMock).toHaveBeenCalled();
    });
  });

  describe("sleep with abort signal (lines 259-274)", () => {
    it("sleep resolves false immediately when signal is already aborted before watchLikes starts", async () => {
      vi.useFakeTimers();

      const controller = new AbortController();
      controller.abort(); // Pre-aborted

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [],
          includes: { users: [] },
        }),
      });

      globalThis.fetch = fetchMock as typeof fetch;

      const social = createSocial({ token: "token" });
      const iterator = social
        .watchLikes({
          everyMs: 1000,
          signal: controller.signal,
        })
        [Symbol.asyncIterator]();

      // Signal is already aborted, so watchLikesStream loop should not run
      const result = await iterator.next();

      expect(result.done).toBe(true);
    });

    it("sleep with signal: abort fires during sleep (covers onAbort lines 272-274)", async () => {
      // This test specifically targets lines 272-274 (onAbort function body)
      // It requires the abort signal to fire AFTER sleep() starts but before the timer fires
      vi.useFakeTimers();

      const controller = new AbortController();

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ id: "seed", text: "tweet" }],
          includes: { users: [] },
        }),
      });

      globalThis.fetch = fetchMock as typeof fetch;

      const social = createSocial({ token: "token" });
      const iterator = social
        .watchLikes({
          everyMs: 100_000, // Long sleep so timer won't fire naturally
          signal: controller.signal,
        })
        [Symbol.asyncIterator]();

      const nextPromise = iterator.next();

      // Use multiple Promise.resolve() to fully drain the microtask queue
      // This allows the generator to: fetch → seed → enter sleep() with abort listener
      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
      }

      // Now abort the signal DURING the sleep - this fires onAbort (lines 272-274)
      // clearTimeout, removeEventListener, resolve(false)
      controller.abort();

      // Process the abort resolution through microtasks
      await Promise.resolve();
      await Promise.resolve();

      const result = await nextPromise;
      expect(result.done).toBe(true);
    });

    it("sleep with signal: timer fires normally before abort (covers onTimeout line 267-268)", async () => {
      vi.useFakeTimers();

      const controller = new AbortController();

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: "1", text: "seed" }],
            includes: { users: [] },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: "2", text: "new" },
              { id: "1", text: "seed" },
            ],
            includes: { users: [] },
          }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({
            data: [],
            includes: { users: [] },
          }),
        });

      globalThis.fetch = fetchMock as typeof fetch;

      const social = createSocial({ token: "token" });
      const iterator = social
        .watchLikes({
          everyMs: 1_000,
          signal: controller.signal,
        })
        [Symbol.asyncIterator]();

      // Get first notification (seed first, then get new like)
      const firstNext = iterator.next();
      await vi.runAllTicks();

      // Advance timer to trigger onTimeout (sleep resolves true)
      await vi.advanceTimersByTimeAsync(1_000);

      const firstResult = await firstNext;
      expect(firstResult.done).toBe(false);
      expect(firstResult.value?.post.id).toBe("2");

      // Abort after getting the notification
      controller.abort();

      // Iterator should end
      const secondResult = await iterator.next();
      expect(secondResult.done).toBe(true);
    });
  });
});
