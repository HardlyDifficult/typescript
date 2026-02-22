/**
 * Strip ANSI escape codes (colors, formatting) from a string.
 *
 * Handles SGR sequences (`\x1b[...m`) which cover all standard
 * terminal color and style codes.
 */
// eslint-disable-next-line no-control-regex
const ANSI_RE = /\x1b\[[0-9;]*m/g;

export function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, "");
}
