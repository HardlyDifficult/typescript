import { afterEach, describe, expect, it, vi } from "vitest";

import { createSocial } from "../src/index.js";

const originalFetch = globalThis.fetch;
const originalToken = process.env.X_BEARER_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalToken === undefined) {
    delete process.env.X_BEARER_TOKEN;
  } else {
    process.env.X_BEARER_TOKEN = originalToken;
  }
});

describe("social read APIs", () => {
  it("posts.get fetches and normalizes a post", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          id: "123",
          text: "hello",
          author_id: "u1",
          created_at: "2025-01-01T00:00:00.000Z",
          public_metrics: {
            like_count: 4,
            reply_count: 5,
            retweet_count: 6,
          },
        },
        includes: {
          users: [{ id: "u1", username: "nick", name: "Nick" }],
        },
      }),
    });

    globalThis.fetch = fetchMock as typeof fetch;
    const social = createSocial({ token: "token" });

    const post = await social.posts.get("123");

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/tweets/123?"),
      expect.any(Object)
    );
    expect(post).toEqual({
      id: "123",
      text: "hello",
      createdAt: "2025-01-01T00:00:00.000Z",
      url: "https://x.com/nick/status/123",
      author: {
        id: "u1",
        username: "nick",
        displayName: "Nick",
      },
      metrics: {
        likes: 4,
        replies: 5,
        reposts: 6,
      },
    });
  });

  it("me.timeline uses per-call limit when provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    globalThis.fetch = fetchMock as typeof fetch;
    const social = createSocial({ token: "token", defaultLimit: 25 });

    await social.me.timeline({ limit: 10 });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("max_results=10"),
      expect.any(Object)
    );
  });

  it("me.likes falls back to defaultLimit, then 25", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

    globalThis.fetch = fetchMock as typeof fetch;

    const withDefaultLimit = createSocial({ token: "token", defaultLimit: 12 });
    await withDefaultLimit.me.likes();

    const withBuiltInDefault = createSocial({ token: "token" });
    await withBuiltInDefault.me.likes();

    expect(fetchMock.mock.calls[0]?.[0]).toContain("max_results=12");
    expect(fetchMock.mock.calls[1]?.[0]).toContain("max_results=25");
  });

  it("accepts maxResults as an alias for defaultLimit", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const social = createSocial({ token: "token", maxResults: 7 });
    await social.me.timeline();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("max_results=7"),
      expect.any(Object)
    );
  });
});
