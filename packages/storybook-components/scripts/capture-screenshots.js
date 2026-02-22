#!/usr/bin/env node

/**
 * Captures a screenshot of each Storybook story using agent-browser.
 *
 * Prerequisites:
 *   - `storybook-static/` must exist (run `npm run build:storybook` first)
 *   - agent-browser's browser must be installed (`npx agent-browser install`)
 *
 * Output:
 *   - PNG screenshots in `screenshots/<story-id>.png`
 */

import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { BrowserManager } from "agent-browser/dist/browser.js";
import { executeCommand } from "agent-browser/dist/actions.js";

const STORYBOOK_DIR = new URL("../storybook-static", import.meta.url).pathname;
const SCREENSHOTS_DIR = new URL("../screenshots", import.meta.url).pathname;

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

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

  const browser = new BrowserManager();
  await browser.launch({ id: "launch", action: "launch", headless: true });

  try {
    for (const story of stories) {
      const url = `http://127.0.0.1:${port}/iframe.html?id=${story.id}&viewMode=story`;
      const screenshotPath = join(SCREENSHOTS_DIR, `${story.id}.png`);

      try {
        await executeCommand({ id: "nav", action: "navigate", url, waitUntil: "networkidle" }, browser);
        await executeCommand({ id: "wait", action: "wait", timeout: 500 }, browser);
        await executeCommand({ id: "ss", action: "screenshot", path: screenshotPath }, browser);
        console.log(`  captured: ${story.id}.png`);
      } catch (err) {
        console.error(`  FAILED: ${story.id} — ${err.message}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error("Screenshot capture failed:", err);
  process.exit(1);
});
