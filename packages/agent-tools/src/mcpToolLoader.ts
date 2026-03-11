/**
 * Auto-discovers MCP tools from a directory.
 *
 * Each file in the directory should export a `tool` that satisfies McpTool.
 * Adding a new tool is as simple as creating a new file in that directory.
 */

import fs from "fs";
import path from "path";

/** Shape of a single MCP tool module. Generic over input schema and dependencies. */
export interface McpTool<TSchema = unknown, TDeps = unknown> {
  name: string;
  title?: string;
  description: string;
  inputSchema: TSchema;
  execute: (
    args: never,
    deps: TDeps
  ) => Promise<{ content: { type: string; text: string }[] }>;
}

/** Minimal MCP server interface — register a tool by name. */
export interface McpServerLike {
  registerTool(
    name: string,
    meta: { title?: string; description: string; inputSchema: unknown },
    handler: (args: unknown) => Promise<unknown>
  ): void;
}

/** Logger interface for the tool loader. */
export interface McpToolLoaderLogger {
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  debug(msg: string, meta?: Record<string, unknown>): void;
}

/**
 * Discover and register MCP tools from a directory.
 * Each .js file in `toolsDir` should export `{ tool: McpTool }`.
 */
export async function registerMcpTools(
  server: McpServerLike,
  deps: unknown,
  toolsDir: string,
  logger?: McpToolLoaderLogger
): Promise<number> {
  let files: string[];
  try {
    files = fs.readdirSync(toolsDir).filter((f) => f.endsWith(".js"));
  } catch {
    logger?.warn("MCP toolLoader: tools directory not found or unreadable", {
      toolsDir,
    });
    return 0;
  }

  let registeredCount = 0;
  for (const file of files) {
    const fullPath = path.join(toolsDir, file);
    try {
      const mod = (await import(fullPath)) as { tool?: McpTool };
      const { tool } = mod;
      if (tool === undefined) {
        logger?.warn("MCP toolLoader: file has no exported `tool`", { file });
        continue;
      }

      server.registerTool(
        tool.name,
        {
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
        },
        (args) => tool.execute(args as never, deps)
      );

      registeredCount += 1;
    } catch (err) {
      logger?.error("MCP toolLoader: failed to load tool", {
        file,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger?.debug("MCP toolLoader: registered tools", {
    toolsDir,
    count: registeredCount,
  });
  return registeredCount;
}
