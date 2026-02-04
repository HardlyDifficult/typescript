import type { Block } from '../types.js';
import { stripMarkdown } from '../markdownConverter.js';

export function toPlainText(blocks: Block[]): string {
  return blocks.map(block => {
    switch (block.type) {
      case 'header':
        return `${block.text.toUpperCase()}\n\n`;
      
      case 'text':
        return `${stripMarkdown(block.content)}\n\n`;
      
      case 'list':
        return `${block.items.map(item => `• ${stripMarkdown(item)}`).join('\n')}\n\n`;
      
      case 'divider':
        return `────────────────\n\n`;
      
      case 'context':
        return `${stripMarkdown(block.text)}\n\n`;
      
      case 'link':
        return `${block.text} (${block.url})\n\n`;
      
      case 'code':
        return `${block.content}\n\n`;
      
      case 'image':
        const alt = block.alt ?? block.url;
        return `[Image: ${alt}]\n\n`;
      
      default:
        return '';
    }
  }).join('');
}
