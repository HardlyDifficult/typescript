/**
 * Structural type for messages that may contain multimodal content.
 * Compatible with AI SDK message formats and ChatMessage from @ai/shared.
 */
export interface MultimodalMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string }>;
}

/**
 * Extract text content from a message content field.
 * Handles both plain string and multimodal content arrays.
 */
export function extractTextContent(
  content: MultimodalMessage["content"],
): string {
  if (typeof content === "string") {
    return content;
  }
  return content
    .filter(
      (c): c is { type: "text"; text: string } =>
        c.type === "text" && typeof c.text === "string",
    )
    .map((c) => c.text)
    .join("\n");
}

/**
 * Convert multimodal messages to plain text messages.
 * Flattens any multimodal content arrays to plain text strings.
 */
export function toPlainTextMessages(
  messages: MultimodalMessage[],
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  return messages.map((m) => ({
    role: m.role,
    content: extractTextContent(m.content),
  }));
}
