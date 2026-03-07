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

describe("watchLikes", () => {
  it("seeds the first snapshot and emits new likes oldest first", async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okLikedTweets(["2", "1"]))
      .mockResolvedValueOnce(okLikedTweets(["4", "3", "2", "1"]));

    globalThis.fetch = fetchMock as typeof fetch;

    const iterator = createSocial({ token: "token" })
      .me.watchLikes({ everyMs: 1_000 })
      [Symbol.asyncIterator]();

    const firstLike = iterator.next();
    await vi.runAllTicks();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(await firstLike).toMatchObject({
      done: false,
      value: {
        post: { id: "3" },
      },
    });

    expect(await iterator.next()).toMatchObject({
      done: false,
      value: {
        post: { id: "4" },
      },
    });
  });

  it("honors everyMs between polls", async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okLikedTweets(["1"]))
      .mockResolvedValueOnce(okLikedTweets(["2", "1"]));

    globalThis.fetch = fetchMock as typeof fetch;

    const iterator = createSocial({ token: "token" })
      .me.watchLikes({ everyMs: 5_000 })
      [Symbol.asyncIterator]();

    const firstLike = iterator.next();
    await vi.runAllTicks();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(4_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await firstLike;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("ends cleanly when aborted", async () => {
    vi.useFakeTimers();

    const fetchMock = vi.fn().mockResolvedValue(okLikedTweets(["1"]));
    globalThis.fetch = fetchMock as typeof fetch;

    const controller = new AbortController();
    const iterator = createSocial({ token: "token" })
      .me.watchLikes({ everyMs: 1_000, signal: controller.signal })
      [Symbol.asyncIterator]();

    const result = iterator.next();
    await vi.runAllTicks();
    controller.abort();

    await expect(result).resolves.toEqual({
      done: true,
      value: undefined,
    });
  });

  it("throws when a later poll fails", async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okLikedTweets(["1"]))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

    globalThis.fetch = fetchMock as typeof fetch;

    const iterator = createSocial({ token: "token" })
      .me.watchLikes({ everyMs: 1_000 })
      [Symbol.asyncIterator]();

    const nextLike = iterator.next();
    await vi.runAllTicks();
    const rejection = expect(nextLike).rejects.toThrow(
      "X API request failed: 500 Internal Server Error"
    );
    await vi.advanceTimersByTimeAsync(1_000);

    await rejection;
  });
});

function okLikedTweets(ids: readonly string[]) {
  return {
    ok: true,
    json: async () => ({
      data: ids.map((id) => ({
        id,
        text: `post-${id}`,
        author_id: "u1",
        created_at: "2025-01-01T00:00:00.000Z",
        public_metrics: {
          like_count: 1,
          reply_count: 2,
          retweet_count: 3,
        },
      })),
      includes: {
        users: [{ id: "u1", username: "nick", name: "Nick" }],
      },
    }),
  };
}
