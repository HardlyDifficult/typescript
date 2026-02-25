#!/usr/bin/env node

/**
 * Captures a screenshot of each Storybook story using agent-browser.
 *
 * Prerequisites:
 *   - `storybook-static/` must exist (run `npm run build:storybook` first)
 *   - agent-browser's browser must be installed (`npx agent-browser install`)
 *
 * Output:
 *   - Light mode PNGs in `.screenshots/<category>/<name>.png`
 *   - Dark mode PNGs in `.screenshots/dark/<category>/<name>.png`
 *   - Small components (Button, Badge, Text) are combined into composite shots
 *   - Screenshots are cropped tight to the component (no viewport whitespace)
 */

import { createServer } from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import { join, extname } from "node:path";
import { BrowserManager } from "agent-browser/dist/browser.js";
import { executeCommand } from "agent-browser/dist/actions.js";

const STORYBOOK_DIR = new URL("../storybook-static", import.meta.url).pathname;
const SCREENSHOTS_DIR = new URL("../.screenshots", import.meta.url).pathname;
const DARK_SCREENSHOTS_DIR = join(SCREENSHOTS_DIR, "dark");

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

/**
 * Small components are combined into a single composite screenshot.
 * Key = output filename (under .screenshots/), value = story IDs to combine.
 */
const COMPOSITES = {
  "inputs/button-all": [
    "inputs-button--primary",
    "inputs-button--secondary",
    "inputs-button--ghost",
    "inputs-button--danger",
    "inputs-button--small",
    "inputs-button--loading",
    "inputs-button--with-icon",
  ],
  "content/badge-all": [
    "content-badge--default",
    "content-badge--success",
    "content-badge--warning",
    "content-badge--error",
    "content-badge--info",
  ],
  "data/statcard-all": [
    "data-statcard--revenue",
    "data-statcard--active-users",
    "data-statcard--error-rate",
    "data-statcard--no-trend",
  ],
};

const compositeStoryIds = new Set(Object.values(COMPOSITES).flat());

/** Maps a story to its screenshot path: `<category>/<component>-<variant>.png` */
function outputPath(story, dark = false) {
  const category = story.title.split("/")[0].toLowerCase();
  const component = story.title.split("/").slice(1).join("-").toLowerCase();
  const variant = story.name.toLowerCase().replace(/\s+/g, "-");
  const dir = dark ? DARK_SCREENSHOTS_DIR : SCREENSHOTS_DIR;
  return join(dir, category, `${component}-${variant}.png`);
}

/** Set data-theme="dark" on the document root to activate dark mode styles. */
async function enableDarkMode(browser) {
  const page = browser.getPage();
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
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

function storyUrl(port, storyId) {
  return `http://127.0.0.1:${port}/iframe.html?id=${storyId}&viewMode=story`;
}

/** Inject a stylesheet that disables all animations and transitions instantly. */
async function freezeAnimations(browser) {
  const page = browser.getPage();
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.textContent =
      "*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }";
    document.head.appendChild(style);
  });
}

/** Capture a single story, cropped to #storybook-root. */
async function captureStory(browser, port, story, dark = false) {
  const url = storyUrl(port, story.id);
  const dest = outputPath(story, dark);
  await mkdir(join(dest, ".."), { recursive: true });

  await executeCommand({ id: "nav", action: "navigate", url, waitUntil: "networkidle" }, browser);
  await executeCommand({ id: "wait", action: "wait", timeout: 300 }, browser);
  if (dark) await enableDarkMode(browser);
  await freezeAnimations(browser);
  await executeCommand(
    { id: "ss", action: "screenshot", path: dest, selector: "#storybook-root" },
    browser
  );
  return dest;
}

