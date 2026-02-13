import { type ZodType } from "zod";

import { extractJson } from "./extractJson.js";

export function extractTyped<T>(text: string, schema: ZodType<T>): T | null {
  const json = extractJson(text);
  if (json === null) return null;

  const result = schema.safeParse(json);
  return result.success ? result.data : null;
}
