import { extractJson } from "./extractJson.js";

/**
 * Any schema with a safeParse method (e.g. Zod 3, Zod 4, or custom).
 * Using a structural type avoids coupling to a specific Zod version.
 */
export interface SchemaLike<T> {
  safeParse(
    data: unknown
  ): { success: true; data: T } | { success: false; error?: unknown };
}

export function extractTyped<T>(
  text: string,
  schema: SchemaLike<T>,
  sentinel?: string
): T[] {
  const results = extractJson(text, sentinel);
  const validated: T[] = [];
  for (const json of results) {
    const result = schema.safeParse(json);
    if (result.success) {
      validated.push(result.data);
    }
  }
  return validated;
}
