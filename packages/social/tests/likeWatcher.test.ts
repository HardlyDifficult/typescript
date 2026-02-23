import { describe, expect, it, vi } from "vitest";
import { SocialLikeWatcher } from "../src/SocialLikeWatcher.js";
import type { SocialProviderClient } from "../src/SocialProviderClient.js";
import type { SocialPost } from "../src/types.js";

const post = (id: string): SocialPost => ({
  id,
  text: `post-${id}`,
  createdAt: "2025-01-01T00:00:00.000Z",
  url: `https://x.com/me/status/${id}`,
  author: {
    id: "u1",
    username: "me",
    displayName: "Me",
  },
  metrics: {
    likes: 1,
    replies: 2,
    reposts: 3,
  },
});

describe("SocialLikeWatcher", () => {
  it("seeds first snapshot and emits only newly seen likes", async () => {
    const provider: SocialProviderClient = {
      getPost: vi.fn(),
      getTimeline: vi.fn(),
      getLikedPosts: vi
        .fn()
        .mockResolvedValueOnce([post("1"), post("2")])
        .mockResolvedValueOnce([post("3"), post("2"), post("1")]),
    };

    const onLike = vi.fn();
    const watcher = SocialLikeWatcher.create(provider, {
      onLike,
      pollIntervalMs: 1000,
    });

    await watcher.poll();
    expect(onLike).not.toHaveBeenCalled();

    await watcher.poll();
    expect(onLike).toHaveBeenCalledTimes(1);
    expect(onLike.mock.calls[0]?.[0].post.id).toBe("3");
  });
});
