/**
 * Read-only tools for code analysis and exploration.
 */

import type { ToolMap } from "@hardlydifficult/ai";
import { buildFileTree, FILE_TREE_DEFAULTS } from "@hardlydifficult/text";
import { z } from "zod";

import { MAX_READ_BYTES } from "../config.js";
import { parsePath } from "../parsePath.js";
import { executeWithErrorHandling, toArray } from "../utils.js";

import type { AnnotationProvider, FileSystem } from "./types.js";

/**
 * Format lines with line numbers.
 */
function formatLines(lines: string[], startOffset: number): string {
  const maxNum = startOffset + lines.length;
  const width = String(maxNum).length;
  return lines
    .map((line, i) => `${String(startOffset + i + 1).padStart(width)}: ${line}`)
    .join("\n");
}

/**
 * Read a single file and return its formatted content.
 */
async function readSingleFile(
  fs: FileSystem,
  pathSpec: string
): Promise<{ content: string; error?: string }> {
  try {
    const { filePath, startLine, endLine } = parsePath(pathSpec);
    const raw = await fs.readFile(filePath);
    const allLines = raw.split("\n");
    const totalLines = allLines.length;

    let selectedLines: string[];
    let header: string;

    if (startLine !== undefined && endLine !== undefined) {
      const start = Math.max(1, startLine);
      const end = Math.min(totalLines, endLine);
      selectedLines = allLines.slice(start - 1, end);
      header = `[${filePath}: lines ${String(start)}-${String(end)} of ${String(totalLines)}]`;
    } else {
      selectedLines = allLines;
      header = `[${filePath}: ${String(totalLines)} lines]`;
    }

    const body = formatLines(selectedLines, (startLine ?? 1) - 1);
    return { content: `${header}\n${body}` };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { content: "", error: `Error reading ${pathSpec}: ${msg}` };
  }
}

/**
 * Create read-only tools for repository exploration.
 */