/** Capture a composite: render all variants in a flex row, then screenshot. */
async function captureComposite(browser, port, name, storyIds, dark = false) {
  const baseDir = dark ? DARK_SCREENSHOTS_DIR : SCREENSHOTS_DIR;
  const dest = join(baseDir, `${name}.png`);
  await mkdir(join(dest, ".."), { recursive: true });

  const page = browser.getPage();

  // Collect each story's rendered HTML
  const fragments = [];
  for (const storyId of storyIds) {
    await page.goto(storyUrl(port, storyId), { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    if (dark) {
      await page.evaluate(() => {
        document.documentElement.setAttribute("data-theme", "dark");
      });
    }
    const html = await page.evaluate(() => {
      const root = document.querySelector("#storybook-root");
      return root ? root.innerHTML : "";
    });
    const label = storyId.split("--")[1].replace(/-/g, " ");
    fragments.push({ html, label });
  }

  // Compose all variants into a single flex layout
  await page.evaluate((items) => {
    const root = document.querySelector("#storybook-root");
    if (!root) return;
    root.innerHTML = "";
    root.style.display = "flex";
    root.style.flexWrap = "wrap";
    root.style.gap = "16px";
    root.style.alignItems = "flex-start";
    root.style.padding = "0";

    for (const { html, label } of items) {
      const wrapper = document.createElement("div");
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = "center";
      wrapper.style.gap = "6px";

      const content = document.createElement("div");
      content.innerHTML = html;
      wrapper.appendChild(content);

      const labelEl = document.createElement("div");
      labelEl.textContent = label;
      labelEl.style.fontSize = "11px";
      labelEl.style.color = "#64748b";
      labelEl.style.fontFamily = "system-ui, sans-serif";
      wrapper.appendChild(labelEl);

      root.appendChild(wrapper);
    }
  }, fragments);

  if (dark) {
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-theme", "dark");
    });
  }
  await page.waitForTimeout(200);
  await freezeAnimations(browser);
  await executeCommand(
    { id: "ss", action: "screenshot", path: dest, selector: "#storybook-root" },
    browser
  );
  return dest;
}

async function main() {
  // Clean previous screenshots so removed/renamed stories show up as a diff
  await rm(SCREENSHOTS_DIR, { recursive: true, force: true });
  await mkdir(SCREENSHOTS_DIR, { recursive: true });

  console.log("Starting static server...");
  const { server, port } = await startServer();
  console.log(`Serving storybook-static on port ${port}`);

  const indexData = JSON.parse(await readFile(join(STORYBOOK_DIR, "index.json"), "utf-8"));
  const entries = indexData.entries || indexData.stories || {};
  const stories = Object.values(entries).filter((entry) => entry.type === "story");
  console.log(`Found ${stories.length} stories`);

  const browser = new BrowserManager();
  await browser.launch({ id: "launch", action: "launch", headless: true });

  try {
    // Light mode: composite screenshots for small components
    for (const [name, storyIds] of Object.entries(COMPOSITES)) {
      try {
        const dest = await captureComposite(browser, port, name, storyIds);
        console.log(`  captured: ${dest.replace(SCREENSHOTS_DIR + "/", "")}`);
      } catch (err) {
        console.error(`  FAILED composite ${name}: ${err.message}`);
      }
    }

    // Light mode: individual screenshots (skip stories already in composites)
    for (const story of stories) {
      if (compositeStoryIds.has(story.id)) continue;
      try {
        const dest = await captureStory(browser, port, story);
        console.log(`  captured: ${dest.replace(SCREENSHOTS_DIR + "/", "")}`);
      } catch (err) {
        console.error(`  FAILED: ${story.id} — ${err.message}`);
      }
    }

    // Dark mode: composite screenshots
    console.log("\nCapturing dark mode screenshots...");
    for (const [name, storyIds] of Object.entries(COMPOSITES)) {
      try {
        const dest = await captureComposite(browser, port, name, storyIds, true);
        console.log(`  captured: ${dest.replace(SCREENSHOTS_DIR + "/", "")}`);
      } catch (err) {
        console.error(`  FAILED composite ${name} (dark): ${err.message}`);
      }
    }

    // Dark mode: individual screenshots
    for (const story of stories) {
      if (compositeStoryIds.has(story.id)) continue;
      try {
        const dest = await captureStory(browser, port, story, true);
        console.log(`  captured: ${dest.replace(SCREENSHOTS_DIR + "/", "")}`);
      } catch (err) {
        console.error(`  FAILED: ${story.id} (dark) — ${err.message}`);
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
