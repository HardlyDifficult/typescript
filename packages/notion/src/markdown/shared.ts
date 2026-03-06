export const BLANK_LINE = /^\s*$/;
export const INDENT_WIDTH = 2;

/** Normalizes line endings and trims outer whitespace. */
export function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n").trim();
}

/** Builds a Notion ellipsis selection string from markdown content. */
export function selectionFromMarkdown(
  markdown: string,
  edgeLength = 20
): string | undefined {
  const normalized = normalizeMarkdown(markdown);
  if (normalized.length === 0) {
    return undefined;
  }
  if (normalized.length <= edgeLength * 2) {
    return `${normalized}...${normalized}`;
  }
  return `${normalized.slice(0, edgeLength)}...${normalized.slice(-edgeLength)}`;
}
