import {
  SocialLikeWatcher,
  type SocialLikeWatcherOptions,
} from "./SocialLikeWatcher.js";
import type { SocialProviderClient } from "./SocialProviderClient.js";
import type {
  LikeNotification,
  SocialListOptions,
  SocialPost,
} from "./types.js";

type SocialListInput =
  | number
  | SocialListOptions
  | {
      readonly maxResults?: number;
    };

type WatchLikesInput =
  | SocialLikeWatcherOptions
  | ((notification: LikeNotification) => void);

function normalizeListOptions(
  options?: SocialListInput
): SocialListOptions | undefined {
  if (typeof options === "number") {
    return { limit: options };
  }

  if (!options) {
    return undefined;
  }

  return {
    limit:
      ("limit" in options ? options.limit : undefined) ??
      ("maxResults" in options ? options.maxResults : undefined),
  };
}

/**
 *
 */
export class SocialClient {
  constructor(private readonly provider: SocialProviderClient) {}

  post(postId: string): Promise<SocialPost | null> {
    return this.provider.post(postId);
  }

  getPost(postId: string): Promise<SocialPost | null> {
    return this.post(postId);
  }

  timeline(options?: SocialListInput): Promise<readonly SocialPost[]> {
    return this.provider.timeline(normalizeListOptions(options));
  }

  likes(options?: SocialListInput): Promise<readonly SocialPost[]> {
    return this.provider.likes(normalizeListOptions(options));
  }

  likedPosts(options?: SocialListInput): Promise<readonly SocialPost[]> {
    return this.likes(options);
  }

  watchLikes(options: SocialLikeWatcherOptions): SocialLikeWatcher;
  watchLikes(
    onLike: (notification: LikeNotification) => void,
    options?: Omit<SocialLikeWatcherOptions, "onLike">
  ): SocialLikeWatcher;
  watchLikes(
    optionsOrHandler: WatchLikesInput,
    options?: Omit<SocialLikeWatcherOptions, "onLike">
  ): SocialLikeWatcher {
    const watcherOptions =
      typeof optionsOrHandler === "function"
        ? {
            ...options,
            onLike: optionsOrHandler,
          }
        : optionsOrHandler;

    return SocialLikeWatcher.create(this.provider, watcherOptions).start();
  }
}
