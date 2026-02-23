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
export { SocialLikeWatcher, type SocialLikeWatcherOptions } from "./SocialLikeWatcher.js";

export { XSocialClient } from "./x/index.js";
export { MastodonSocialClient } from "./mastodon/MastodonSocialClient.js";

import { SocialClient } from "./SocialClient.js";
import type { SocialProviderClient } from "./SocialProviderClient.js";
import { XSocialClient } from "./x/index.js";
import type { SocialConfig } from "./types.js";

export function createSocialClient(config: SocialConfig): SocialClient {
  let provider: SocialProviderClient;

  switch (config.type) {
    case "x":
      provider = new XSocialClient(config);
      break;
    default:
      throw new Error(`Unknown social provider: ${(config as { type: string }).type}`);
  }

  return new SocialClient(provider);
}

export function createSocial(type: "x" = "x"): SocialClient {
  if (type !== "x") {
    throw new Error(`Unknown social provider: ${type}`);
  }

  return createSocialClient({ type: "x" });
}
