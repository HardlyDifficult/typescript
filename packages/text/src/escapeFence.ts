/**
 * Escapes markdown code fences by wrapping content with more backticks than it contains.
 * If content has ```, wraps with ````. If content has ````, wraps with `````, etc.
 */
export function escapeFence(content: string): {
  fence: string;
  content: string;
} {
  let maxBackticks = 3; // Start with triple backticks (standard markdown fence)

  // Find the longest sequence of consecutive backticks in the content
  const backtickMatches = content.match(/`+/g);
  if (backtickMatches) {
    for (const match of backtickMatches) {
      if (match.length >= maxBackticks) {
        maxBackticks = match.length + 1;
      }
    }
  }

  const fence = "`".repeat(maxBackticks);
  return { fence, content };
}
