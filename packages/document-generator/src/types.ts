export type Platform = "markdown" | "slack" | "discord" | "plaintext";

export type Block =
  | HeaderBlock
  | TextBlock
  | ListBlock
  | DividerBlock
  | ContextBlock
  | LinkBlock
  | CodeBlock
  | ImageBlock;

export interface HeaderBlock {
  type: "header";
  text: string;
}

export interface TextBlock {
  type: "text";
  content: string;
}

export interface ListBlock {
  type: "list";
  items: string[];
}

export interface DividerBlock {
  type: "divider";
}

export interface ContextBlock {
  type: "context";
  text: string;
}

export interface LinkBlock {
  type: "link";
  text: string;
  url: string;
}

export interface CodeBlock {
  type: "code";
  content: string;
  multiline: boolean;
}

export interface ImageBlock {
  type: "image";
  url: string;
  alt?: string;
}

// Document constructor options
export interface DocumentSection {
  title?: string;
  content: string;
}

export type SectionContent = string | string[];

export interface DocumentOptions {
  header?: string;
  sections?: DocumentSection[];
  context?: Record<string, string | number | boolean | undefined>;
}

export interface SectionOptions {
  /**
   * Fallback text shown when section content is empty.
   * If omitted and content is empty, only the section title is rendered.
   */
  emptyText?: string;
  /** Render ordered list numbers instead of bullet markers. */
  ordered?: boolean;
  /** Insert a divider before the section output. */
  divider?: boolean;
}

export interface FieldOptions {
  /**
   * Fallback value when the provided value is empty.
   * If omitted and value is empty, the field is skipped.
   */
  emptyText?: string;
  /** Separator placed between the label and value. Default: ":" */
  separator?: string;
  /** Whether to bold the label. Default: true */
  bold?: boolean;
}

// Key-value formatting options
export interface KeyValueOptions {
  /** List style: plain (default), bullet, or numbered */
  style?: "plain" | "bullet" | "numbered";
  /** Separator between key and value. Default: ':' */
  separator?: string;
  /** Whether to bold keys. Default: true */
  bold?: boolean;
}

// Truncated list options
export interface TruncatedListOptions<T = string> {
  /** Maximum items to show. Default: 10 */
  limit?: number;
  /** Custom formatter for each item. Default: String(item) */
  format?: (item: T, index: number) => string;
  /** Custom "more" text. Default: "_... and N more_" */
  moreText?: (remaining: number) => string;
  /** Use numbered list instead of bullets. Default: false */
  ordered?: boolean;
}

// Timestamp options
export interface TimestampOptions {
  /** Custom date to use. Default: new Date() */
  date?: Date;
  /** Include clock emoji. Default: true */
  emoji?: boolean;
  /** Custom label text */
  label?: string;
}

export interface DocumentLinkifier {
  linkText?: (
    text: string,
    options?: { format?: Platform; platform?: Platform }
  ) => string;
  apply?: (
    text: string,
    options?: { format?: Platform; platform?: Platform }
  ) => string;
}

export type DocumentLinkTransform =
  | ((text: string) => string)
  | DocumentLinkifier;

export interface DocumentLinkifyOptions {
  /** Output platform passed to linker-style transformers. Default: "markdown". */
  platform?: Platform;
}
