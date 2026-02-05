import type {
  Block,
  HeaderBlock,
  TextBlock,
  ListBlock,
  DividerBlock,
  ContextBlock,
  LinkBlock,
  CodeBlock,
  ImageBlock,
  DocumentOptions,
  KeyValueOptions,
  TruncatedListOptions,
  TimestampOptions,
} from './types.js';
import { toMarkdown as outputMarkdown } from './outputters/markdown.js';
import { toPlainText as outputPlainText } from './outputters/plainText.js';

export class Document {
  private blocks: Block[] = [];

  /**
   * Create a new Document, optionally with initial content.
   *
   * @example
   * ```typescript
   * // Empty document
   * const doc = new Document();
   *
   * // Document with initial content
   * const doc = new Document({
   *   header: 'Report Title',
   *   sections: [
   *     { title: 'Summary', content: 'All systems operational' },
   *     { content: 'No issues found' },
   *   ],
   *   context: { Network: 'mainnet', Status: 'active' },
   * });
   * ```
   */
  constructor(options?: DocumentOptions) {
    if (options !== undefined) {
      if (options.header !== undefined && options.header !== '') {
        this.header(options.header);
      }
      if (options.sections !== undefined) {
        for (const section of options.sections) {
          if (section.title !== undefined && section.title !== '') {
            this.section(section.title);
          }
          this.text(section.content);
        }
      }
      if (options.context !== undefined) {
        this.divider();
        this.keyValue(options.context);
      }
    }
  }

  /**
   * Truncate text to a maximum length with ellipsis.
   */
  static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return `${text.slice(0, maxLength - 3)}...`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Core block methods
  // ─────────────────────────────────────────────────────────────────────────────

  header(text: string): this {
    const block: HeaderBlock = {
      type: 'header',
      text,
    };
    this.blocks.push(block);
    return this;
  }

  text(content: string): this {
    const block: TextBlock = {
      type: 'text',
      content,
    };
    this.blocks.push(block);
    return this;
  }

  list(items: string[]): this {
    const block: ListBlock = {
      type: 'list',
      items,
    };
    this.blocks.push(block);
    return this;
  }

  divider(): this {
    const block: DividerBlock = {
      type: 'divider',
    };
    this.blocks.push(block);
    return this;
  }

  context(text: string): this {
    const block: ContextBlock = {
      type: 'context',
      text,
    };
    this.blocks.push(block);
    return this;
  }

  link(text: string, url: string): this {
    const block: LinkBlock = {
      type: 'link',
      text,
      url,
    };
    this.blocks.push(block);
    return this;
  }

  code(content: string): this {
    const multiline = content.includes('\n');
    const block: CodeBlock = {
      type: 'code',
      content,
      multiline,
    };
    this.blocks.push(block);
    return this;
  }

