import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Document, doc } from '../src/index.js';

describe('Document', () => {
  describe('constructor', () => {
    it('creates a Document instance', () => {
      const document = new Document();
      expect(document).toBeInstanceOf(Document);
    });
  });

  describe('chainable methods', () => {
    it('header() adds a header block and returns this', () => {
      const document = new Document().header('Test Header');
      expect(document).toBeInstanceOf(Document);
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'header',
        text: 'Test Header',
      });
    });

    it('text() adds a text block and returns this', () => {
      const document = new Document().text('Test content');
      expect(document).toBeInstanceOf(Document);
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'text',
        content: 'Test content',
      });
    });

    it('list() adds a list block and returns this', () => {
      const items = ['Item 1', 'Item 2', 'Item 3'];
      const document = new Document().list(items);
      expect(document).toBeInstanceOf(Document);
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'list',
        items,
      });
    });

    it('divider() adds a divider block and returns this', () => {
      const document = new Document().divider();
      expect(document).toBeInstanceOf(Document);
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'divider',
      });
    });

    it('context() adds a context block and returns this', () => {
      const document = new Document().context('Context text');
      expect(document).toBeInstanceOf(Document);
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'context',
        text: 'Context text',
      });
    });

    it('link() adds a link block and returns this', () => {
      const document = new Document().link('Link Text', 'https://example.com');
      expect(document).toBeInstanceOf(Document);
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'link',
        text: 'Link Text',
        url: 'https://example.com',
      });
    });

    it('code() adds a code block and returns this', () => {
      const document = new Document().code('const x = 1;');
      expect(document).toBeInstanceOf(Document);
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'code',
        content: 'const x = 1;',
        multiline: false,
      });
    });

    it('image() adds an image block and returns this', () => {
      const document = new Document().image('https://example.com/image.png', 'Alt text');
      expect(document).toBeInstanceOf(Document);
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'image',
        url: 'https://example.com/image.png',
        alt: 'Alt text',
      });
    });

    it('image() without alt adds an image block with undefined alt', () => {
      const document = new Document().image('https://example.com/image.png');
      const blocks = document.getBlocks();
      expect(blocks[0]).toEqual({
        type: 'image',
        url: 'https://example.com/image.png',
        alt: undefined,
      });
    });
  });

  describe('method chaining', () => {
    it('methods are chainable', () => {
      const document = new Document()
        .header('Title')
        .text('Content')
        .list(['Item 1', 'Item 2'])
        .divider()
        .context('Context')
        .link('Link', 'https://example.com')
        .code('code')
        .image('https://example.com/img.png');

      expect(document).toBeInstanceOf(Document);
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(8);
      expect(blocks[0].type).toBe('header');
      expect(blocks[1].type).toBe('text');
      expect(blocks[2].type).toBe('list');
      expect(blocks[3].type).toBe('divider');
      expect(blocks[4].type).toBe('context');
      expect(blocks[5].type).toBe('link');
      expect(blocks[6].type).toBe('code');
      expect(blocks[7].type).toBe('image');
    });
  });

  describe('getBlocks()', () => {
    it('returns all added blocks', () => {
      const document = new Document().header('Header').text('Text').list(['Item']);

      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(3);
      expect(blocks[0].type).toBe('header');
      expect(blocks[1].type).toBe('text');
      expect(blocks[2].type).toBe('list');
    });

    it('returns empty array for new document', () => {
      const document = new Document();
      const blocks = document.getBlocks();
      expect(blocks).toEqual([]);
    });
  });

  describe('code() multiline detection', () => {
    it('detects single line code as multiline: false', () => {
      const document = new Document().code('const x = 1;');
      const blocks = document.getBlocks();
      expect(blocks[0]).toEqual({
        type: 'code',
        content: 'const x = 1;',
        multiline: false,
      });
    });

    it('detects multiline code as multiline: true when content contains \\n', () => {
      const document = new Document().code('const x = 1;\nconst y = 2;');
      const blocks = document.getBlocks();
      expect(blocks[0]).toEqual({
        type: 'code',
        content: 'const x = 1;\nconst y = 2;',
        multiline: true,
      });
    });

    it('detects multiline code with multiple lines', () => {
      const document = new Document().code('function test() {\n  return true;\n}');
      const blocks = document.getBlocks();
      expect(blocks[0]).toEqual({
        type: 'code',
        content: 'function test() {\n  return true;\n}',
        multiline: true,
      });
    });

    it('detects multiline code with leading newline', () => {
      const document = new Document().code('\nconst x = 1;');
      const blocks = document.getBlocks();
      expect(blocks[0]).toEqual({
        type: 'code',
        content: '\nconst x = 1;',
        multiline: true,
      });
    });

    it('detects multiline code with trailing newline', () => {
      const document = new Document().code('const x = 1;\n');
      const blocks = document.getBlocks();
      expect(blocks[0]).toEqual({
        type: 'code',
        content: 'const x = 1;\n',
        multiline: true,
      });
    });
  });

  describe('constructor with options', () => {
    it('creates document with header', () => {
      const document = new Document({ header: 'My Title' });
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({ type: 'header', text: 'My Title' });
    });

    it('creates document with sections', () => {
      const document = new Document({
        sections: [
          { title: 'Section 1', content: 'Content 1' },
          { content: 'Content without title' },
        ],
      });
      const blocks = document.getBlocks();
      // Section with title: header + divider + text = 3 blocks
      // Section without title: just text = 1 block
      expect(blocks).toHaveLength(4);
      expect(blocks[0]).toEqual({ type: 'header', text: 'Section 1' });
      expect(blocks[1]).toEqual({ type: 'divider' });
      expect(blocks[2]).toEqual({ type: 'text', content: 'Content 1' });
      expect(blocks[3]).toEqual({ type: 'text', content: 'Content without title' });
    });

    it('creates document with context key-value pairs', () => {
      const document = new Document({
        context: { Network: 'mainnet', Count: 42 },
      });
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(2); // divider + text
      expect(blocks[0]).toEqual({ type: 'divider' });
      expect(blocks[1]).toEqual({
        type: 'text',
        content: '**Network**: mainnet\n**Count**: 42',
      });
    });

    it('creates full document with all options', () => {
      const document = new Document({
        header: 'Report',
        sections: [{ title: 'Summary', content: 'All good' }],
        context: { Status: 'OK' },
      });
      const blocks = document.getBlocks();
      // header(1) + section(header+divider=2) + text(1) + context(divider+text=2) = 6
      expect(blocks).toHaveLength(6);
    });
  });

  describe('doc() factory function', () => {
    it('creates empty document', () => {
      const document = doc();
      expect(document).toBeInstanceOf(Document);
      expect(document.isEmpty()).toBe(true);
    });

    it('creates document with options', () => {
      const document = doc({ header: 'Test' });
      expect(document).toBeInstanceOf(Document);
      expect(document.getBlocks()[0]).toEqual({ type: 'header', text: 'Test' });
    });

    it('is chainable', () => {
      const document = doc().header('Title').text('Content');
      expect(document.getBlocks()).toHaveLength(2);
    });
  });

  describe('section()', () => {
    it('adds header and divider', () => {
      const document = new Document().section('My Section');
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toEqual({ type: 'header', text: 'My Section' });
      expect(blocks[1]).toEqual({ type: 'divider' });
    });

    it('is chainable', () => {
      const document = new Document().section('Section 1').text('Content').section('Section 2');
      expect(document.getBlocks()).toHaveLength(5);
    });
  });

  describe('keyValue()', () => {
    it('formats key-value pairs with bold keys', () => {
      const document = new Document().keyValue({ Name: 'Alice', Age: 30 });
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'text',
        content: '**Name**: Alice\n**Age**: 30',
      });
    });

    it('filters out undefined values', () => {
      const document = new Document().keyValue({ Name: 'Bob', Email: undefined });
      const blocks = document.getBlocks();
      expect(blocks[0]).toEqual({
        type: 'text',
        content: '**Name**: Bob',
      });
    });

    it('does nothing for empty data after filtering', () => {
      const document = new Document().keyValue({ Email: undefined });
      expect(document.getBlocks()).toHaveLength(0);
    });

    it('supports bullet style', () => {
      const document = new Document().keyValue({ A: '1', B: '2' }, { style: 'bullet' });
      expect(document.getBlocks()[0]).toEqual({
        type: 'text',
        content: '• **A**: 1\n• **B**: 2',
      });
    });

    it('supports numbered style', () => {
      const document = new Document().keyValue({ A: '1', B: '2' }, { style: 'numbered' });
      expect(document.getBlocks()[0]).toEqual({
        type: 'text',
        content: '1. **A**: 1\n2. **B**: 2',
      });
    });

    it('supports custom separator', () => {
      const document = new Document().keyValue({ Name: 'Alice' }, { separator: ' =' });
      expect(document.getBlocks()[0]).toEqual({
        type: 'text',
        content: '**Name** = Alice',
      });
    });

    it('supports non-bold keys', () => {
      const document = new Document().keyValue({ Name: 'Alice' }, { bold: false });
      expect(document.getBlocks()[0]).toEqual({
        type: 'text',
        content: 'Name: Alice',
      });
    });

    it('handles boolean values', () => {
      const document = new Document().keyValue({ Active: true, Disabled: false });
      expect(document.getBlocks()[0]).toEqual({
        type: 'text',
        content: '**Active**: true\n**Disabled**: false',
      });
    });
  });

  describe('truncatedList()', () => {
    it('renders all items when under limit', () => {
      const document = new Document().truncatedList(['a', 'b', 'c'], { limit: 5 });
      expect(document.getBlocks()[0]).toEqual({
        type: 'text',
        content: '• a\n• b\n• c',
      });
    });

    it('truncates with "and X more" message', () => {
      const document = new Document().truncatedList(['a', 'b', 'c', 'd', 'e'], { limit: 3 });
      expect(document.getBlocks()[0]).toEqual({
        type: 'text',
        content: '• a\n• b\n• c\n_... and 2 more_',
      });
    });

    it('does nothing for empty array', () => {
      const document = new Document().truncatedList([]);
      expect(document.getBlocks()).toHaveLength(0);
    });

    it('supports custom format function', () => {
      const users = [{ name: 'Alice' }, { name: 'Bob' }];
      const document = new Document().truncatedList(users, {
        format: (u) => u.name,
      });
      expect(document.getBlocks()[0]).toEqual({
        type: 'text',
        content: '• Alice\n• Bob',
      });
    });

    it('supports custom moreText function', () => {
      const document = new Document().truncatedList(['a', 'b', 'c'], {
        limit: 2,
        moreText: (n) => `Plus ${n} others`,
      });
      expect(document.getBlocks()[0]).toEqual({
        type: 'text',
        content: '• a\n• b\nPlus 1 others',
      });
    });

    it('supports ordered lists', () => {
      const document = new Document().truncatedList(['a', 'b', 'c'], { ordered: true });
      expect(document.getBlocks()[0]).toEqual({
        type: 'text',
        content: '1. a\n2. b\n3. c',
      });
    });

    it('uses default limit of 10', () => {
      const items = Array.from({ length: 12 }, (_, i) => `item${i}`);
      const document = new Document().truncatedList(items);
      const content = (document.getBlocks()[0] as { type: 'text'; content: string }).content;
      expect(content).toContain('• item9');
      expect(content).toContain('_... and 2 more_');
      expect(content).not.toContain('item10');
    });
  });

  describe('timestamp()', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-02-04T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('adds timestamp with emoji by default', () => {
      const document = new Document().timestamp();
      expect(document.getBlocks()[0]).toEqual({
        type: 'context',
        text: '🕐 2024-02-04T12:00:00.000Z',
      });
    });

    it('supports emoji: false', () => {
      const document = new Document().timestamp({ emoji: false });
      expect(document.getBlocks()[0]).toEqual({
        type: 'context',
        text: '2024-02-04T12:00:00.000Z',
      });
    });

    it('supports custom prefix', () => {
      const document = new Document().timestamp({ prefix: 'Generated at' });
      expect(document.getBlocks()[0]).toEqual({
        type: 'context',
        text: 'Generated at 2024-02-04T12:00:00.000Z',
      });
    });

    it('supports custom date', () => {
      const customDate = new Date('2025-01-01T00:00:00.000Z');
      const document = new Document().timestamp({ date: customDate });
      expect(document.getBlocks()[0]).toEqual({
        type: 'context',
        text: '🕐 2025-01-01T00:00:00.000Z',
      });
    });
  });

  describe('if()', () => {
    it('executes callback when condition is true', () => {
      const document = new Document().if(true, (d) => d.text('Added'));
      expect(document.getBlocks()).toHaveLength(1);
      expect(document.getBlocks()[0]).toEqual({ type: 'text', content: 'Added' });
    });

    it('skips callback when condition is false', () => {
      const document = new Document().if(false, (d) => d.text('Not added'));
      expect(document.getBlocks()).toHaveLength(0);
    });

    it('is chainable', () => {
      const document = new Document()
        .text('Before')
        .if(true, (d) => d.text('Middle'))
        .text('After');
      expect(document.getBlocks()).toHaveLength(3);
    });
  });

  describe('ifNotEmpty()', () => {
    it('executes callback when array has items', () => {
      const items = ['a', 'b'];
      const document = new Document().ifNotEmpty(items, (d, arr) => d.list(arr));
      expect(document.getBlocks()).toHaveLength(1);
      expect(document.getBlocks()[0]).toEqual({ type: 'list', items: ['a', 'b'] });
    });

    it('skips callback when array is empty', () => {
      const document = new Document().ifNotEmpty([], (d) => d.text('Not added'));
      expect(document.getBlocks()).toHaveLength(0);
    });

    it('passes items to callback', () => {
      const items = [1, 2, 3];
      let receivedItems: number[] = [];
      new Document().ifNotEmpty(items, (_, arr) => {
        receivedItems = arr;
      });
      expect(receivedItems).toEqual([1, 2, 3]);
    });
  });

  describe('forEach()', () => {
    it('iterates over items', () => {
      const items = ['a', 'b', 'c'];
      const document = new Document().forEach(items, (d, item) => d.text(item));
      expect(document.getBlocks()).toHaveLength(3);
      expect(document.getBlocks()[0]).toEqual({ type: 'text', content: 'a' });
      expect(document.getBlocks()[1]).toEqual({ type: 'text', content: 'b' });
      expect(document.getBlocks()[2]).toEqual({ type: 'text', content: 'c' });
    });

    it('provides index to callback', () => {
      const items = ['a', 'b'];
      const document = new Document().forEach(items, (d, item, i) => d.text(`${i}: ${item}`));
      expect(document.getBlocks()[0]).toEqual({ type: 'text', content: '0: a' });
      expect(document.getBlocks()[1]).toEqual({ type: 'text', content: '1: b' });
    });

    it('handles empty array', () => {
      const document = new Document().forEach([], (d) => d.text('never'));
      expect(document.getBlocks()).toHaveLength(0);
    });
  });

  describe('isEmpty()', () => {
    it('returns true for new document', () => {
      const document = new Document();
      expect(document.isEmpty()).toBe(true);
    });

    it('returns false after adding content', () => {
      const document = new Document().text('Content');
      expect(document.isEmpty()).toBe(false);
    });
  });

  describe('clone()', () => {
    it('creates a copy with same blocks', () => {
      const original = new Document().header('Title').text('Content');
      const copy = original.clone();

      expect(copy.getBlocks()).toEqual(original.getBlocks());
      expect(copy).not.toBe(original);
    });

    it('modifications to clone do not affect original', () => {
      const original = new Document().text('Original');
      const copy = original.clone();
      copy.text('Added to copy');

      expect(original.getBlocks()).toHaveLength(1);
      expect(copy.getBlocks()).toHaveLength(2);
    });
  });

  describe('Document.truncate()', () => {
    it('returns text unchanged when under limit', () => {
      expect(Document.truncate('hello', 10)).toBe('hello');
    });

    it('truncates with ellipsis when over limit', () => {
      expect(Document.truncate('hello world', 8)).toBe('hello...');
    });

    it('handles exact length', () => {
      expect(Document.truncate('hello', 5)).toBe('hello');
    });

    it('handles length just under limit', () => {
      expect(Document.truncate('hello', 6)).toBe('hello');
    });
  });
});
