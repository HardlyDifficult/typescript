export interface CreateSocialOptions {
  readonly token?: string;
  readonly limit?: number;
}

export type CreateSocialInput = string | CreateSocialOptions;

export interface SocialAuthor {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
}

export interface SocialPostMetrics {
  readonly likes: number;
  readonly replies: number;
  readonly reposts: number;
}

export interface SocialPost {
  readonly id: string;
  readonly text: string;
  readonly createdAt: string;
  readonly url: string;
  readonly author: SocialAuthor;
  readonly metrics: SocialPostMetrics;
}

export interface LikeNotification {
  readonly post: SocialPost;
  readonly seenAt: string;
}

export interface WatchLikesOptions {
  readonly everyMs?: number;
  readonly signal?: AbortSignal;
}

export type WatchLikesInput = number | WatchLikesOptions;

export interface Social {
  post(postId: string): Promise<SocialPost | null>;
  timeline(limit?: number): Promise<readonly SocialPost[]>;
  likes(limit?: number): Promise<readonly SocialPost[]>;
  watchLikes(options?: WatchLikesInput): AsyncIterable<LikeNotification>;
}
