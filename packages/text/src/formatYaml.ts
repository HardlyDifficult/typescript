import { Document, Scalar, visit } from "yaml";

/**
 * Serialize data to clean YAML with minimal quoting.
 *
 * Long strings containing `: ` are rendered as block-literal (`|`) scalars
 * instead of double-quoted strings, improving readability for descriptive text.
 * Short strings, numbers, booleans, and other values use default styling.
 */
export function formatYaml(data: unknown): string {
  const doc = new Document(data);

  visit(doc, {
    Scalar(_key, node) {
      if (
        typeof node.value === "string" &&
        node.value.includes(": ") &&
        node.value.length > 60
      ) {
        node.type = Scalar.BLOCK_LITERAL;
      }
    },
  });

  return doc.toString({ lineWidth: 0 });
}
