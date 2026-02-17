// Main class and factory
export { Document } from "./Document.js";

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
  StringOutputFormat,
  // Document options
  DocumentOptions,
  DocumentSection,
  DocumentLinkTransform,
  DocumentLinkifier,
  DocumentLinkifyOptions,
  SectionContent,
  SectionOptions,
  FieldOptions,
  KeyValueOptions,
  TruncatedListOptions,
  TimestampOptions,
} from "./types.js";

// Outputters (for direct use)
export { toMarkdown } from "./outputters/markdown.js";
export { toPlainText } from "./outputters/plainText.js";
export { toSlack, toSlackText } from "./outputters/slack.js";

// Markdown converter (for custom outputters)
export { convertMarkdown, stripMarkdown } from "./markdownConverter.js";
