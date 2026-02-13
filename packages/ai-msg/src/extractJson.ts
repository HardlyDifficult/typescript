import { extractCodeBlock } from "./extractCodeBlock.js";
import { findAllBalanced } from "./findBalanced.js";

function tryParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function extractJson(text: string, sentinel?: string): unknown[] {
  // Sentinel check — if the text contains the sentinel, treat as "no findings"
  if (sentinel !== undefined && text.includes(sentinel)) {
    return [];
  }

  // Pass 1: try the whole text
  const direct = tryParse(text.trim());
  if (direct !== undefined) {
    return [direct];
  }

  // Pass 2: code blocks — json-tagged first, then any
  const fromBlocks: unknown[] = [];
  for (const block of extractCodeBlock(text, "json")) {
    const parsed = tryParse(block.trim());
    if (parsed !== undefined) {
      fromBlocks.push(parsed);
    }
  }
  if (fromBlocks.length === 0) {
    for (const block of extractCodeBlock(text)) {
      const parsed = tryParse(block.trim());
      if (parsed !== undefined) {
        fromBlocks.push(parsed);
      }
    }
  }
  if (fromBlocks.length > 0) {
    return fromBlocks;
  }

  // Pass 3: all balanced braces / brackets in prose
  const results: unknown[] = [];
  for (const match of findAllBalanced(text, "{", "}")) {
    const parsed = tryParse(match);
    if (parsed !== undefined) {
      results.push(parsed);
    }
  }
  for (const match of findAllBalanced(text, "[", "]")) {
    const parsed = tryParse(match);
    if (parsed !== undefined) {
      results.push(parsed);
    }
  }

  return results;
}
