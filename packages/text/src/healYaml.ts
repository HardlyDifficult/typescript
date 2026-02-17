/**
 * Heal common YAML formatting issues from LLM output.
 *
 * Fixes applied:
 * - Strips markdown code fences (```yaml ... ```)
 * - Quotes plain scalar values that contain colons (prevents "nested mappings" parse errors)
 */
export function healYaml(yaml: string): string {
  let cleaned = yaml.trim();

  // Strip markdown code fences
  if (cleaned.startsWith("```")) {
    const firstNewline = cleaned.indexOf("\n");
    cleaned = cleaned.slice(firstNewline + 1);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, cleaned.lastIndexOf("```"));
  }
  cleaned = cleaned.trim();

  // Quote plain scalar values that contain `: ` (colon-space).
  // Pattern matches `key: value` where value is a plain scalar containing a colon.
  // Skips values already quoted (`"`), single-quoted (`'`), block scalars (`|`, `>`),
  // or flow collections (`[`, `{`).
  cleaned = cleaned.replace(
    /^(\s*\w+:[ \t]+)(?!["'|>[{])(.+:.+)$/gm,
    (_, prefix: string, value: string) => {
      const escaped = value.replace(/"/g, '\\"');
      return `${prefix}"${escaped}"`;
    },
  );

  return cleaned;
}
