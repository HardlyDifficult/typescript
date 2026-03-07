export type {
  Provider,
  XConfig,
  SocialOptions,
  SocialConfig,
  SocialListOptions,
  SocialPost,
  SocialAuthor,
  SocialPostMetrics,
  WatchLikesOptions,
  LikeWatcherOptions,
  LikeNotification,
} from "./types.js";

export { SocialClient } from "./SocialClient.js";
export {
  SocialLikeWatcher,
  type SocialLikeWatcherOptions,
} from "./SocialLikeWatcher.js";

import { SocialClient } from "./SocialClient.js";
import type { SocialOptions } from "./types.js";
import { XSocialClient } from "./x";

/**
 * Create the opinionated social client. X is the only provider today,
 * so the factory accepts X settings directly and will also read
 * X_BEARER_TOKEN from the environment.
 */
export function createSocial(config: SocialOptions = {}): SocialClient {
  return new SocialClient(new XSocialClient(config));
}

/**
 * Backwards-compatible alias for older call sites.
 */
export function createSocialClient(config: SocialOptions = {}): SocialClient {
  return createSocial(config);
}