  image(url: string, alt?: string): this {
    const block: ImageBlock = {
      type: 'image',
      url,
      alt,
    };
    this.blocks.push(block);
    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Convenience methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Add a section with header and divider.
   *
   * @example
   * ```typescript
   * doc.section('Customer Details').text('Name: Alice');
   * ```
   */
  section(title: string): this {
    return this.header(title).divider();
  }

  /**
   * Add key-value pairs formatted as **Key:** value.
   *
   * @example
   * ```typescript
   * doc.keyValue({ Network: 'mainnet', Status: 'active' });
   * // Output: **Network:** mainnet\n**Status:** active
   *
   * doc.keyValue({ Name: 'Alice', Role: 'Admin' }, { style: 'bullet' });
   * // Output: • **Name:** Alice\n• **Role:** Admin
   * ```
   */
  keyValue(
    data: Record<string, string | number | boolean | undefined>,
    options: KeyValueOptions = {}
  ): this {
    const { style = 'plain', separator = ':', bold = true } = options;

    const entries = Object.entries(data).filter(([, v]) => v !== undefined);
    if (entries.length === 0) {
      return this;
    }

    const lines = entries.map(([key, value], i) => {
      const formattedKey = bold ? `**${key}**` : key;
      const prefix =
        style === 'bullet' ? '• ' : style === 'numbered' ? `${String(i + 1)}. ` : '';
      return `${prefix}${formattedKey}${separator} ${String(value)}`;
    });

    return this.text(lines.join('\n'));
  }

  /**
   * Add a list with automatic truncation and "X more" message.
   *
   * @example
   * ```typescript
   * doc.truncatedList(['a', 'b', 'c', 'd', 'e', 'f'], { limit: 3 });
   * // Output:
   * // • a
   * // • b
   * // • c
   * // _... and 3 more_
   * ```
   */
  truncatedList<T>(items: T[], options: TruncatedListOptions<T> = {}): this {
    const {
      limit = 10,
      format = (item: T): string => String(item),
      moreText = (n: number): string => `_... and ${String(n)} more_`,
      ordered = false,
    } = options;

    if (items.length === 0) {
      return this;
    }

    const visible = items.slice(0, limit);
    const remaining = items.length - limit;

    const lines = visible.map((item, i) => {
      const prefix = ordered ? `${String(i + 1)}. ` : '• ';
      return `${prefix}${format(item, i)}`;
    });

    if (remaining > 0) {
      lines.push(moreText(remaining));
    }

    return this.text(lines.join('\n'));
  }

  /**
   * Add a timestamp in context format.
   *
   * @example
   * ```typescript
   * doc.timestamp(); // 🕐 2024-02-04T12:00:00.000Z
   * doc.timestamp({ emoji: false }); // 2024-02-04T12:00:00.000Z
   * doc.timestamp({ prefix: 'Generated' }); // Generated 2024-02-04T...
   * ```
   */
  timestamp(options: TimestampOptions = {}): this {
    const { date = new Date(), emoji = true, prefix } = options;
    const iso = date.toISOString();
    let text: string;
    if (prefix !== undefined && prefix !== '') {
      text = `${prefix} ${iso}`;
    } else if (emoji) {
      text = `🕐 ${iso}`;
    } else {
      text = iso;
    }
    return this.context(text);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Conditional and iteration methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Conditionally add content to the document.
   *
   * @example
   * ```typescript
   * doc.if(hasErrors, d => d.section('Errors').list(errors));
   * ```
   */
  if(condition: boolean, callback: (doc: this) => void): this {
    if (condition) {
      callback(this);
    }
    return this;
  }

  /**
   * Add content only if the array is not empty.
   *
   * @example
   * ```typescript
   * doc.ifNotEmpty(warnings, (d, items) => d.section('Warnings').list(items));
   * ```
   */
  ifNotEmpty<T>(items: T[], callback: (doc: this, items: T[]) => void): this {
    if (items.length > 0) {
      callback(this, items);
    }
    return this;
  }

  /**
   * Iterate over items and add content for each.
   *
   * @example
   * ```typescript
   * doc.forEach(users, (d, user, i) => d.text(`${i + 1}. ${user.name}`));
   * ```
   */
  forEach<T>(
    items: T[],
    callback: (doc: this, item: T, index: number) => void
  ): this {
    items.forEach((item, i) => {
      callback(this, item, i);
    });
    return this;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Utility methods
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Check if the document has no content.
   */
  isEmpty(): boolean {
    return this.blocks.length === 0;
  }

  /**
   * Create a shallow copy of the document.
   */
  clone(): Document {
    const copy = new Document();
    copy.blocks = [...this.blocks];
    return copy;
  }

  /**
   * Get the raw blocks array.
   */
  getBlocks(): Block[] {
    return this.blocks;
  }

  /**
   * Convert document to markdown string.
   */
  toMarkdown(): string {
    return outputMarkdown(this.blocks);
  }

  /**
   * Convert document to plain text string.
   */
  toPlainText(): string {
    return outputPlainText(this.blocks);
  }
}

/**
 * Factory function to create a new Document.
 *
 * @example
 * ```typescript
 * const message = doc().header('Title').text('Content');
 * ```
 */
export function doc(options?: DocumentOptions): Document {
  return new Document(options);
}
