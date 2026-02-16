function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s\-_]/g, "");
}

/**
 * Find the best match for a source name in a list of destination names.
 * Uses normalized comparison (strips whitespace, hyphens, underscores)
 * with bidirectional partial matching as a fallback.
 *
 * @returns The matching destination name, or undefined if no match found
 */
export function findBestMatch(
  sourceName: string,
  destinationNames: readonly string[]
): string | undefined {
  const sourceNorm = normalize(sourceName);

  // 1. Exact normalized match ("To Do" → "todo" matches "Todo" → "todo")
  const exact = destinationNames.find((d) => normalize(d) === sourceNorm);
  if (exact !== undefined) {
    return exact;
  }

  // 2. Bidirectional partial on normalized strings
  return destinationNames.find((d) => {
    const destNorm = normalize(d);
    return destNorm.includes(sourceNorm) || sourceNorm.includes(destNorm);
  });
}
