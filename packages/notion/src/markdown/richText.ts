import type {
  NotionAnnotations,
  NotionParagraphBlock,
  NotionRichText,
} from "../types.js";
import { normalizeMarkdown } from "./shared.js";

interface DelimiterPattern {
  open: string;
  close: string;
  annotation: keyof NotionAnnotations;
  literal?: boolean;
}

interface LinkToken {
  start: number;
  end: number;
  label: string;
  url: string;
}

interface DelimiterToken {
  start: number;
  end: number;
  content: string;
  pattern: DelimiterPattern;
}

type InlineToken =
  | { kind: "link"; data: LinkToken }
  | { kind: "delimiter"; data: DelimiterToken };

const DELIMITER_PATTERNS: DelimiterPattern[] = [
  { open: "**", close: "**", annotation: "bold" },
  { open: "__", close: "__", annotation: "bold" },
  { open: "~~", close: "~~", annotation: "strikethrough" },
  { open: "<u>", close: "</u>", annotation: "underline" },
  { open: "`", close: "`", annotation: "code", literal: true },
  { open: "*", close: "*", annotation: "italic" },
  { open: "_", close: "_", annotation: "italic" },
];

function cloneAnnotations(
  annotations?: NotionAnnotations
): NotionAnnotations | undefined {
  return annotations === undefined ? undefined : { ...annotations };
}

function mergeAnnotations(
  base: NotionAnnotations | undefined,
  next: Partial<NotionAnnotations>
): NotionAnnotations {
  return { ...(base ?? {}), ...next };
}

export function makeTextRichText(
  content: string,
  annotations?: NotionAnnotations
): NotionRichText {
  return {
    type: "text",
    text: { content },
    annotations: cloneAnnotations(annotations),
    plain_text: content,
    href: null,
  };
}

function withLink(segment: NotionRichText, url: string): NotionRichText {
  return {
    ...segment,
    text: { ...segment.text, link: { url } },
    href: url,
  };
}

function pushText(
  target: NotionRichText[],
  content: string,
  annotations?: NotionAnnotations
): void {
  if (content.length === 0) {
    return;
  }
  target.push(makeTextRichText(content, annotations));
}

function findLink(text: string, start: number): LinkToken | null {
  const open = text.indexOf("[", start);
  if (open < 0) {
    return null;
  }
  const close = text.indexOf("]", open + 1);
  if (close < 0 || text.slice(close, close + 2) !== "](") {
    return null;
  }
  const end = text.indexOf(")", close + 2);
  if (end < 0) {
    return null;
  }
  return {
    start: open,
    end: end + 1,
    label: text.slice(open + 1, close),
    url: text.slice(close + 2, end),
  };
}

function findDelimited(text: string, start: number): DelimiterToken | null {
  let earliest: DelimiterToken | null = null;

  for (const pattern of DELIMITER_PATTERNS) {
    const open = text.indexOf(pattern.open, start);
    if (open < 0) {
      continue;
    }
    const close = text.indexOf(pattern.close, open + pattern.open.length);
    if (close < 0) {
      continue;
    }
    const candidate: DelimiterToken = {
      start: open,
      end: close + pattern.close.length,
      content: text.slice(open + pattern.open.length, close),
      pattern,
    };
    if (earliest === null || candidate.start < earliest.start) {
      earliest = candidate;
    }
  }

  return earliest;
}

function findNextToken(text: string, start: number): InlineToken | null {
  const link = findLink(text, start);
  const delimiter = findDelimited(text, start);

  if (link === null && delimiter === null) {
    return null;
  }
  if (link !== null && (delimiter === null || link.start <= delimiter.start)) {
    return { kind: "link", data: link };
  }
  return { kind: "delimiter", data: delimiter! };
}

function parseInline(
  text: string,
  annotations?: NotionAnnotations
): NotionRichText[] {
  const parts: NotionRichText[] = [];
  let index = 0;

  while (index < text.length) {
    const token = findNextToken(text, index);
    if (token === null) {
      pushText(parts, text.slice(index), annotations);
      break;
    }
    if (token.data.start > index) {
      pushText(parts, text.slice(index, token.data.start), annotations);
    }
    if (token.kind === "link") {
      const richText = parseInline(token.data.label, annotations).map((segment) =>
        withLink(segment, token.data.url)
      );
      parts.push(...richText);
    } else {
      const pattern = token.data.pattern;
      const merged = mergeAnnotations(annotations, {
        [pattern.annotation]: true,
      });
      if (pattern.literal) {
        pushText(parts, token.data.content, merged);
      } else {
        parts.push(...parseInline(token.data.content, merged));
      }
    }
    index = token.data.end;
  }

  return parts;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}\[\]()#+\-.!~])/g, "\\$1");
}

function renderInline(segment: NotionRichText): string {
  let output = escapeMarkdown(segment.plain_text ?? segment.text.content);
  const annotations = segment.annotations ?? {};

  if (annotations.code) {
    output = `\`${output}\``;
  }
  if (annotations.bold) {
    output = `**${output}**`;
  }
  if (annotations.italic) {
    output = `*${output}*`;
  }
  if (annotations.strikethrough) {
    output = `~~${output}~~`;
  }
  if (annotations.underline) {
    output = `<u>${output}</u>`;
  }
  if (segment.text.link?.url !== undefined) {
    output = `[${output}](${segment.text.link.url})`;
  }
  return output;
}

export function richTextFromMarkdown(markdown: string): NotionRichText[] {
  return parseInline(markdown);
}

export function richTextToPlainText(richText: NotionRichText[]): string {
  return richText.map((segment) => segment.plain_text ?? segment.text.content).join("");
}

export function renderRichText(richText: NotionRichText[]): string {
  return richText.map(renderInline).join("");
}

export function textToParagraphBlocks(text: string): NotionParagraphBlock[] {
  const normalized = normalizeMarkdown(text);
  if (normalized.length === 0) {
    return [];
  }
  return normalized.split("\n\n").map(
    (paragraph): NotionParagraphBlock => ({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: richTextFromMarkdown(paragraph) },
    })
  );
}
