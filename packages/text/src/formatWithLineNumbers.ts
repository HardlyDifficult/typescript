/**
 * Format text content with right-aligned line numbers.
 *
 * @param content - The text content to format
 * @param startLine - The starting line number (default: 1)
 * @returns The formatted text with line numbers
 *
 * @example
 * ```typescript
 * formatWithLineNumbers("foo\nbar\nbaz")
 * // Returns:
 * // "1: foo\n2: bar\n3: baz"
 *
 * formatWithLineNumbers("hello\nworld", 10)
 * // Returns:
 * // "10: hello\n11: world"
 * ```
 */
export function formatWithLineNumbers(content: string, startLine = 1): string {
  const lines = content.split('\n');
  const maxNum = startLine + lines.length - 1;
  const width = String(maxNum).length;
  return lines
    .map((line, i) => `${String(startLine + i).padStart(width)}: ${line}`)
    .join('\n');
}
