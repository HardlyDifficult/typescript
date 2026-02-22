#!/usr/bin/env node

/**
 * Captures a screenshot of each Storybook story using agent-browser.
 *
 * Prerequisites:
 *   - `storybook-static/` must exist (run `npm run build:storybook` first)
 *   - `agent-browser` must be installed (`npx agent-browser install`)
 *
 * Output:
 *   - PNG screenshots in `screenshots/<story-id>.png`
 */

import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const STORYBOOK_DIR = new URL("../storybook-static", import.meta.url).pathname;
const SCREENSHOTS_DIR = new URL("../screenshots", import.meta.url).pathname;
const SESSION = "storybook-screenshots";

// Resolve the agent-browser binary once to avoid npx overhead per call
const require = createRequire(import.meta.url);
const agentBrowserPkg = require.resolve("agent-browser/package.json");
const BIN = join(agentBrowserPkg, "..", "bin", "agent-browser.js");

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function ab(args) {
  return execFileSync("node", [BIN, "--session", SESSION, ...args], {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf-8",
    timeout: 30_000,
  });
}

/** Minimal static file server for storybook-static. */
function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, "http://localhost");
      let filePath = join(STORYBOOK_DIR, url.pathname);
      if (url.pathname === "/") filePath = join(STORYBOOK_DIR, "index.html");

      try {
        const content = await readFile(filePath);
        const ext = extname(filePath);
        res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

async function main() {
  console.log("Starting static server...");
  const { server, port } = await startServer();
  console.log(`Serving storybook-static on port ${port}`);

  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  // Read story index directly from the built files
  const indexData = JSON.parse(await readFile(join(STORYBOOK_DIR, "index.json"), "utf-8"));
  const entries = indexData.entries || indexData.stories || {};
  const stories = Object.values(entries).filter((entry) => entry.type === "story");
  console.log(`Found ${stories.length} stories`);

  try {
    for (const story of stories) {
      const url = `http://127.0.0.1:${port}/iframe.html?id=${story.id}&viewMode=story`;
      const screenshotPath = join(SCREENSHOTS_DIR, `${story.id}.png`);

      try {
        ab(["open", url]);
        ab(["wait", "1000"]);
        ab(["screenshot", screenshotPath]);
        console.log(`  captured: ${story.id}.png`);
      } catch (err) {
        console.error(`  FAILED: ${story.id} — ${err.message}`);
      }
    }
  } finally {
    try {
      ab(["close"]);
    } catch {
      // browser may already be closed
    }
    server.close();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
