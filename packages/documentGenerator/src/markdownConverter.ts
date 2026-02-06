import type { Platform } from "./types.js";

/**
 * Converts inline markdown formatting to the target platform format.
 *
 * Handles:
 * - Bold: `**text**` → platform-specific bold
 * - Italic: `*text*` → platform-specific italic
 * - Strikethrough: `~~text~~` → platform-specific strike
 *
 * Processing order: bold → italic → strikethrough (to avoid matching `**` as italic)
 */
export function convertMarkdown(text: string, platform: Platform): string {
  if (platform === "plaintext") {
    return stripMarkdown(text);
  }

  let result = text;
  const placeholders = new Map<string, string>();
  let placeholderIndex = 0;

  // Process bold first: **text** (before italic to avoid matching ** as italic)
  // Use placeholder to prevent italic regex from matching converted bold
  result = result.replace(/\*\*(.+?)\*\*/g, (_match, content: string) => {
    const placeholder = `__BOLD_PLACEHOLDER_${String(placeholderIndex++)}__`;
    let replacement: string;
    switch (platform) {
      case "markdown":
      case "discord":
        replacement = `**${content}**`;
        break;
      case "slack":
        replacement = `*${content}*`;
        break;
      default:
        replacement = content;
    }
    placeholders.set(placeholder, replacement);
    return placeholder;
  });

  // Process italic: *text* (but not **text**)
  // Use negative lookbehind/lookahead to ensure single asterisk
  result = result.replace(
    /(?<!\*)\*([^*]+?)\*(?!\*)/g,
    (_match: string, content: string) => {
      switch (platform) {
        case "markdown":
        case "discord":
          return `*${content}*`;
        case "slack":
          return `_${content}_`;
        default:
          return content;
      }
    }
  );

  // Process strikethrough: ~~text~~
  result = result.replace(/~~(.+?)~~/g, (_match: string, content: string) => {
    switch (platform) {
      case "markdown":
      case "discord":
        return `~~${content}~~`;
      case "slack":
        return `~${content}~`;
      default:
        return content;
    }
  });

  // Replace placeholders with final bold format
  for (const [placeholder, replacement] of placeholders) {
    result = result.replace(placeholder, replacement);
  }

  return result;
}

/**
 * Removes all markdown formatting from text, returning plain text.
 */
export function stripMarkdown(text: string): string {
  let result = text;

  // Remove bold: **text** → text
  result = result.replace(/\*\*(.+?)\*\*/g, "$1");

  // Remove italic: *text* → text (but not **text**)
  result = result.replace(/(?<!\*)\*([^*]+?)\*(?!\*)/g, "$1");

  // Remove strikethrough: ~~text~~ → text
  result = result.replace(/~~(.+?)~~/g, "$1");

  return result;
}
