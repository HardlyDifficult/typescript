import type { SocialPost } from "./types.js";

export interface SocialProviderClient {
  getPost(postId: string): Promise<SocialPost | null>;
  getTimeline(options?: { maxResults?: number }): Promise<readonly SocialPost[]>;
  getLikedPosts(options?: { maxResults?: number }): Promise<readonly SocialPost[]>;
}
