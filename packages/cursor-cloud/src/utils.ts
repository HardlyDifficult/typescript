import { z } from "zod";

/** Returns a Promise that resolves after the given number of milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Trims a string and throws if empty. */
export function requireNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error(`${field} is required`);
  }
  return trimmed;
}

/** Strips a trailing slash from a URL. */
export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

/** Parses `data` with a Zod schema and throws a descriptive error on failure. */
export function validateAndParse<T>(
  data: unknown,
  schema: z.ZodType<T>,
  context: string
): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(", ");
      throw new Error(`${context} validation failed: ${issues}`, {
        cause: error,
      });
    }
    throw new Error(`${context} validation failed: ${String(error)}`, {
      cause: error,
    });
  }
}

/** Serialises a plain object into a URL query string (with leading `?`), or `""` if empty. */
export function buildQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      searchParams.append(
        key,
        typeof value === "string" ? value : JSON.stringify(value)
      );
    }
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
}
