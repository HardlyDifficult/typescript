export interface FileReference {
  path: string;
  lines?: {
    start: number;
    end: number;
  };
}

/**
 * Parse a GitHub-style file reference with an optional line range.
 *
 * Examples:
 *   'src/index.ts'          → { path: 'src/index.ts' }
 *   'src/index.ts#L10'      → { path: 'src/index.ts', lines: { start: 10, end: 10 } }
 *   'src/index.ts#L10-L20'  → { path: 'src/index.ts', lines: { start: 10, end: 20 } }
 *   'src/index.ts#L20-L10'  → { path: 'src/index.ts', lines: { start: 10, end: 20 } }
 */
export function parseFileReference(input: string): FileReference {
  const match = /^(.+?)#L([1-9]\d*)(?:-L([1-9]\d*))?$/.exec(input);
  if (!match) {
    return { path: input };
  }

  const path = match[1];
  const startLine = Number.parseInt(match[2], 10);
  const endLine = match[3] ? Number.parseInt(match[3], 10) : startLine;

  if (startLine <= endLine) {
    return {
      path,
      lines: { start: startLine, end: endLine },
    };
  }

  return {
    path,
    lines: { start: endLine, end: startLine },
  };
}
