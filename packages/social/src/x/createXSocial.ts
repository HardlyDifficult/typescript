import { duration } from "@hardlydifficult/date-time";

import type {
  CreateSocialInput,
  LikeNotification,
  Social,
  SocialPost,
  WatchLikesInput,
  WatchLikesOptions,
} from "../types.js";

const DEFAULT_LIMIT = 25;
const DEFAULT_WATCH_INTERVAL_MS = duration({ minutes: 1 });

interface XTweet {
  readonly id: string;
  readonly text: string;
  readonly author_id?: string;
  readonly created_at?: string;
  readonly public_metrics?: {
    readonly like_count?: number;
    readonly reply_count?: number;
    readonly retweet_count?: number;
  };
}

interface XUser {
  readonly id: string;
  readonly username: string;
  readonly name?: string;
}

interface XResponse {
  readonly data?: unknown;
  readonly includes?: {
    readonly users?: readonly XUser[];
  };
}

/** Creates the X-backed social read client with token and limit fallbacks. */
export function createXSocial(input: CreateSocialInput = {}): Social {
  const options = resolveConfig(input);
  const token = options.token ?? process.env.X_BEARER_TOKEN ?? "";
  const defaultLimit = options.limit ?? DEFAULT_LIMIT;

  if (token.length === 0) {
    throw new Error("X bearer token is required. Set X_BEARER_TOKEN.");
  }

  async function request(path: string): Promise<XResponse> {
    const response = await fetch(`https://api.x.com/2${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const status = String(response.status);
      throw new Error(`X API request failed: ${status} ${response.statusText}`);
    }

    return (await response.json()) as XResponse;
  }

  async function getPost(postId: string): Promise<SocialPost | null> {
    const response = await request(`/tweets/${postId}${buildPostQuery()}`);
    const tweet = readSingleTweet(response.data);
    if (!tweet) {
      return null;
    }

    return normalizeTweet(tweet, response.includes?.users ?? []);
  }

  async function listTimeline(limit = defaultLimit): Promise<readonly SocialPost[]> {
    const response = await request(
      `/users/me/timelines/reverse_chronological${buildListQuery(limit)}`
    );

    return normalizeTweets(response);
  }

  async function listLikes(limit = defaultLimit): Promise<readonly SocialPost[]> {
    const response = await request(
      `/users/me/liked_tweets${buildListQuery(limit)}`
    );

    return normalizeTweets(response);
  }

  return {
    post: getPost,
    timeline: listTimeline,
    likes: listLikes,
    watchLikes(watchOptions: WatchLikesInput = {}) {
      const options = resolveWatchLikesOptions(watchOptions);

      return watchLikesStream({
        everyMs: options.everyMs ?? DEFAULT_WATCH_INTERVAL_MS,
        signal: options.signal,
        listLikes,
      });
    },
  };
}

function resolveConfig(input: CreateSocialInput): Readonly<{
  token?: string;
  limit?: number;
}> {
  if (typeof input === "string") {
    return { token: input };
  }

  return input;
}

function resolveWatchLikesOptions(input: WatchLikesInput): WatchLikesOptions {
  if (typeof input === "number") {
    return { everyMs: input };
  }

  return input;
}

function buildPostQuery(): string {
  const params = new URLSearchParams({
    expansions: "author_id",
    "tweet.fields": "created_at,public_metrics",
    "user.fields": "name,username",
  });

  return `?${params.toString()}`;
}

function buildListQuery(limit: number): string {
  const params = new URLSearchParams({
    expansions: "author_id",
    "tweet.fields": "created_at,public_metrics",
    "user.fields": "name,username",
    max_results: String(limit),
  });

  return `?${params.toString()}`;
}

function normalizeTweets(response: XResponse): readonly SocialPost[] {
  return readTweetList(response.data).map((tweet) =>
    normalizeTweet(tweet, response.includes?.users ?? [])
  );
}

function readSingleTweet(data: unknown): XTweet | null {
  if (!isTweet(data)) {
    return null;
  }

  return data;
}

function readTweetList(data: unknown): readonly XTweet[] {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.filter((item): item is XTweet => isTweet(item));
}

function isTweet(value: unknown): value is XTweet {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && typeof candidate.text === "string";
}

function normalizeTweet(tweet: XTweet, users: readonly XUser[]): SocialPost {
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

async function* watchLikesStream({
  everyMs,
  signal,
  listLikes,
}: {
  readonly everyMs: number;
  readonly signal?: AbortSignal;
  readonly listLikes: (limit?: number) => Promise<readonly SocialPost[]>;
}): AsyncGenerator<LikeNotification> {
  const knownLikeIds = new Set<string>();
  let seeded = false;

  while (signal?.aborted !== true) {
    const liked = await listLikes();
    const seenAt = new Date().toISOString();

    if (!seeded) {
      for (const post of liked) {
        knownLikeIds.add(post.id);
      }
      seeded = true;
    } else {
      const notifications: LikeNotification[] = [];
      for (const post of liked) {
        if (!knownLikeIds.has(post.id)) {
          knownLikeIds.add(post.id);
          notifications.push({ post, seenAt });
        }
      }

      for (const notification of notifications.reverse()) {
        yield notification;
      }
    }

    if (!(await sleep(everyMs, signal))) {
      return;
    }
  }
}

function sleep(ms: number, signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted === true) {
    return Promise.resolve(false);
  }

  if (signal === undefined) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(true);
      }, ms);
      timer.unref();
    });
  }

  const abortSignal = signal;
  return new Promise((resolve) => {
    const timer = setTimeout(onTimeout, ms);
    timer.unref();

    abortSignal.addEventListener("abort", onAbort, { once: true });

    function onTimeout(): void {
      abortSignal.removeEventListener("abort", onAbort);
      resolve(true);
    }

    function onAbort(): void {
      clearTimeout(timer);
      abortSignal.removeEventListener("abort", onAbort);
      resolve(false);
    }
  });
}
