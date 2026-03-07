export interface CreateSocialOptions {
  readonly token?: string;
  readonly defaultLimit?: number;
}

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
