import type { SocialProviderClient } from "../SocialProviderClient.js";
import type { SocialPost } from "../types.js";

/**
 *
 */
export class MastodonSocialClient implements SocialProviderClient {
  private readonly message =
    'MastodonSocialClient is not yet supported in @hardlydifficult/social. Use provider type "x" for now.';

  getPost(_postId: string): Promise<SocialPost | null> {
    throw new Error(this.message);
  }

  getTimeline(_options?: {
    maxResults?: number;
  }): Promise<readonly SocialPost[]> {
    throw new Error(this.message);
  }

  getLikedPosts(_options?: {
    maxResults?: number;
  }): Promise<readonly SocialPost[]> {
    throw new Error(this.message);
  }
}
