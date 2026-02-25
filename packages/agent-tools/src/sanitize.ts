/**
 * Sanitize tool inputs to prevent logging sensitive data or excessively large content.
 * Applies tool-specific rules to keep relevant information while truncating content.
 *
 * @param toolName - Name of the tool being invoked
 * @param input - Tool input parameters
 * @returns Sanitized input safe for logging
 */
export function sanitizeToolInput(
  toolName: string,
  input: Record<string, unknown>
): Record<string, unknown> {
  const sanitized = { ...input };

  // Read/explore tools - keep file path only, no content preview
  if (
    toolName === "Read" ||
    toolName === "read_source_file" ||
    toolName === "read_file" ||
    toolName === "explore" ||
    toolName === "list_directory" ||
    toolName === "Glob" ||
    toolName === "Grep"
  ) {
    // Only keep path-related fields, remove content
    const pathFields = ["file_path", "filePath", "path", "pattern"];
    const result: Record<string, unknown> = {};
    for (const field of pathFields) {
      if (field in sanitized) {
        result[field] = sanitized[field];
      }
    }
    // Include other non-content fields
    for (const [key, value] of Object.entries(sanitized)) {
      if (!pathFields.includes(key) && typeof value !== "string") {
        result[key] = value;
      } else if (
        !pathFields.includes(key) &&
        typeof value === "string" &&
        value.length < 200
      ) {
        result[key] = value;
      }
    }
    return result;
  }

  // Write/Edit tools - keep file path, truncate content
  if (
    toolName === "Write" ||
    toolName === "write_file" ||
    toolName === "Edit" ||
    toolName === "edit_file"
  ) {
    if ("content" in sanitized && typeof sanitized.content === "string") {
      sanitized.content = truncateString(sanitized.content, 500);
    }
    if ("newText" in sanitized && typeof sanitized.newText === "string") {
      sanitized.newText = truncateString(sanitized.newText, 500);
    }
    if ("oldText" in sanitized && typeof sanitized.oldText === "string") {
      sanitized.oldText = truncateString(sanitized.oldText, 500);
    }
    // Batched edits: truncate content within each edit object
    if ("edits" in sanitized) {
      const { edits } = sanitized;
      if (Array.isArray(edits)) {
        sanitized.edits = edits.map((e: Record<string, unknown>) => ({
          ...e,
          content:
            typeof e.content === "string"
              ? truncateString(e.content, 500)
              : e.content,
        }));
      } else if (typeof edits === "object" && edits !== null) {
        const edit = edits as Record<string, unknown>;
        sanitized.edits = {
          ...edit,
          content:
            typeof edit.content === "string"
              ? truncateString(edit.content, 500)
              : edit.content,
        };
      }
    }
  }

  return sanitized;
}

/**
 * Truncate a string to a maximum length, adding ellipsis indicator.
 *
 * @param str - String to truncate
 * @param maxLen - Maximum length before truncation
 * @returns Truncated string with indicator if shortened
 */
export function truncateString(str: string, maxLen: number): string {
  if (str.length <= maxLen) {
    return str;
  }
  return `${str.slice(0, maxLen)}... (truncated)`;
}
