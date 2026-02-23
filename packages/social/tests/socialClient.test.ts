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
      getPost: vi.fn().mockResolvedValue(post("1")),
      getTimeline: vi.fn().mockResolvedValue([post("1"), post("2")]),
      getLikedPosts: vi.fn().mockResolvedValue([post("2")]),
    };

    const client = new SocialClient(provider);
    const timeline = await client.timeline({ maxResults: 20 });

    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.id).toBe("1");
    expect(provider.getTimeline).toHaveBeenCalledWith({ maxResults: 20 });
  });
});
