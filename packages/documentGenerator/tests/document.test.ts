import { describe, it, expect } from 'vitest';
import { doc, Document } from '../src/index.js';

describe('Document', () => {
  describe('doc()', () => {
    it('creates a Document instance', () => {
      const document = doc();
      expect(document).toBeInstanceOf(Document);
    });
  });

  describe('chainable methods', () => {
    it('header() adds a header block and returns this', () => {
      const document = doc().header('Test Header');
      expect(document).toBeInstanceOf(Document);
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'header',
        text: 'Test Header',
      });
    });

    it('text() adds a text block and returns this', () => {
      const document = doc().text('Test content');
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
      const document = doc().list(items);
      expect(document).toBeInstanceOf(Document);
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'list',
        items,
      });
    });

    it('divider() adds a divider block and returns this', () => {
      const document = doc().divider();
      expect(document).toBeInstanceOf(Document);
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'divider',
      });
    });

    it('context() adds a context block and returns this', () => {
      const document = doc().context('Context text');
      expect(document).toBeInstanceOf(Document);
      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(1);
      expect(blocks[0]).toEqual({
        type: 'context',
        text: 'Context text',
      });
    });

    it('link() adds a link block and returns this', () => {
      const document = doc().link('Link Text', 'https://example.com');
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
      const document = doc().code('const x = 1;');
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
      const document = doc().image('https://example.com/image.png', 'Alt text');
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
      const document = doc().image('https://example.com/image.png');
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
      const document = doc()
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
      const document = doc()
        .header('Header')
        .text('Text')
        .list(['Item']);

      const blocks = document.getBlocks();
      expect(blocks).toHaveLength(3);
      expect(blocks[0].type).toBe('header');
      expect(blocks[1].type).toBe('text');
      expect(blocks[2].type).toBe('list');
    });

    it('returns empty array for new document', () => {
      const document = doc();
      const blocks = document.getBlocks();
      expect(blocks).toEqual([]);
    });
  });

  describe('code() multiline detection', () => {
    it('detects single line code as multiline: false', () => {
      const document = doc().code('const x = 1;');
      const blocks = document.getBlocks();
      expect(blocks[0]).toEqual({
        type: 'code',
        content: 'const x = 1;',
        multiline: false,
      });
    });

    it('detects multiline code as multiline: true when content contains \\n', () => {
      const document = doc().code('const x = 1;\nconst y = 2;');
      const blocks = document.getBlocks();
      expect(blocks[0]).toEqual({
        type: 'code',
        content: 'const x = 1;\nconst y = 2;',
        multiline: true,
      });
    });

    it('detects multiline code with multiple lines', () => {
      const document = doc().code('function test() {\n  return true;\n}');
      const blocks = document.getBlocks();
      expect(blocks[0]).toEqual({
        type: 'code',
        content: 'function test() {\n  return true;\n}',
        multiline: true,
      });
    });

    it('detects multiline code with leading newline', () => {
      const document = doc().code('\nconst x = 1;');
      const blocks = document.getBlocks();
      expect(blocks[0]).toEqual({
        type: 'code',
        content: '\nconst x = 1;',
        multiline: true,
      });
    });

    it('detects multiline code with trailing newline', () => {
      const document = doc().code('const x = 1;\n');
      const blocks = document.getBlocks();
      expect(blocks[0]).toEqual({
        type: 'code',
        content: 'const x = 1;\n',
        multiline: true,
      });
    });
  });
});
