/**
 * Search tools for finding files by pattern, content, or name.
 */

import type { ToolMap } from "@hardlydifficult/ai";
import { z } from "zod";

import { MAX_GREP_FILE_SIZE, MAX_SEARCH_RESULTS } from "../config.js";
import { executeWithErrorHandling } from "../utils.js";

import type { FileSystem } from "./types.js";

/**
 * Create search tools for file discovery and content search.
 */
export function createSearchTools(fs: FileSystem): ToolMap {
  return {
    search_files: {
      description:
        "Search by filename pattern, file contents, or both.\n\n" +
        "  glob — filter files by path pattern (e.g. '**/*.ts'). Returns matching paths,\n" +
        "         or file:line matches when combined with regex.\n" +
        "  regex — search file contents. Returns file:line matches. Searches files matched\n" +
        "          by glob or name, or all files if neither is set.\n" +
        "  name — smart scope by concept name or path segment (e.g. 'UserCard',\n" +
        "         '/api/test-worker'). Finds files/dirs whose path contains the name.\n" +
        "         When used alone also shows string literal references. Cannot be combined with glob.",
      inputSchema: z.object({
        glob: z
          .string()
          .optional()
          .describe(
            "Filename pattern to filter files, e.g. '**/*.ts'. Cannot be combined with name."
          ),
        regex: z
          .string()
          .optional()
          .describe(
            "Regex to search file contents. Applied to files matched by glob or name, or all files if neither is set."
          ),
        name: z
          .string()
          .optional()
          .describe(
            "Smart path scope: finds files/dirs whose path contains this name or path segment. " +
              "When used alone, also returns string literal references across all files. " +
              "Cannot be combined with glob. Examples: 'UserCard', '/api/test-worker', 'auth'."
          ),
      }),
      execute: async ({
        glob,
        regex,
        name,
      }: {
        glob?: string;
        regex?: string;
        name?: string;
      }) => {
        if (
          (glob === undefined || glob === "") &&
          (regex === undefined || regex === "") &&
          (name === undefined || name === "")
        ) {
          return "Error: provide at least one of glob, regex, or name.";
        }
        if (
          name !== undefined &&
          name !== "" &&
          glob !== undefined &&
          glob !== ""
        ) {
          return "Error: name and glob cannot be combined — use one as the path filter.";
        }

        if (name !== undefined && name !== "") {
          return executeWithErrorHandling(async () => {
            const segment = name.startsWith("/") ? name.slice(1) : name;
            const lastSegment = segment.split("/").at(-1) ?? segment;

            // Path-based scope: files/dirs whose path contains the name
            const [dirFiles, namedFiles] = await Promise.all([
              fs.searchFiles(`**/${segment}/**`),
              fs.searchFiles(`**/${lastSegment}.*`),
            ]);
            const scopedFiles = [...new Set([...dirFiles, ...namedFiles])];

            if (regex !== undefined && regex !== "") {
              // name + regex: run regex content search scoped to name-matched files
              const re = new RegExp(regex);
              const matches: string[] = [];
              let filesWithMatches = 0;

              for (const file of scopedFiles) {
                if (matches.length >= MAX_SEARCH_RESULTS) {
                  break;
                }
                try {
                  const content = await fs.readFile(file);
                  if (content.length > MAX_GREP_FILE_SIZE) {
                    continue;
                  }
                  const lines = content.split("\n");
                  let fileHasMatch = false;
                  for (let i = 0; i < lines.length; i++) {
                    if (matches.length >= MAX_SEARCH_RESULTS) {
                      break;
                    }
                    if (re.test(lines[i])) {
                      if (!fileHasMatch) {
                        fileHasMatch = true;
                        filesWithMatches++;
                      }
                      matches.push(`${file}#L${String(i + 1)}: ${lines[i]}`);
                    }
                  }
                } catch {
                  // Skip unreadable files
                }
              }

              if (matches.length === 0) {
                return "No matches found.";
              }
              if (matches.length >= MAX_SEARCH_RESULTS) {
                return `Found ${String(matches.length)} matches in ${String(filesWithMatches)} files:\n${matches.join("\n")}\n\n[Showing first ${String(MAX_SEARCH_RESULTS)} matches — narrow with a more specific regex or name]`;
              }
              return `Found ${String(matches.length)} matches in ${String(filesWithMatches)} files:\n${matches.join("\n")}`;
            }

            // name alone: path matches + string literal references across all files
            const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const re = new RegExp(`['"\`]${escapedName}['"\`]`);
            const allFiles = await fs.searchFiles("**/*");
            const literalMatches: string[] = [];

            for (const file of allFiles) {
              if (literalMatches.length >= MAX_SEARCH_RESULTS) {
                break;
              }
              try {
                const content = await fs.readFile(file);
                if (content.length > MAX_GREP_FILE_SIZE) {
                  continue;
                }
                const lines = content.split("\n");
                for (let i = 0; i < lines.length; i++) {
                  if (literalMatches.length >= MAX_SEARCH_RESULTS) {
                    break;
                  }
                  if (re.test(lines[i])) {
                    literalMatches.push(
                      `${file}#L${String(i + 1)}: ${lines[i]}`
                    );
                  }
                }
              } catch {
                // Skip unreadable files
              }
            }

            const sections: string[] = [];
            if (scopedFiles.length > 0) {
              sections.push(
                `[Files/directories matching '${name}']\n${scopedFiles.join("\n")}`
              );
            }
            if (literalMatches.length > 0) {
              sections.push(
                `[String literal references to '${name}']\n${literalMatches.join("\n")}`
              );
            }
            return sections.length > 0
              ? sections.join("\n\n")
              : `No matches found for '${name}'.`;
          }, "Error in name search");
        }

        return executeWithErrorHandling(async () => {
          const files = await fs.searchFiles(glob ?? "**/*");

          if (regex === undefined || regex === "") {
            if (files.length === 0) {
              return "No files found matching the pattern.";
            }
            if (files.length <= MAX_SEARCH_RESULTS) {
              return `Found ${String(files.length)} files:\n${files.join("\n")}`;
            }
            const shown = files.slice(0, MAX_SEARCH_RESULTS);
            return `Found ${String(files.length)} files:\n${shown.join("\n")}\n\n[Showing first ${String(MAX_SEARCH_RESULTS)} of ${String(files.length)} files — use a narrower glob]`;
          }

          const re = new RegExp(regex);
          const matches: string[] = [];
          let filesWithMatches = 0;

          for (const file of files) {
            if (matches.length >= MAX_SEARCH_RESULTS) {
              break;
            }

            try {
              const content = await fs.readFile(file);
              if (content.length > MAX_GREP_FILE_SIZE) {
                continue;
              }

              const lines = content.split("\n");
              let fileHasMatch = false;

              for (let i = 0; i < lines.length; i++) {
                if (matches.length >= MAX_SEARCH_RESULTS) {
                  break;
                }
                if (re.test(lines[i])) {
                  if (!fileHasMatch) {
                    fileHasMatch = true;
                    filesWithMatches++;
                  }
                  matches.push(`${file}#L${String(i + 1)}: ${lines[i]}`);
                }
              }
            } catch {
              // Skip unreadable files
            }
          }

          if (matches.length === 0) {
            return "No matches found.";
          }

          if (matches.length >= MAX_SEARCH_RESULTS) {
            return `Found ${String(matches.length)} matches in ${String(filesWithMatches)} files:\n${matches.join("\n")}\n\n[Showing first ${String(MAX_SEARCH_RESULTS)} matches — narrow with a more specific regex or glob]`;
          }
          return `Found ${String(matches.length)} matches in ${String(filesWithMatches)} files:\n${matches.join("\n")}`;
        }, "Error searching files");
      },
    },
  };
}
