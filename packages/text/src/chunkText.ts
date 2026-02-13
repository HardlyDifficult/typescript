/**
 * Split text into chunks that respect a maximum length.
 * Prefers breaking on newlines, then spaces, and falls back to hard breaks.
 */

/**
 * Split text into chunks of at most `maxLength` characters.
 *
 * @param text - The text to split
 * @param maxLength - Maximum length of each chunk
 * @returns Array of text chunks
 */
export function chunkText(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find a good break point (newline or space)
    let breakPoint = remaining.lastIndexOf("\n", maxLength);
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = remaining.lastIndexOf(" ", maxLength);
    }
    if (breakPoint === -1 || breakPoint < maxLength / 2) {
      breakPoint = maxLength;
    }

    chunks.push(remaining.slice(0, breakPoint));
    remaining = remaining.slice(breakPoint).trimStart();
  }

  return chunks;
}
