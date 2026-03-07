import type { SocialListOptions, SocialPost } from "./types.js";

export interface SocialProviderClient {
  post(postId: string): Promise<SocialPost | null>;
  timeline(options?: SocialListOptions): Promise<readonly SocialPost[]>;
  likes(options?: SocialListOptions): Promise<readonly SocialPost[]>;
}
