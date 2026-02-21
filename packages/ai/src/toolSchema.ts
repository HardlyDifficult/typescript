/**
 * Extract tool schemas (descriptions + parameter descriptions) from a ToolMap.
 * Useful for serializing tool metadata for display, editing, or replay.
 */

import { z } from "zod";

import type { ToolMap } from "./types.js";

/** Serialized representation of a tool's schema. */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    name: string;
    description: string;
  }[];
}

/**
 * Extract parameter names and descriptions from a Zod schema.
 * Handles ZodObject shapes — each top-level key is a parameter.
 */
function extractParameters(
  schema: z.ZodType
): { name: string; description: string }[] {
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape as Record<string, z.ZodType>;
    return Object.entries(shape).map(([name, value]) => ({
      name,
      description: value.description ?? "",
    }));
  }
  return [];
}

/**
 * Extract tool schemas from a ToolMap for serialization.
 */
export function extractToolSchemas(tools: ToolMap): ToolSchema[] {
  return Object.entries(tools).map(([name, tool]) => ({
    name,
    description: tool.description,
    parameters: extractParameters(tool.inputSchema as z.ZodType),
  }));
}
