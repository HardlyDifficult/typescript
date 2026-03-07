import { MILLISECONDS_PER_MINUTE } from "@hardlydifficult/date-time";

import type { SocialProviderClient } from "./SocialProviderClient.js";
import type { LikeNotification, WatchLikesOptions } from "./types.js";

export type SocialLikeWatcherOptions = WatchLikesOptions;

/**
 *
 */
export class SocialLikeWatcher {
  private timer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private seeded = false;
  private readonly knownLikeIds = new Set<string>();

  constructor(
    private readonly provider: SocialProviderClient,
    private readonly options: Required<Pick<WatchLikesOptions, "everyMs">> &
      Pick<WatchLikesOptions, "onLike" | "onError">
  ) {}

  static create(
    provider: SocialProviderClient,
    options: WatchLikesOptions
  ): SocialLikeWatcher {
    return new SocialLikeWatcher(provider, {
      ...options,
      everyMs:
        options.everyMs ?? options.pollIntervalMs ?? MILLISECONDS_PER_MINUTE,
    });
  }

  start(): this {
    if (this.timer !== null) {
      return this;
    }

    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.options.everyMs);
    this.timer.unref();
    return this;
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async poll(): Promise<void> {
    if (this.polling) {
      return;
    }

    this.polling = true;

    try {
      const liked = await this.provider.likes();
      const now = new Date().toISOString();

      if (!this.seeded) {
        for (const post of liked) {
          this.knownLikeIds.add(post.id);
        }
        this.seeded = true;
        return;
      }

      const notifications: LikeNotification[] = [];
      for (const post of liked) {
        if (!this.knownLikeIds.has(post.id)) {
          this.knownLikeIds.add(post.id);
          notifications.push({ post, seenAt: now });
        }
      }

      for (const notification of notifications.reverse()) {
        this.options.onLike(notification);
      }
    } catch (error) {
      const normalizedError =
        error instanceof Error ? error : new Error(String(error));
      if (this.options.onError) {
        this.options.onError(normalizedError);
      } else {
        console.error(
          "SocialLikeWatcher: poll failed:",
          normalizedError.message
        );
      }
    } finally {
      this.polling = false;
    }
  }
}
