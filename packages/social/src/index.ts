export type {
  Provider,
  XConfig,
  SocialConfig,
  SocialPost,
  SocialAuthor,
  SocialPostMetrics,
  LikeWatcherOptions,
  LikeNotification,
} from "./types.js";

export type { SocialProviderClient } from "./SocialProviderClient.js";

export { SocialClient } from "./SocialClient.js";
export {
  SocialLikeWatcher,
  type SocialLikeWatcherOptions,
} from "./SocialLikeWatcher.js";

export { XSocialClient } from "./x";
export { MastodonSocialClient } from "./mastodon/MastodonSocialClient.js";

import { SocialClient } from "./SocialClient.js";
import type { SocialConfig } from "./types.js";
import { XSocialClient } from "./x";

/**
 * Create a social client from explicit provider configuration.
 */
export function createSocialClient(config: SocialConfig): SocialClient {
  return new SocialClient(new XSocialClient(config));
}

/**
 * Create a social client using default provider configuration.
 */
export function createSocial(): SocialClient {
  return createSocialClient({ type: "x" });
}
