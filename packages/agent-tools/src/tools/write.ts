/**
 * Write tools for code modification.
 *
 * Supports three surgical edit operations (insert, delete, replace) applied
 * bottom-up to preserve line numbers across multiple edits to the same file.
 */

import type { ToolMap } from "@hardlydifficult/ai";
import { z } from "zod";

import { MAX_CONTEXT_LINES } from "../config.js";
import { toArray } from "../utils.js";

import type { FileSystem } from "./types.js";

/**
 * Check whether two line ranges overlap (both 1-indexed, inclusive).
 */
function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Format a few lines of context around an edited region,
 * using the same header+line-number format as read_file.
 */
function formatEditContext(
  lines: string[],
  newStart: number,
  newEnd: number,
  totalLines: number,
  filePath: string
): string {
  const ctxStart = Math.max(1, newStart - MAX_CONTEXT_LINES);
  const ctxEnd = Math.min(totalLines, newEnd + MAX_CONTEXT_LINES);
  const width = String(ctxEnd).length;

  const body = lines
    .slice(ctxStart - 1, ctxEnd)
    .map((line, i) => `${String(ctxStart + i).padStart(width)}: ${line}`)
    .join("\n");

  return `[${filePath}: lines ${String(ctxStart)}-${String(ctxEnd)} of ${String(totalLines)}]\n${body}`;
}

/** Insert content after a specific line number. */
const insertOpSchema = z.object({
  insertAfter: z
    .number()
    .int()
    .min(0)
    .describe(
      "Insert content after this line number (1-indexed). Use 0 to prepend before the first line. No existing lines are removed."
    ),
  content: z.string().describe("Lines to insert."),
});

/** Delete a range of lines. */
const deleteOpSchema = z.object({
  deleteFrom: z
    .number()
    .int()
    .min(1)
    .describe("First line to delete (1-indexed, inclusive)."),
  deleteTo: z
    .number()
    .int()
    .min(1)
    .describe("Last line to delete (1-indexed, inclusive)."),
});

/** Replace a range of lines with new content. */
const replaceOpSchema = z.object({
  replaceFrom: z
    .number()
    .int()
    .min(1)
    .describe("First line to replace (1-indexed, inclusive)."),
  replaceTo: z
    .number()
    .int()
    .min(1)
    .describe("Last line to replace (1-indexed, inclusive)."),
  content: z.string().describe("Replacement lines."),
});

const editOpSchema = z.union([insertOpSchema, deleteOpSchema, replaceOpSchema]);
type EditOp = z.infer<typeof editOpSchema>;

/** The anchor line used for bottom-up ordering. */
function opAnchor(op: EditOp): number {
  if ("insertAfter" in op) {
    return op.insertAfter;
  }
  if ("deleteFrom" in op) {
    return op.deleteFrom;
  }
  return op.replaceFrom;
}

/** The line range affected by a range-based op (delete or replace). */
function opRange(op: EditOp): { from: number; to: number } | null {
  if ("deleteFrom" in op) {
    return { from: op.deleteFrom, to: op.deleteTo };
  }
  if ("replaceFrom" in op) {
    return { from: op.replaceFrom, to: op.replaceTo };
  }
  return null;
}

/**
 * Apply multiple surgical ops to a single file, bottom-up.
 * Returns the result description including post-edit context.
 */
