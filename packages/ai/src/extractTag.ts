/**
 * Extract content from the first occurrence of an XML-style tag in text.
 * Returns the trimmed inner content, or null if the tag is not found.
 *
 * Useful for AI responses where the model wraps its output in tags
 * like <result>...</result> to separate it from narration/thinking.
 */
export function extractTag(text: string, tagName: string): string | null {
  const pattern = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`);
  const match = pattern.exec(text);
  return match?.[1]?.trim() ?? null;
}
