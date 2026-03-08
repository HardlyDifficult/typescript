function pickFence(content: string): string {
  let maxBackticks = 3;
  const backtickMatches = content.match(/`+/g);
  if (backtickMatches === null) {
    return "`".repeat(maxBackticks);
  }

  for (const match of backtickMatches) {
    if (match.length >= maxBackticks) {
      maxBackticks = match.length + 1;
    }
  }

  return "`".repeat(maxBackticks);
}

/**
 * Wrap content in a safe fenced markdown code block.
 */
export function codeBlock(content: string, language?: string): string {
  const fence = pickFence(content);
  const openingLine =
    language !== undefined && language !== "" ? `${fence}${language}` : fence;
  const closingPrefix = content.endsWith("\n") ? "" : "\n";
  return `${openingLine}\n${content}${closingPrefix}${fence}`;
}