async function applyOps(
  fs: FileSystem,
  filePath: string,
  ops: EditOp[]
): Promise<string> {
  // Validate: no overlapping ranges among delete/replace ops
  const rangeOps = ops
    .map((op) => opRange(op))
    .filter((r): r is { from: number; to: number } => r !== null);
  for (let i = 0; i < rangeOps.length; i++) {
    for (let j = i + 1; j < rangeOps.length; j++) {
      const a = rangeOps[i];
      const b = rangeOps[j];
      if (rangesOverlap(a.from, a.to, b.from, b.to)) {
        return `Error: ${filePath} — operations overlap at lines ${String(a.from)}-${String(a.to)} and ${String(b.from)}-${String(b.to)}`;
      }
    }
  }

  // Sort by anchor descending (bottom-up) so earlier ops don't shift later line numbers
  const sorted = [...ops].sort((a, b) => opAnchor(b) - opAnchor(a));

  // Read current file
  const existing = await fs.readFile(filePath);
  let lines = existing.split("\n");

  // Track original positions for reporting (ascending order for display)
  const opInfo: {
    label: string;
    origStart: number;
    origEnd: number;
    origSpan: number;
    newSpan: number;
  }[] = [];

  // Apply each op bottom-up
  for (const op of sorted) {
    if ("insertAfter" in op) {
      const after = Math.min(op.insertAfter, lines.length);
      const newLines = op.content.split("\n");
      opInfo.unshift({
        label: "insert",
        origStart: after,
        origEnd: after,
        origSpan: 0,
        newSpan: newLines.length,
      });
      lines = [...lines.slice(0, after), ...newLines, ...lines.slice(after)];
    } else if ("deleteFrom" in op) {
      const from = Math.max(1, op.deleteFrom);
      const to = Math.min(lines.length, op.deleteTo);
      if (from > to) {
        return `Error: ${filePath} — deleteFrom (${String(op.deleteFrom)}) > deleteTo (${String(op.deleteTo)})`;
      }
      opInfo.unshift({
        label: "delete",
        origStart: from,
        origEnd: to,
        origSpan: to - from + 1,
        newSpan: 0,
      });
      lines = [...lines.slice(0, from - 1), ...lines.slice(to)];
    } else {
      const from = Math.max(1, op.replaceFrom);
      const to = Math.min(lines.length, op.replaceTo);
      if (from > to) {
        return `Error: ${filePath} — replaceFrom (${String(op.replaceFrom)}) > replaceTo (${String(op.replaceTo)})`;
      }
      const newLines = op.content.split("\n");
      opInfo.unshift({
        label: "replace",
        origStart: from,
        origEnd: to,
        origSpan: to - from + 1,
        newSpan: newLines.length,
      });
      lines = [...lines.slice(0, from - 1), ...newLines, ...lines.slice(to)];
    }
  }

  // Write the result
  const newContent = lines.join("\n");
  await fs.writeFile(filePath, newContent);

  const totalLines = lines.length;

  // Build post-edit context for each op (with adjusted line numbers)
  const summaries: string[] = [];
  let cumulativeOffset = 0;

  for (const info of opInfo) {
    const adjustedStart = info.origStart + cumulativeOffset;

    if (info.label === "delete") {
      summaries.push(
        `  deleted L${String(info.origStart)}-L${String(info.origEnd)} (${String(info.origSpan)} lines removed)`
      );
    } else {
      const adjustedEnd = Math.max(
        adjustedStart,
        adjustedStart + info.newSpan - 1
      );
      const context = formatEditContext(
        lines,
        adjustedStart,
        adjustedEnd,
        totalLines,
        filePath
      );
      summaries.push(
        `  ${info.label} at L${String(adjustedStart)}-L${String(adjustedEnd)} (was L${String(info.origStart)}-L${String(info.origEnd)}):\n${context}`
      );
    }

    cumulativeOffset += info.newSpan - info.origSpan;
  }

  const opCount = ops.length;
  return `Updated ${filePath} (${String(opCount)} op${opCount > 1 ? "s" : ""}, now ${String(totalLines)} lines):\n${summaries.join("\n\n")}`;
}

/**
 * Create write tools for repository modification.
 */
export function createWriteTools(
  fs: FileSystem,
  readFiles?: Set<string>
): ToolMap {
  return {
    write_file: {
      description:
        "Edit a file using surgical ops: " +
        "insertAfter (insert after line N, nothing removed — use 0 to create a new file), " +
        "deleteFrom+deleteTo (remove lines), " +
        "replaceFrom+replaceTo+content (replace a range). " +
        "Read the file first to get accurate line numbers. Multiple ops applied bottom-up automatically.",
      inputSchema: z.object({
        path: z.string().describe("File path, e.g. 'src/index.ts'."),
        edits: z
          .union([editOpSchema, z.array(editOpSchema)])
          .describe(
            "Operation or array of ops. Applied bottom-up automatically."
          ),
      }),
      execute: async ({
        path,
        edits,
      }: {
        path: string;
        edits: EditOp | EditOp[];
      }) => {
        const opList = toArray(edits);
        if (opList.length === 0) {
          return `Error: ${path} — no edits provided`;
        }

        // Warn if editing a file that hasn't been read
        const unread = readFiles !== undefined && !readFiles.has(path);

        try {
          let result = await applyOps(fs, path, opList);
          if (unread) {
            result = `Note: '${path}' was not read in this session. Line numbers may be inaccurate — consider using read_file first.\n${result}`;
          }
          return result;
        } catch (error) {
          return `Error editing ${path}: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    },
  };
}
