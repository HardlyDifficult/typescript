import type { SocialProviderClient } from "../SocialProviderClient.js";
import type { SocialListOptions, SocialPost } from "../types.js";

/**
 *
 */
export class MastodonSocialClient implements SocialProviderClient {
  private readonly message =
    'MastodonSocialClient is not yet supported in @hardlydifficult/social. Use provider type "x" for now.';

  post(_postId: string): Promise<SocialPost | null> {
    throw new Error(this.message);
  }

  getPost(postId: string): Promise<SocialPost | null> {
    return this.post(postId);
  }

  timeline(_options?: SocialListOptions): Promise<readonly SocialPost[]> {
    throw new Error(this.message);
  }

  getTimeline(options?: SocialListOptions): Promise<readonly SocialPost[]> {
    return this.timeline(options);
  }

  likes(_options?: SocialListOptions): Promise<readonly SocialPost[]> {
    throw new Error(this.message);
  }

  getLikedPosts(options?: SocialListOptions): Promise<readonly SocialPost[]> {
    return this.likes(options);
  }
}
