import type { MessageContent } from './types';
import type { Document } from '@hardlydifficult/document-generator';

/**
 * Type guard to check if content is a Document
 */
export function isDocument(content: MessageContent): content is Document {
  return typeof content !== 'string' && 'getBlocks' in content;
}
