// Main classes and factory
export { Document, doc } from './Document.js';

// Types
export type {
  Block,
  HeaderBlock,
  TextBlock,
  ListBlock,
  DividerBlock,
  ContextBlock,
  LinkBlock,
  CodeBlock,
  ImageBlock,
  Platform,
} from './types.js';

// Outputters (for direct use)
export { toMarkdown } from './outputters/markdown.js';
export { toPlainText } from './outputters/plainText.js';

// Markdown converter (for custom outputters)
export { convertMarkdown, stripMarkdown } from './markdownConverter.js';
