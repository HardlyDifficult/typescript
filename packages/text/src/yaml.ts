/**
 * Simple YAML field extraction utilities.
 * Provides line-based parsing for extracting specific fields from YAML documents.
 */

/**
 * Extract a specific field value from a YAML document.
 * Handles both inline and multi-line (|) field values.
 *
 * @param yamlContent - The YAML document content
 * @param fieldName - The field name to extract (e.g., "purpose", "sha")
 * @returns The field value, or null if not found
 *
 * @example
 * ```ts
 * const yaml = `
 * version: 1
 * sha: abc123
 * purpose: |
 *   This is a multi-line
 *   purpose field.
 * `;
 * extractYamlField(yaml, 'sha'); // 'abc123'
 * extractYamlField(yaml, 'purpose'); // 'This is a multi-line purpose field.'
 * ```
 */
export function extractYamlField(yamlContent: string, fieldName: string): string | null {
  const lines = yamlContent.split('\n');
  let inField = false;
  const fieldLines: string[] = [];

  for (const line of lines) {
    const fieldPrefix = `${fieldName}:`;
    if (line.startsWith(fieldPrefix)) {
      const inline = line.slice(fieldPrefix.length).trim();

      // Handle quoted strings
      if (inline.startsWith('"') && inline.endsWith('"')) {
        return inline.slice(1, -1);
      }

      // Handle inline values (not |)
      if (inline && inline !== '|') {
        return inline;
      }

      // Multi-line value
      inField = true;
      continue;
    }

    if (inField) {
      // Continue reading indented lines
      if (line.startsWith('  ') || line === '') {
        fieldLines.push(line.trim());
      } else {
        // Next field started, stop
        break;
      }
    }
  }

  const fullValue = fieldLines.join(' ').trim();
  return fullValue || null;
}
