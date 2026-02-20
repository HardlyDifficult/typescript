import type { Message } from "./types.js";

const ANTHROPIC_CACHE_EPHEMERAL = {
  anthropic: { cacheControl: { type: "ephemeral" as const } },
};

interface CacheableMessage {
  role: "user" | "assistant" | "system";
  content: string;
  providerOptions?: typeof ANTHROPIC_CACHE_EPHEMERAL;
}

/**
 * Adds Anthropic cacheControl markers to messages for prompt caching.
 *
 * Marks two types of messages:
 * - **System messages**: Always cached (stable across turns).
 * - **Second-to-last message**: When 3+ messages, caches the conversation
 *   prefix so subsequent turns only pay full price for the latest message.
 *
 * Non-Anthropic providers silently ignore `providerOptions`.
 * Anthropic allows up to 4 cache breakpoints per request.
 */
export function addCacheControl(messages: Message[]): CacheableMessage[] {
  return messages.map((msg, i): CacheableMessage => {
    const isSystem = msg.role === "system";
    const isPrefixBoundary = messages.length >= 3 && i === messages.length - 2;

    if (isSystem || isPrefixBoundary) {
      return {
        role: msg.role,
        content: msg.content,
        providerOptions: ANTHROPIC_CACHE_EPHEMERAL,
      };
    }

    return { role: msg.role, content: msg.content };
  });
}
