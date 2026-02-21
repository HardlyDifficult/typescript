/**
 * Generic middleware for wrapping tool execution with lifecycle hooks.
 * Use this to add logging, metrics, or other cross-cutting concerns to tools.
 */

import type { ToolMap } from "./types.js";

/** Lifecycle hooks called around tool execution. */
export interface ToolMiddleware {
  onStart?(toolName: string, input: Record<string, unknown>): void;
  onSuccess?(
    toolName: string,
    input: Record<string, unknown>,
    output: string,
    durationMs: number
  ): void;
  onError?(
    toolName: string,
    input: Record<string, unknown>,
    error: Error,
    durationMs: number
  ): void;
}

/**
 * Wrap every tool in a ToolMap with middleware lifecycle hooks.
 * Returns a new ToolMap — the original is not modified.
 */
export function wrapToolsWithMiddleware(
  tools: ToolMap,
  middleware: ToolMiddleware
): ToolMap {
  const wrapped: ToolMap = {};

  for (const [name, tool] of Object.entries(tools)) {
    const originalExecute = tool.execute;

    wrapped[name] = {
      ...tool,
      execute: async (input: unknown) => {
        const startTime = Date.now();
        const inputRecord =
          typeof input === "object" && input !== null
            ? (input as Record<string, unknown>)
            : {};

        middleware.onStart?.(name, inputRecord);

        try {
          const result = await originalExecute(input);
          const durationMs = Date.now() - startTime;
          middleware.onSuccess?.(name, inputRecord, result, durationMs);
          return result;
        } catch (error) {
          const durationMs = Date.now() - startTime;
          const err = error instanceof Error ? error : new Error(String(error));
          middleware.onError?.(name, inputRecord, err, durationMs);
          throw error;
        }
      },
    };
  }

  return wrapped;
}
