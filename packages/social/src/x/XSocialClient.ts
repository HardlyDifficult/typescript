import type { SocialProviderClient } from "../SocialProviderClient.js";
import type { SocialPost, XConfig } from "../types.js";

interface XTweet {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    reply_count?: number;
    retweet_count?: number;
  };
}

interface XUser {
  id: string;
  username: string;
  name?: string;
}

interface XResponse {
  readonly data?: unknown;
  readonly includes?: {
    readonly users?: readonly XUser[];
  };
}

/**
 *
 */
export class XSocialClient implements SocialProviderClient {
  private readonly bearerToken: string;
  private readonly maxResults: number;

  constructor(config: XConfig) {
    this.bearerToken = config.bearerToken ?? process.env.X_BEARER_TOKEN ?? "";
    this.maxResults = config.maxResults ?? 25;

    if (this.bearerToken.length === 0) {
      throw new Error("X bearer token is required. Set X_BEARER_TOKEN.");
    }
  }

  async getPost(postId: string): Promise<SocialPost | null> {
    const response = await this.request(
      `/tweets/${postId}${this.buildQuery()}`
    );
    const tweet = this.readSingleTweet(response.data);
    if (!tweet) {
      return null;
    }

    return this.normalizeTweet(tweet, response.includes?.users ?? []);
  }

  async getTimeline(options?: {
    maxResults?: number;
  }): Promise<readonly SocialPost[]> {
    const response = await this.request(
      `/users/me/timelines/reverse_chronological${this.buildQuery(options?.maxResults)}`
    );

    return this.readTweetList(response.data).map((tweet) =>
      this.normalizeTweet(tweet, response.includes?.users ?? [])
    );
  }

  async getLikedPosts(options?: {
    maxResults?: number;
  }): Promise<readonly SocialPost[]> {
    const response = await this.request(
      `/users/me/liked_tweets${this.buildQuery(options?.maxResults)}`
    );

    return this.readTweetList(response.data).map((tweet) =>
      this.normalizeTweet(tweet, response.includes?.users ?? [])
    );
  }

  private buildQuery(maxResults?: number): string {
    const params = new URLSearchParams({
      expansions: "author_id",
      "tweet.fields": "created_at,public_metrics",
      "user.fields": "name,username",
      max_results: String(maxResults ?? this.maxResults),
    });

    return `?${params.toString()}`;
  }

  private async request(path: string): Promise<XResponse> {
    const response = await fetch(`https://api.x.com/2${path}`, {
      headers: {
        Authorization: `Bearer ${this.bearerToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const status = String(response.status);
      throw new Error(`X API request failed: ${status} ${response.statusText}`);
    }

    return (await response.json()) as XResponse;
  }

  private readSingleTweet(data: unknown): XTweet | null {
    if (!this.isTweet(data)) {
      return null;
    }

    return data;
  }

  private readTweetList(data: unknown): readonly XTweet[] {
    if (!Array.isArray(data)) {
      return [];
    }

    return data.filter((item): item is XTweet => this.isTweet(item));
  }

  private isTweet(value: unknown): value is XTweet {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    return (
      typeof candidate.id === "string" && typeof candidate.text === "string"
    );
  }

  private normalizeTweet(tweet: XTweet, users: readonly XUser[]): SocialPost {
    const author = users.find((user) => user.id === tweet.author_id);

    return {
      id: tweet.id,
      text: tweet.text,
      createdAt: tweet.created_at ?? new Date(0).toISOString(),
      url: `https://x.com/${author?.username ?? "i"}/status/${tweet.id}`,
      author: {
        id: author?.id ?? tweet.author_id ?? "unknown",
        username: author?.username ?? "unknown",
        displayName: author?.name ?? author?.username ?? "Unknown",
      },
      metrics: {
        likes: tweet.public_metrics?.like_count ?? 0,
        replies: tweet.public_metrics?.reply_count ?? 0,
        reposts: tweet.public_metrics?.retweet_count ?? 0,
      },
    };
  }
}
