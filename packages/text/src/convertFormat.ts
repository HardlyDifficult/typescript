import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

export type TextFormat = "json" | "yaml";

/**
 * Parse content as JSON or YAML, throwing a descriptive error if both fail.
 */
function parseContent(content: string): unknown {
  // Try JSON first
  try {
    return JSON.parse(content);
  } catch (jsonError) {
    // Fall back to YAML
    try {
      return parseYaml(content);
    } catch (yamlError) {
      throw new Error(
        `Input is neither valid JSON nor YAML.\nJSON error: ${jsonError instanceof Error ? jsonError.message : String(jsonError)}\nYAML error: ${yamlError instanceof Error ? yamlError.message : String(yamlError)}`,
        { cause: yamlError }
      );
    }
  }
}

/**
 * Convert between JSON and YAML string formats.
 *
 * Auto-detects the input format by trying JSON.parse first, then
 * falling back to YAML parsing. Returns pretty-printed JSON (2-space indent)
 * or clean YAML based on the `to` parameter.
 *
 * @example
 * ```typescript
 * // JSON to YAML
 * convertFormat('{"name": "Alice", "age": 30}', "yaml")
 * // name: Alice
 * // age: 30
 *
 * // YAML to JSON
 * convertFormat("name: Alice\nage: 30", "json")
 * // {
 * //   "name": "Alice",
 * //   "age": 30
 * // }
 * ```
 */
export function convertFormat(content: string, to: TextFormat): string {
  const data = parseContent(content);

  if (to === "json") {
    return JSON.stringify(data, null, 2);
  } else {
    return stringifyYaml(data);
  }
}
