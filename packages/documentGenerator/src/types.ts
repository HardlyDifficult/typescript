export type Platform = 'markdown' | 'slack' | 'discord' | 'plaintext';

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
  type: 'header';
  text: string;
}

export interface TextBlock {
  type: 'text';
  content: string;
}

export interface ListBlock {
  type: 'list';
  items: string[];
}

export interface DividerBlock {
  type: 'divider';
}

export interface ContextBlock {
  type: 'context';
  text: string;
}

export interface LinkBlock {
  type: 'link';
  text: string;
  url: string;
}

export interface CodeBlock {
  type: 'code';
  content: string;
  multiline: boolean;
}

export interface ImageBlock {
  type: 'image';
  url: string;
  alt?: string;
}

// Document constructor options
export interface DocumentSection {
  title?: string;
  content: string;
}

export interface DocumentOptions {
  header?: string;
  sections?: DocumentSection[];
  context?: Record<string, string | number | boolean | undefined>;
}

// Key-value formatting options
export interface KeyValueOptions {
  /** List style: plain (default), bullet, or numbered */
  style?: 'plain' | 'bullet' | 'numbered';
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
  /** Custom prefix text */
  prefix?: string;
}
