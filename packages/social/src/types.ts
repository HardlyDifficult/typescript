export interface CreateSocialOptions {
  readonly type?: "x";
  readonly token?: string;
  readonly bearerToken?: string;
  readonly defaultLimit?: number;
  readonly limit?: number;
  readonly maxResults?: number;
}

export type Provider = "x";
export type SocialOptions = CreateSocialOptions;
export type XConfig = CreateSocialOptions;
export type SocialConfig = CreateSocialOptions;

export interface SocialListOptions {
  readonly limit?: number;
}

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
  readonly pollIntervalMs?: number;
  readonly signal?: AbortSignal;
}

export interface Social {
  readonly posts: {
    get(postId: string): Promise<SocialPost | null>;
  };
  readonly me: {
    timeline(options?: SocialListOptions): Promise<readonly SocialPost[]>;
    likes(options?: SocialListOptions): Promise<readonly SocialPost[]>;
    watchLikes(options?: WatchLikesOptions): AsyncIterable<LikeNotification>;
  };
}

export type LikeWatcherOptions = WatchLikesOptions;
