import { extractCodeBlock } from "./extractCodeBlock.js";
import { findBalanced } from "./findBalanced.js";

function tryParse(text: string): unknown | undefined {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export function extractJson(text: string): unknown | null {
  // Pass 1: try the whole text
  const direct = tryParse(text.trim());
  if (direct !== undefined) return direct;

  // Pass 2: code blocks — json-tagged first, then any
  for (const block of extractCodeBlock(text, "json")) {
    const parsed = tryParse(block.trim());
    if (parsed !== undefined) return parsed;
  }
  for (const block of extractCodeBlock(text)) {
    const parsed = tryParse(block.trim());
    if (parsed !== undefined) return parsed;
  }

  // Pass 3: balanced braces / brackets
  const obj = findBalanced(text, "{", "}");
  if (obj) {
    const parsed = tryParse(obj);
    if (parsed !== undefined) return parsed;
  }

  const arr = findBalanced(text, "[", "]");
  if (arr) {
    const parsed = tryParse(arr);
    if (parsed !== undefined) return parsed;
  }

  return null;
}