export function createReadTools(
  fs: FileSystem,
  annotations?: AnnotationProvider,
  readFiles?: Set<string>
): ToolMap {
  return {
    read_file: {
      description:
        "Read file contents. Supports line ranges via path#L{start}-L{end}. Pass an array to read multiple files in one call.",
      inputSchema: z.object({
        path: z
          .union([z.string(), z.array(z.string())])
          .describe(
            "File path(s), e.g. 'src/index.ts' or ['src/index.ts', 'src/utils.ts#L5-L20']."
          ),
      }),
      execute: async ({ path }: { path: string | string[] }) => {
        const paths = toArray(path);

        // Check which files were already read before updating the set
        const reReadPaths = new Set<string>();
        if (readFiles) {
          for (const p of paths) {
            const resolved = parsePath(p).filePath;
            if (readFiles.has(resolved)) {
              reReadPaths.add(resolved);
            }
            readFiles.add(resolved);
          }
        }

        if (paths.length === 1) {
          return executeWithErrorHandling(async () => {
            const result = await readSingleFile(fs, paths[0]);
            if (result.error !== undefined && result.error !== "") {
              return result.error;
            }

            let output = result.content;
            if (output.length > MAX_READ_BYTES) {
              output = `${output.slice(0, MAX_READ_BYTES)}\n[output truncated — use line ranges to read specific sections]`;
              console.error(
                `[tools] read_file: output truncated (exceeded ${String(MAX_READ_BYTES)} bytes)`
              );
            }

            // Warn on re-reads to discourage redundant exploration
            if (reReadPaths.size > 0) {
              output = `[Warning: You already read this file. Do not re-read files — use your earlier context instead.]\n\n${output}`;
            }

            return output;
          }, "Error reading file");
        }

        // Batched read
        const results: string[] = [];
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < paths.length; i++) {
          const resolved = parsePath(paths[i]).filePath;
          const isReRead = reReadPaths.has(resolved);

          const result = await readSingleFile(fs, paths[i]);
          if (result.error !== undefined && result.error !== "") {
            results.push(
              `--- [${String(i + 1)}/${String(paths.length)}] ${result.error} ---`
            );
            errorCount++;
          } else {
            const firstLine = result.content.split("\n")[0] ?? "";
            const reReadWarning = isReRead
              ? " [RE-READ — use earlier context instead]"
              : "";
            results.push(
              `--- [${String(i + 1)}/${String(paths.length)}] ${firstLine.replace(/^\[/, "").replace(/\]$/, "")}${reReadWarning} ---`
            );
            const bodyLines = result.content.split("\n").slice(1);
            results.push(bodyLines.join("\n"));
            successCount++;
          }
        }

        let output = results.join("\n");

        if (reReadPaths.size > 0) {
          output = `[Warning: ${String(reReadPaths.size)} file(s) were already read. Do not re-read files — use your earlier context.]\n\n${output}`;
        }

        if (errorCount > 0) {
          output += `\n\n[${String(successCount)} of ${String(paths.length)} files read, ${String(errorCount)} failed]`;
        } else {
          output += `\n\n[${String(successCount)} files read]`;
        }

        if (output.length > MAX_READ_BYTES) {
          output = `${output.slice(0, MAX_READ_BYTES)}\n[output truncated — read fewer files or use line ranges]`;
          console.error(
            `[tools] read_file: batched output truncated (exceeded ${String(MAX_READ_BYTES)} bytes)`
          );
        }

        return output;
      },
    },

    explore: {
      description:
        "Explore directory contents as an annotated file tree. When summaries are available, entries include short descriptions of their purpose.",
      inputSchema: z.object({
        path: z
          .union([z.string(), z.array(z.string())])
          .describe(
            "Directory path(s) relative to repo root, e.g. 'src/components'. Array to explore multiple."
          ),
      }),
      execute: async ({ path }: { path: string | string[] }) => {
        const paths = toArray(path);
        const sections: string[] = [];

        for (const dirPath of paths) {
          const result = await executeWithErrorHandling(async () => {
            const pattern =
              dirPath === "" || dirPath === "." ? "**/*" : `${dirPath}/**/*`;
            const files = await fs.searchFiles(pattern);

            if (files.length === 0) {
              return `[${dirPath || "."}] Directory is empty or does not exist.`;
            }

            const prefix =
              dirPath === "" || dirPath === "." ? "" : `${dirPath}/`;
            const relative = prefix
              ? files.map((f) =>
                  f.startsWith(prefix) ? f.slice(prefix.length) : f
                )
              : files;

            let childAnnotations: ReadonlyMap<string, string> | undefined;
            let childDetails:
              | ReadonlyMap<string, readonly string[]>
              | undefined;
            let dirPurpose: string | null = null;

            if (annotations) {
              try {
                childAnnotations =
                  await annotations.getChildAnnotations(dirPath);
                childDetails = await annotations.getChildDetails(dirPath);
                dirPurpose = await annotations.getDirPurpose(dirPath);
              } catch {
                // Annotations unavailable — fall back to plain tree
              }
            }

            const tree = buildFileTree(relative, {
              ...FILE_TREE_DEFAULTS,
              annotations:
                childAnnotations?.size !== undefined &&
                childAnnotations.size !== 0
                  ? childAnnotations
                  : undefined,
              details:
                childDetails?.size !== undefined && childDetails.size !== 0
                  ? childDetails
                  : undefined,
              format: "plain",
            });

            let output = "";
            if (dirPurpose !== null && dirPurpose !== "") {
              output += `[${dirPath || "."}] ${dirPurpose}\n\n`;
            } else {
              output += `[${dirPath || "."}]\n`;
            }
            output += tree;
            output += `\n\n[${String(files.length)} files]`;

            return output;
          }, "Error exploring directory");
          sections.push(typeof result === "string" ? result : String(result));
        }

        return sections.join("\n\n---\n\n");
      },
    },
  };
}
