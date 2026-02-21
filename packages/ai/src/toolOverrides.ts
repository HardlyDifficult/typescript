/**
 * Apply tool description overrides to a ToolMap.
 * Useful for testing modified tool descriptions without code changes.
 */

import { z } from "zod";

import type { ToolMap } from "./types.js";

/**
 * Tool description overrides. Keys are tool names; values override
 * the tool description and/or individual parameter descriptions.
 */
export type ToolDescriptionOverrides = Record<
  string,
  {
    description?: string;
    parameters?: Record<string, string>;
  }
>;

/**
 * Rebuild a ZodObject with overridden parameter descriptions.
 */
function overrideParameterDescriptions(
  schema: z.ZodType,
  paramOverrides: Record<string, string>
): z.ZodType {
  if (!(schema instanceof z.ZodObject)) {
    return schema;
  }

  const shape = schema.shape as Record<string, z.ZodType>;
  const newShape: Record<string, z.ZodType> = {};

  for (const [key, value] of Object.entries(shape)) {
    newShape[key] =
      key in paramOverrides ? value.describe(paramOverrides[key]) : value;
  }

  return z.object(newShape);
}

/**
 * Apply description overrides to a ToolMap, returning a new ToolMap
 * with modified descriptions. Tools/parameters not in overrides are unchanged.
 */
export function applyToolDescriptionOverrides(
  tools: ToolMap,
  overrides: ToolDescriptionOverrides
): ToolMap {
  const result: ToolMap = {};

  for (const [name, tool] of Object.entries(tools)) {
    if (!(name in overrides)) {
      result[name] = tool;
      continue;
    }

    const override = overrides[name];
    const inputSchema = (
      override.parameters
        ? overrideParameterDescriptions(
            tool.inputSchema as z.ZodType,
            override.parameters
          )
        : tool.inputSchema
    ) as z.ZodType;

    result[name] = {
      ...tool,
      description: override.description ?? tool.description,
      inputSchema,
    };
  }

  return result;
}
