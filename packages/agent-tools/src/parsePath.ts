export interface ParsedPath {
  filePath: string;
  startLine?: number;
  endLine?: number;
}

/**
 * Parse a GitHub-style path with optional line range.
 *
 * Examples:
 *   'src/index.ts'          → { filePath: 'src/index.ts' }
 *   'src/index.ts#L10'      → { filePath: 'src/index.ts', startLine: 10, endLine: 10 }
 *   'src/index.ts#L10-L20'  → { filePath: 'src/index.ts', startLine: 10, endLine: 20 }
 *   'src/index.ts#L20-L10'  → { filePath: 'src/index.ts', startLine: 10, endLine: 20 }
 */
export function parsePath(path: string): ParsedPath {
  const match = /^(.+?)#L([1-9]\d*)(?:-L([1-9]\d*))?$/.exec(path);
  if (!match) {
    return { filePath: path };
  }

  const filePath = match[1];
  const startLine = Number.parseInt(match[2], 10);
  const endLine = match[3] ? Number.parseInt(match[3], 10) : startLine;

  if (startLine <= endLine) {
    return { filePath, startLine, endLine };
  }

  return { filePath, startLine: endLine, endLine: startLine };
}
