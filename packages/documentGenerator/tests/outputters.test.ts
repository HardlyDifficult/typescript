import { describe, it, expect } from 'vitest';
import { toMarkdown, toPlainText } from '../src/index.js';
import type { Block } from '../src/index.js';

describe('toMarkdown', () => {
  it('converts header block', () => {
    const blocks: Block[] = [
      { type: 'header', text: 'Test Header' },
    ];
    expect(toMarkdown(blocks)).toBe('# Test Header\n\n');
  });

  it('converts text block', () => {
    const blocks: Block[] = [
      { type: 'text', content: 'Test content' },
    ];
    expect(toMarkdown(blocks)).toBe('Test content\n\n');
  });

  it('converts list block', () => {
    const blocks: Block[] = [
      { type: 'list', items: ['Item 1', 'Item 2', 'Item 3'] },
    ];
    expect(toMarkdown(blocks)).toBe('- Item 1\n- Item 2\n- Item 3\n\n');
  });

  it('converts divider block', () => {
    const blocks: Block[] = [
      { type: 'divider' },
    ];
    expect(toMarkdown(blocks)).toBe('---\n\n');
  });

  it('converts context block', () => {
    const blocks: Block[] = [
      { type: 'context', text: 'Context text' },
    ];
    expect(toMarkdown(blocks)).toBe('*Context text*\n\n');
  });

  it('converts link block', () => {
    const blocks: Block[] = [
      { type: 'link', text: 'Link Text', url: 'https://example.com' },
    ];
    expect(toMarkdown(blocks)).toBe('[Link Text](https://example.com)\n\n');
  });

  it('converts single-line code block', () => {
    const blocks: Block[] = [
      { type: 'code', content: 'const x = 1;', multiline: false },
    ];
    expect(toMarkdown(blocks)).toBe('`const x = 1;`\n\n');
  });

  it('converts multiline code block', () => {
    const blocks: Block[] = [
      { type: 'code', content: 'const x = 1;\nconst y = 2;', multiline: true },
    ];
    expect(toMarkdown(blocks)).toBe('```\nconst x = 1;\nconst y = 2;\n```\n\n');
  });

  it('converts image block with alt text', () => {
    const blocks: Block[] = [
      { type: 'image', url: 'https://example.com/image.png', alt: 'Alt text' },
    ];
    expect(toMarkdown(blocks)).toBe('![Alt text](https://example.com/image.png)\n\n');
  });

  it('converts image block without alt text (uses url)', () => {
    const blocks: Block[] = [
      { type: 'image', url: 'https://example.com/image.png' },
    ];
    expect(toMarkdown(blocks)).toBe('![https://example.com/image.png](https://example.com/image.png)\n\n');
  });

  it('converts multiple blocks', () => {
    const blocks: Block[] = [
      { type: 'header', text: 'Title' },
      { type: 'text', content: 'Content' },
      { type: 'list', items: ['Item 1', 'Item 2'] },
      { type: 'divider' },
      { type: 'context', text: 'Context' },
      { type: 'link', text: 'Link', url: 'https://example.com' },
      { type: 'code', content: 'code', multiline: false },
      { type: 'image', url: 'https://example.com/img.png', alt: 'Image' },
    ];
    const result = toMarkdown(blocks);
    expect(result).toBe(
      '# Title\n\n' +
      'Content\n\n' +
      '- Item 1\n- Item 2\n\n' +
      '---\n\n' +
      '*Context*\n\n' +
      '[Link](https://example.com)\n\n' +
      '`code`\n\n' +
      '![Image](https://example.com/img.png)\n\n'
    );
  });

  it('handles empty blocks array', () => {
    expect(toMarkdown([])).toBe('');
  });
});

