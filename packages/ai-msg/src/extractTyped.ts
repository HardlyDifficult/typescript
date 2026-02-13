import { type ZodType } from "zod";

import { extractJson } from "./extractJson.js";

export function extractTyped<T>(
  text: string,
  schema: ZodType<T>,
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
