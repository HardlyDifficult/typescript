/**
 * General-purpose tools that work outside the repository context.
 */

import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import type { ToolMap } from "@hardlydifficult/ai";
import { z } from "zod";

const execFileAsync = promisify(execFile);

const AGENT_BROWSER_TIMEOUT = 30_000;

/**
 * Resolve the agent-browser binary from node_modules.
 *
 * Walks up from the current working directory to find node_modules/.bin.
 * This avoids using import.meta.url which requires ESM module mode.
 */
function resolveAgentBrowser(): string {
  // Use require.resolve to find the package, falling back to a cwd-based path
  try {
    return require.resolve("agent-browser/cli");
  } catch {
    return resolve(process.cwd(), "node_modules", ".bin", "agent-browser");
  }
}

/**
 * Create general-purpose tools.
 */
export function createGeneralTools(): ToolMap {
  return {
    "agent-browser": {
      description:
        "Run an agent-browser command for web browsing. Commands: open <url>, snapshot, snapshot -i, click <ref>, fill <ref> <text>, get text <selector>, eval <js>, screenshot <path>, wait --load networkidle, close. Always close the browser when done.",
      inputSchema: z.object({
        command: z
          .string()
          .describe("Command and arguments, e.g. 'open https://example.com'."),
      }),
      execute: async ({ command }: { command: string }) => {
        const args = command.match(/(?:[^\s"]+|"[^"]*")/g) ?? [];
        const cleanArgs = args.map((a) => a.replace(/^"|"$/g, ""));

        try {
          const bin = resolveAgentBrowser();
          const { stdout, stderr } = await execFileAsync(bin, cleanArgs, {
            timeout: AGENT_BROWSER_TIMEOUT,
          });
          return stdout || stderr || "(no output)";
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes("ENOENT")) {
            return "Error: agent-browser not found. Install it with: npm install agent-browser && npx agent-browser install --with-deps";
          }
          return `Error: ${msg}`;
        }
      },
    },
  };
}
