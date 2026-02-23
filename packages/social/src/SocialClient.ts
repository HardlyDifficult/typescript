import { SocialLikeWatcher, type SocialLikeWatcherOptions } from "./SocialLikeWatcher.js";
import type { SocialProviderClient } from "./SocialProviderClient.js";
import type { SocialPost } from "./types.js";

export class SocialClient {
  constructor(private readonly provider: SocialProviderClient) {}

  getPost(postId: string): Promise<SocialPost | null> {
    return this.provider.getPost(postId);
  }

  timeline(options?: { maxResults?: number }): Promise<readonly SocialPost[]> {
    return this.provider.getTimeline(options);
  }

  likedPosts(options?: { maxResults?: number }): Promise<readonly SocialPost[]> {
    return this.provider.getLikedPosts(options);
  }

  watchLikes(options: SocialLikeWatcherOptions): SocialLikeWatcher {
    return SocialLikeWatcher.create(this.provider, options);
  }
}