describe('toPlainText', () => {
  it('converts header block', () => {
    const blocks: Block[] = [
      { type: 'header', text: 'Test Header' },
    ];
    expect(toPlainText(blocks)).toBe('TEST HEADER\n\n');
  });

  it('converts text block', () => {
    const blocks: Block[] = [
      { type: 'text', content: 'Test content' },
    ];
    expect(toPlainText(blocks)).toBe('Test content\n\n');
  });

  it('converts text block with markdown formatting (strips formatting)', () => {
    const blocks: Block[] = [
      { type: 'text', content: '**bold** and *italic*' },
    ];
    expect(toPlainText(blocks)).toBe('bold and italic\n\n');
  });

  it('converts list block', () => {
    const blocks: Block[] = [
      { type: 'list', items: ['Item 1', 'Item 2', 'Item 3'] },
    ];
    expect(toPlainText(blocks)).toBe('• Item 1\n• Item 2\n• Item 3\n\n');
  });

  it('converts list block with markdown formatting (strips formatting)', () => {
    const blocks: Block[] = [
      { type: 'list', items: ['**Bold** item', '*Italic* item'] },
    ];
    expect(toPlainText(blocks)).toBe('• Bold item\n• Italic item\n\n');
  });

  it('converts divider block', () => {
    const blocks: Block[] = [
      { type: 'divider' },
    ];
    expect(toPlainText(blocks)).toBe('────────────────\n\n');
  });

  it('converts context block', () => {
    const blocks: Block[] = [
      { type: 'context', text: 'Context text' },
    ];
    expect(toPlainText(blocks)).toBe('Context text\n\n');
  });

  it('converts context block with markdown formatting (strips formatting)', () => {
    const blocks: Block[] = [
      { type: 'context', text: '**Bold** context' },
    ];
    expect(toPlainText(blocks)).toBe('Bold context\n\n');
  });

  it('converts link block', () => {
    const blocks: Block[] = [
      { type: 'link', text: 'Link Text', url: 'https://example.com' },
    ];
    expect(toPlainText(blocks)).toBe('Link Text (https://example.com)\n\n');
  });

  it('converts code block', () => {
    const blocks: Block[] = [
      { type: 'code', content: 'const x = 1;', multiline: false },
    ];
    expect(toPlainText(blocks)).toBe('const x = 1;\n\n');
  });

  it('converts multiline code block', () => {
    const blocks: Block[] = [
      { type: 'code', content: 'const x = 1;\nconst y = 2;', multiline: true },
    ];
    expect(toPlainText(blocks)).toBe('const x = 1;\nconst y = 2;\n\n');
  });

  it('converts image block with alt text', () => {
    const blocks: Block[] = [
      { type: 'image', url: 'https://example.com/image.png', alt: 'Alt text' },
    ];
    expect(toPlainText(blocks)).toBe('[Image: Alt text]\n\n');
  });

  it('converts image block without alt text (uses url)', () => {
    const blocks: Block[] = [
      { type: 'image', url: 'https://example.com/image.png' },
    ];
    expect(toPlainText(blocks)).toBe('[Image: https://example.com/image.png]\n\n');
  });

  it('converts complete document with multiple blocks', () => {
    const blocks: Block[] = [
      { type: 'header', text: 'Document Title' },
      { type: 'text', content: 'This is **bold** text' },
      { type: 'list', items: ['First item', 'Second *item*'] },
      { type: 'divider' },
      { type: 'context', text: '**Important** context' },
      { type: 'link', text: 'Visit Site', url: 'https://example.com' },
      { type: 'code', content: 'function test() {\n  return true;\n}', multiline: true },
      { type: 'image', url: 'https://example.com/img.png', alt: 'Example Image' },
    ];
    const result = toPlainText(blocks);
    expect(result).toBe(
      'DOCUMENT TITLE\n\n' +
      'This is bold text\n\n' +
      '• First item\n• Second item\n\n' +
      '────────────────\n\n' +
      'Important context\n\n' +
      'Visit Site (https://example.com)\n\n' +
      'function test() {\n  return true;\n}\n\n' +
      '[Image: Example Image]\n\n'
    );
  });

  it('handles empty blocks array', () => {
    expect(toPlainText([])).toBe('');
  });
});
