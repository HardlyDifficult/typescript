export type {
  CreateSocialOptions,
  LikeNotification,
  LikeWatcherOptions,
  Provider,
  Social,
  SocialAuthor,
  SocialConfig,
  SocialListOptions,
  SocialOptions,
  SocialPost,
  SocialPostMetrics,
  WatchLikesOptions,
  XConfig,
} from "./types.js";

import type { CreateSocialOptions, Social } from "./types.js";
import { createXSocial } from "./x/createXSocial.js";

/**
 * Create the opinionated social client. X is the only supported provider and
 * token lookup falls back to X_BEARER_TOKEN automatically.
 */
export function createSocial(config: CreateSocialOptions = {}): Social {
  return createXSocial(config);
}
