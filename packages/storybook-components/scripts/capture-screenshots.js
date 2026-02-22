#!/usr/bin/env node

/**
 * Captures a screenshot of each Storybook story's default view.
 *
 * Prerequisites:
 *   - `storybook-static/` must exist (run `npm run build:storybook` first)
 *   - Playwright chromium browser must be installed (`npx playwright install chromium`)
 *
 * Output:
 *   - PNG screenshots in `screenshots/<story-id>.png`
 */

import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { join, extname } from "node:path";
import { chromium } from "playwright";

const STORYBOOK_DIR = new URL("../storybook-static", import.meta.url).pathname;
const SCREENSHOTS_DIR = new URL("../screenshots", import.meta.url).pathname;
const VIEWPORT = { width: 800, height: 600 };

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

/** Fetch the Storybook index and return story entries. */
async function getStories(port) {
  const res = await fetch(`http://127.0.0.1:${port}/index.json`);
  if (!res.ok) throw new Error(`Failed to fetch index.json: ${res.status}`);
  const data = await res.json();
  // Storybook index.json has { v, entries } where entries is an object keyed by story id
  const entries = data.entries || data.stories || {};
  return Object.values(entries).filter((entry) => entry.type === "story");
}

async function main() {
  console.log("Starting static server...");
  const { server, port } = await startServer();
  console.log(`Serving storybook-static on port ${port}`);

  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT });

  try {
    const stories = await getStories(port);
    console.log(`Found ${stories.length} stories`);

    for (const story of stories) {
      const page = await context.newPage();
      const url = `http://127.0.0.1:${port}/iframe.html?id=${story.id}&viewMode=story`;

      try {
        await page.goto(url, { waitUntil: "networkidle" });
        // Extra settle time for CSS transitions
        await page.waitForTimeout(300);

        const filename = `${story.id}.png`;
        await page.screenshot({ path: join(SCREENSHOTS_DIR, filename) });
        console.log(`  captured: ${filename}`);
      } catch (err) {
        console.error(`  FAILED: ${story.id} — ${err.message}`);
      } finally {
        await page.close();
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
