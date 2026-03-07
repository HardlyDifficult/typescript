import type { RequestOptions } from "./types.js";

export type NotionRequestFn = <T>(
  method: "GET" | "PATCH" | "POST",
  path: string,
  body?: unknown,
  options?: RequestOptions
) => Promise<T>;
