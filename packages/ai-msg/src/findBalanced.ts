export function findBalanced(
  text: string,
  openChar: string,
  closeChar: string
): string | null {
  const start = text.indexOf(openChar);
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === "\\") {
      if (inString) {
        escaped = true;
      }
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (ch === openChar) {
      depth++;
    } else if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

export function findAllBalanced(
  text: string,
  openChar: string,
  closeChar: string
): string[] {
  const results: string[] = [];
  let offset = 0;

  while (offset < text.length) {
    const remaining = text.slice(offset);
    const match = findBalanced(remaining, openChar, closeChar);
    if (match === null) break;

    results.push(match);
    const matchStart = remaining.indexOf(openChar);
    offset += matchStart + match.length;
  }

  return results;
}
