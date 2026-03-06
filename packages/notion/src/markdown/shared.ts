export const BLANK_LINE = /^\s*$/;
export const INDENT_WIDTH = 2;

export function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n").trim();
}

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
