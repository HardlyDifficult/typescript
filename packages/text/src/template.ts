/**
 * Simple template utility for placeholder replacement.
 * Replaces {{variable}} placeholders with provided values.
 */

/**
 * Replace template placeholders with values
 *
 * @param template - The template string with {{variable}} placeholders
 * @param values - Object mapping variable names to their values
 * @returns The template with placeholders replaced
 */
export function replaceTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(values, key)) {
      return values[key] ?? match;
    }
    return match;
  });
}

/**
 * Extract all placeholder names from a template
 *
 * @param template - The template string with {{variable}} placeholders
 * @returns Array of unique placeholder names
 */
export function extractPlaceholders(template: string): string[] {
  const matches = template.matchAll(/\{\{(\w+)\}\}/g);
  const placeholders = new Set<string>();

  for (const match of matches) {
    if (match[1]) {
      placeholders.add(match[1]);
    }
  }

  return Array.from(placeholders);
}
