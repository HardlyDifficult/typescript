export type Provider = "x";

export interface SocialOptions {
  readonly type?: "x";
  readonly bearerToken?: string;
  readonly limit?: number;
  readonly maxResults?: number;
}

export type XConfig = SocialOptions;

export type SocialConfig = SocialOptions;

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
  readonly onLike: (notification: LikeNotification) => void;
  readonly onError?: (error: Error) => void;
}

export type LikeWatcherOptions = WatchLikesOptions;
