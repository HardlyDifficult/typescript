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
} from './types.js';
import { toMarkdown as outputMarkdown } from './outputters/markdown.js';
import { toPlainText as outputPlainText } from './outputters/plainText.js';

export class Document {
  private blocks: Block[] = [];

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

  getBlocks(): Block[] {
    return this.blocks;
  }

  toMarkdown(): string {
    return outputMarkdown(this.blocks);
  }

  toPlainText(): string {
    return outputPlainText(this.blocks);
  }
}
