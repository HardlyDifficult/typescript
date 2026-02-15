/**
 * Convert a string to a URL/filename-safe slug.
 *
 * Lowercases, replaces non-alphanumeric runs with single hyphens,
 * and trims leading/trailing hyphens. When `maxLength` is provided,
 * truncates at a hyphen boundary to avoid cutting mid-word.
 *
 * @example
 * ```typescript
 * slugify("My Feature Name!") // "my-feature-name"
 * slugify("My Feature Name!", 10) // "my-feature"
 * ```
 */
export function slugify(input: string, maxLength?: number): string {
  let slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (maxLength !== undefined && slug.length > maxLength) {
    const cutAtBoundary = slug[maxLength] === "-";
    slug = slug.slice(0, maxLength);

    if (!cutAtBoundary) {
      const lastHyphen = slug.lastIndexOf("-");
      if (lastHyphen > 0) {
        slug = slug.slice(0, lastHyphen);
      }
    }

    slug = slug.replace(/-+$/, "");
  }

  return slug;
}
