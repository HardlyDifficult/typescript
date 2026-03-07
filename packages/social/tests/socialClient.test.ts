import { describe, expect, it, vi } from "vitest";
import { SocialClient } from "../src/SocialClient.js";
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

describe("SocialClient", () => {
  it("reads timeline through provider-agnostic API", async () => {
    const provider: SocialProviderClient = {
      post: vi.fn().mockResolvedValue(post("1")),
      timeline: vi.fn().mockResolvedValue([post("1"), post("2")]),
      likes: vi.fn().mockResolvedValue([post("2")]),
    };

    const client = new SocialClient(provider);
    const timeline = await client.timeline(20);

    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.id).toBe("1");
    expect(provider.timeline).toHaveBeenCalledWith({ limit: 20 });
  });

  it("starts like watching immediately when given a callback", async () => {
    vi.useFakeTimers();
    try {
      const provider: SocialProviderClient = {
        post: vi.fn(),
        timeline: vi.fn(),
        likes: vi
          .fn()
          .mockResolvedValueOnce([post("1"), post("2")])
          .mockResolvedValueOnce([post("3"), post("2"), post("1")]),
      };

      const onLike = vi.fn();
      const client = new SocialClient(provider);
      const watcher = client.watchLikes(onLike, { everyMs: 1000 });

      await vi.runAllTicks();
      expect(onLike).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1000);
      expect(onLike).toHaveBeenCalledTimes(1);
      expect(onLike.mock.calls[0]?.[0].post.id).toBe("3");

      watcher.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
