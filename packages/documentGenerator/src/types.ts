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
