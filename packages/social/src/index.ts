export type {
  CreateSocialInput,
  CreateSocialOptions,
  LikeNotification,
  Social,
  SocialAuthor,
  SocialPost,
  SocialPostMetrics,
  WatchLikesInput,
  WatchLikesOptions,
} from "./types.js";

import type { CreateSocialInput, Social } from "./types.js";
import { createXSocial } from "./x/createXSocial.js";

/**
 * Create the opinionated social client. X is the only supported provider and
 * token lookup falls back to X_BEARER_TOKEN automatically.
 */
export function createSocial(config: CreateSocialInput = {}): Social {
  return createXSocial(config);
}
