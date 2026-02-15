import type { Platform } from "./types.js";

/** Maximum message content length per platform. */
export const MESSAGE_LIMITS: Record<Platform, number> = {
  discord: 2000,
  slack: 4000,
};
