import { describe, expect, it, vi } from "vitest";

// Import directly from index.ts to trigger barrel file execution
import {
  NotionApiError,
  NotionClient,
  blocksToMarkdown,
  extractNotionPageId,
  extractPageTitle,
  markdownToBlocks,
  notionParent,
  notionProperty,
  richTextToPlainText,
  selectionFromMarkdown,
  textToParagraphBlocks,
} from "../src/index.js";

// Import directly from markdown.ts to trigger barrel file execution
import {
  blocksToMarkdown as blocksToMarkdownFromBarrel,
  markdownToBlocks as markdownToBlocksFromBarrel,
  richTextToPlainText as richTextToPlainTextFromBarrel,
  selectionFromMarkdown as selectionFromMarkdownFromBarrel,
  textToParagraphBlocks as textToParagraphBlocksFromBarrel,
} from "../src/markdown.js";

// Import builders directly for full coverage
import {
  isMarkdownRenderable,
  isPageDraft,
  normalizeProperties,
  toMarkdownContent,
  toPageBody,
  toPropertyValue,
} from "../src/builders.js";

// Import markdown modules directly
import { parseHeading, parseListMarker, parseCodeFence, parseQuote, parseEquation, parseParagraph, parseListBlock, attachChildren } from "../src/markdown/blocks.js";
import { parseMediaBlock } from "../src/markdown/media.js";
import { blocksToMarkdown as blocksToMd } from "../src/markdown/renderer.js";
import { makeTextRichText, renderRichText, richTextFromMarkdown, richTextToPlainText as rtp, textToParagraphBlocks as ttpb } from "../src/markdown/richText.js";
import { normalizeMarkdown, selectionFromMarkdown as sfm } from "../src/markdown/shared.js";
import { buildSectionBlocks, extractNotionPageId as extractNotionPageIdFromShared, extractPageTitle as extractPageTitleFromShared, normalizeParent, splitIntoChunks, toPageMeta } from "../src/client/shared.js";
import type { NotionBlock } from "../src/types.js";

function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

// ========================
// index.ts / markdown.ts - just need to be imported (already done above)
// ========================
describe("index.ts exports", () => {
  it("re-exports all expected symbols", () => {
    expect(NotionClient).toBeDefined();
    expect(NotionApiError).toBeDefined();
    expect(blocksToMarkdown).toBeDefined();
    expect(markdownToBlocks).toBeDefined();
    expect(richTextToPlainText).toBeDefined();
    expect(selectionFromMarkdown).toBeDefined();
    expect(textToParagraphBlocks).toBeDefined();
    expect(notionParent).toBeDefined();
    expect(notionProperty).toBeDefined();
    expect(extractNotionPageId).toBeDefined();
    expect(extractPageTitle).toBeDefined();
  });

  it("markdown.ts barrel re-exports work", () => {
    expect(blocksToMarkdownFromBarrel).toBeDefined();
    expect(markdownToBlocksFromBarrel).toBeDefined();
    expect(richTextToPlainTextFromBarrel).toBeDefined();
    expect(selectionFromMarkdownFromBarrel).toBeDefined();
    expect(textToParagraphBlocksFromBarrel).toBeDefined();
    expect(markdownToBlocksFromBarrel("# H1")).toHaveLength(1);
    expect(blocksToMarkdownFromBarrel([])).toBe("");
    expect(richTextToPlainTextFromBarrel([])).toBe("");
    expect(textToParagraphBlocksFromBarrel("")).toEqual([]);
    expect(selectionFromMarkdownFromBarrel("")).toBeUndefined();
  });
});

// ========================
// builders.ts coverage
// ========================
describe("builders coverage", () => {
  it("notionParent.dataSource", () => {
    expect(notionParent.dataSource("ds-123")).toEqual({
      type: "data_source_id",
      data_source_id: "ds-123",
    });
  });

  it("notionParent.dataSource throws on blank", () => {
    expect(() => notionParent.dataSource("   ")).toThrow("dataSourceId is required");
  });

  it("notionProperty.richText", () => {
    expect(notionProperty.richText("hello")).toEqual({
      rich_text: [{ type: "text", text: { content: "hello" } }],
    });
  });

  it("notionProperty.text delegates to richText", () => {
    expect(notionProperty.text("hello")).toEqual(notionProperty.richText("hello"));
  });

  it("notionProperty.select with null", () => {
    expect(notionProperty.select(null)).toEqual({ select: null });
  });

  it("notionProperty.select with value", () => {
    expect(notionProperty.select("Option A")).toEqual({ select: { name: "Option A" } });
  });

  it("notionProperty.status with null", () => {
    expect(notionProperty.status(null)).toEqual({ status: null });
  });

  it("notionProperty.date with null start returns null date", () => {
    expect(notionProperty.date(null)).toEqual({ date: null });
  });

  it("notionProperty.date with end and timezone", () => {
    const result = notionProperty.date("2026-01-01", "2026-01-31", "UTC");
    expect(result).toEqual({
      date: {
        start: "2026-01-01",
        end: "2026-01-31",
        time_zone: "UTC",
      },
    });
  });

  it("notionProperty.date with null end", () => {
    const result = notionProperty.date("2026-01-01", null);
    expect(result).toEqual({
      date: { start: "2026-01-01", end: null },
    });
  });

  it("notionProperty.url", () => {
    expect(notionProperty.url("https://example.com")).toEqual({ url: "https://example.com" });
    expect(notionProperty.url(null)).toEqual({ url: null });
  });

  it("notionProperty.email", () => {
    expect(notionProperty.email("test@example.com")).toEqual({ email: "test@example.com" });
    expect(notionProperty.email(null)).toEqual({ email: null });
  });

  it("notionProperty.phoneNumber", () => {
    expect(notionProperty.phoneNumber("+1-800-555-0000")).toEqual({ phone_number: "+1-800-555-0000" });
    expect(notionProperty.phoneNumber(null)).toEqual({ phone_number: null });
  });

  it("notionProperty.relation", () => {
    expect(notionProperty.relation("id-1", "id-2")).toEqual({
      relation: [{ id: "id-1" }, { id: "id-2" }],
    });
  });

  it("notionProperty.relation throws on blank", () => {
    expect(() => notionProperty.relation("")).toThrow("relation id is required");
  });

  it("notionProperty.people", () => {
    expect(notionProperty.people("user-1")).toEqual({
      people: [{ id: "user-1" }],
    });
  });

  it("notionProperty.people throws on blank", () => {
    expect(() => notionProperty.people("")).toThrow("person id is required");
  });

  it("notionProperty.raw passthrough", () => {
    const val = { title: [{ type: "text", text: { content: "x" } }] };
    expect(notionProperty.raw(val as any)).toBe(val);
  });

  it("notionProperty.number null", () => {
    expect(notionProperty.number(null)).toEqual({ number: null });
  });

  it("isMarkdownRenderable with renderable object", () => {
    expect(isMarkdownRenderable({ toMarkdown: () => "" })).toBe(true);
    expect(isMarkdownRenderable(null)).toBe(false);
    expect(isMarkdownRenderable("hello")).toBe(false);
    expect(isMarkdownRenderable({ toMarkdown: "not a function" })).toBe(false);
  });

  it("isPageDraft", () => {
    expect(isPageDraft({ parent: {} })).toBe(true);
    expect(isPageDraft({})).toBe(false);
    expect(isPageDraft(null)).toBe(false);
  });

  it("toMarkdownContent with string", () => {
    expect(toMarkdownContent("hello")).toBe("hello");
  });

  it("toMarkdownContent with renderable", () => {
    expect(toMarkdownContent({ toMarkdown: () => "rendered" })).toBe("rendered");
  });

  it("toPageBody undefined", () => {
    expect(toPageBody(undefined)).toBeUndefined();
  });

  it("toPageBody with blocks array", () => {
    const blocks: NotionBlock[] = [{ object: "block", type: "divider", divider: {} }];
    expect(toPageBody(blocks)).toBe(blocks);
  });

  it("toPageBody with string content", () => {
    expect(toPageBody("# Hello")).toBe("# Hello");
  });

  it("toPageBody with renderable", () => {
    expect(toPageBody({ toMarkdown: () => "md" })).toBe("md");
  });

  it("normalizeProperties handles various types", () => {
    const result = normalizeProperties({
      Score: 42,
      Active: true,
      Due: new Date("2026-01-01"),
      Tags: ["a", "b"],
    });
    expect(result.Score).toEqual({ number: 42 });
    expect(result.Active).toEqual({ checkbox: true });
    expect(result.Tags).toEqual({ multi_select: [{ name: "a" }, { name: "b" }] });
  });

  it("toPropertyValue with raw value", () => {
    const raw = { title: [{ type: "text", text: { content: "x" } }] };
    expect(toPropertyValue("Name", raw as any)).toBe(raw);
  });

  it("toPropertyValue with string", () => {
    expect(toPropertyValue("Notes", "hello")).toEqual({
      rich_text: [{ type: "text", text: { content: "hello" } }],
    });
  });

  it("toPropertyValue with number", () => {
    expect(toPropertyValue("Score", 99)).toEqual({ number: 99 });
  });

  it("toPropertyValue with boolean", () => {
    expect(toPropertyValue("Done", false)).toEqual({ checkbox: false });
  });

  it("toPropertyValue with Date", () => {
    const d = new Date("2026-03-01T00:00:00Z");
    expect(toPropertyValue("Due", d)).toEqual({ date: { start: "2026-03-01T00:00:00.000Z" } });
  });

  it("toPropertyValue with string array", () => {
    expect(toPropertyValue("Tags", ["a", "b"])).toEqual({
      multi_select: [{ name: "a" }, { name: "b" }],
    });
  });

  it("toPropertyValue with non-string array throws", () => {
    expect(() => toPropertyValue("Bad", [1, 2] as any)).toThrow("only supports string arrays");
  });

  it("toPropertyValue with unknown plain object throws", () => {
    expect(() => toPropertyValue("Bad", { foo: "bar" } as any)).toThrow("Unsupported Notion property input");
  });

  it("toPropertyValue with structured title", () => {
    expect(toPropertyValue("Name", { type: "title", value: "My Page" } as any)).toEqual({
      title: [{ type: "text", text: { content: "My Page" } }],
    });
  });

  it("toPropertyValue with structured text null", () => {
    expect(toPropertyValue("Notes", { type: "text", value: null } as any)).toEqual({ rich_text: [] });
  });

  it("toPropertyValue with structured text string", () => {
    expect(toPropertyValue("Notes", { type: "text", value: "hello" } as any)).toEqual({
      rich_text: [{ type: "text", text: { content: "hello" } }],
    });
  });

  it("toPropertyValue with structured select", () => {
    expect(toPropertyValue("Status", { type: "select", value: "Open" } as any)).toEqual({
      select: { name: "Open" },
    });
  });

  it("toPropertyValue with structured status", () => {
    expect(toPropertyValue("Status", { type: "status", value: "Done" } as any)).toEqual({
      status: { name: "Done" },
    });
  });

  it("toPropertyValue with structured date null", () => {
    expect(toPropertyValue("Due", { type: "date", value: null } as any)).toEqual({ date: null });
  });

  it("toPropertyValue with structured date string", () => {
    expect(toPropertyValue("Due", { type: "date", value: "2026-01-15" } as any)).toEqual({
      date: { start: "2026-01-15" },
    });
  });

  it("toPropertyValue with structured date Date object", () => {
    const d = new Date("2026-01-15T00:00:00Z");
    expect(toPropertyValue("Due", { type: "date", value: d } as any)).toEqual({
      date: { start: d.toISOString() },
    });
  });

  it("toPropertyValue with structured number", () => {
    expect(toPropertyValue("Score", { type: "number", value: 5 } as any)).toEqual({ number: 5 });
  });

  it("toPropertyValue with structured checkbox", () => {
    expect(toPropertyValue("Done", { type: "checkbox", value: true } as any)).toEqual({ checkbox: true });
  });

  it("toPropertyValue with structured url", () => {
    expect(toPropertyValue("Link", { type: "url", value: "https://x.com" } as any)).toEqual({
      url: "https://x.com",
    });
  });

  it("toPropertyValue with structured email", () => {
    expect(toPropertyValue("Email", { type: "email", value: "a@b.com" } as any)).toEqual({
      email: "a@b.com",
    });
  });

  it("toPropertyValue with structured phone_number", () => {
    expect(toPropertyValue("Phone", { type: "phone_number", value: "123" } as any)).toEqual({
      phone_number: "123",
    });
  });

  it("toPropertyValue with structured multi_select", () => {
    expect(toPropertyValue("Tags", { type: "multi_select", value: ["a"] } as any)).toEqual({
      multi_select: [{ name: "a" }],
    });
  });

  it("toPropertyValue with structured relation", () => {
    expect(toPropertyValue("Related", { type: "relation", value: ["id-1"] } as any)).toEqual({
      relation: [{ id: "id-1" }],
    });
  });

  it("toPropertyValue with structured people", () => {
    expect(toPropertyValue("Owner", { type: "people", value: ["user-1"] } as any)).toEqual({
      people: [{ id: "user-1" }],
    });
  });
});

// ========================
// client/shared.ts coverage
// ========================
describe("client/shared.ts coverage", () => {
  it("splitIntoChunks splits text", () => {
    expect(splitIntoChunks("abcde", 2)).toEqual(["ab", "cd", "e"]);
    expect(splitIntoChunks("", 2)).toEqual([]);
  });

  it("buildSectionBlocks creates heading + paragraphs", () => {
    const blocks = buildSectionBlocks("My Heading", "Body text here");
    expect(blocks[0]?.type).toBe("heading_2");
    expect(blocks[1]?.type).toBe("paragraph");
  });

  it("normalizeParent with string database id", () => {
    const result = normalizeParent("db-123");
    expect(result.parent).toEqual({ database_id: "db-123" });
    expect(result.notionVersion).toBe("2022-06-28");
  });

  it("normalizeParent with database_id object", () => {
    const result = normalizeParent({ type: "database_id", database_id: "db-123" });
    expect(result.parent).toEqual({ database_id: "db-123" });
    expect(result.notionVersion).toBe("2022-06-28");
  });

  it("normalizeParent with page_id", () => {
    const result = normalizeParent({ type: "page_id", page_id: "page-123" });
    expect(result.parent).toEqual({ page_id: "page-123" });
    expect(result.notionVersion).toBe("2022-06-28");
  });

  it("normalizeParent with workspace", () => {
    const result = normalizeParent({ type: "workspace", workspace: true });
    expect(result.parent).toEqual({ workspace: true });
    expect(result.notionVersion).toBe("2022-06-28");
  });

  it("normalizeParent with data_source_id", () => {
    const result = normalizeParent({ type: "data_source_id", data_source_id: "ds-123" });
    expect(result.notionVersion).toBe("2025-09-03");
  });

  it("extractPageTitle returns empty string when no properties", () => {
    expect(extractPageTitleFromShared(undefined)).toBe("");
    expect(extractPageTitleFromShared({})).toBe("");
  });

  it("extractPageTitle returns title from properties", () => {
    const props = {
      Name: {
        type: "title" as const,
        title: [{ type: "text" as const, text: { content: "My Page" }, plain_text: "My Page", href: null }],
      },
    };
    expect(extractPageTitleFromShared(props as any)).toBe("My Page");
  });

  it("extractPageTitle skips non-title properties", () => {
    const props = {
      Status: {
        type: "select" as const,
        select: { name: "Active" },
      },
    };
    expect(extractPageTitleFromShared(props as any)).toBe("");
  });

  it("toPageMeta normalizes optional fields", () => {
    const page = {
      id: "page-1",
      url: "https://notion.so/page-1",
      object: "page",
    } as any;
    const meta = toPageMeta(page);
    expect(meta.id).toBe("page-1");
    expect(meta.lastEdited).toBeNull();
    expect(meta.createdTime).toBeNull();
    expect(meta.archived).toBe(false);
    expect(meta.inTrash).toBe(false);
    expect(meta.icon).toBeNull();
    expect(meta.cover).toBeNull();
    expect(meta.properties).toEqual({});
  });

  it("extractNotionPageId from Notion URL", () => {
    const url = "https://www.notion.so/workspace/Page-Title-abc123def456789012345678901234ab";
    const id = extractNotionPageIdFromShared(url);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("extractNotionPageId from bare 32-char hex string", () => {
    const id = "abc123def456789012345678901234ab";
    const result = extractNotionPageIdFromShared(id);
    expect(result).toMatch(/[0-9a-f]{8}-/);
  });

  it("extractNotionPageId from URL with query params", () => {
    const url = "https://www.notion.so/Page-abc123def456789012345678901234ab?v=123";
    const result = extractNotionPageIdFromShared(url);
    expect(result).toBeDefined();
  });

  it("extractNotionPageId from URL with hash fragment", () => {
    const url = "https://www.notion.so/Page-abc123def456789012345678901234ab#section";
    const result = extractNotionPageIdFromShared(url);
    expect(result).toBeDefined();
  });

  it("extractNotionPageId returns original string when no ID found in URL", () => {
    const url = "https://example.com/not-a-notion-page";
    expect(extractNotionPageIdFromShared(url)).toBe(url.trim());
  });

  it("extractNotionPageId returns trimmed string when no pattern matches", () => {
    expect(extractNotionPageIdFromShared("  not-an-id  ")).toBe("not-an-id");
  });
});

// ========================
// markdown/shared.ts coverage
// ========================
describe("markdown/shared.ts coverage", () => {
  it("selectionFromMarkdown returns undefined for empty string", () => {
    expect(sfm("")).toBeUndefined();
    expect(sfm("   ")).toBeUndefined();
  });

  it("selectionFromMarkdown short content repeats", () => {
    const short = "hello world";
    const result = sfm(short);
    expect(result).toBe(short + "..." + short);
  });

  it("selectionFromMarkdown long content uses edges", () => {
    const long = "a".repeat(50);
    const result = sfm(long);
    expect(result).toContain("...");
    expect(result?.startsWith("a".repeat(20))).toBe(true);
    expect(result?.endsWith("a".repeat(20))).toBe(true);
  });

  it("normalizeMarkdown trims and normalizes line endings", () => {
    const result = normalizeMarkdown("  hello\r\nworld  ");
    expect(result).toBe("hello\nworld");
  });
});

// ========================
// markdown/richText.ts coverage
// ========================
describe("markdown/richText.ts coverage", () => {
  it("richTextToPlainText with no plain_text uses content", () => {
    const segments = [
      { type: "text" as const, text: { content: "hello" } },
    ] as any[];
    expect(rtp(segments)).toBe("hello");
  });

  it("renderRichText with underline", () => {
    const segments = [makeTextRichText("underlined", { underline: true })];
    const result = renderRichText(segments);
    expect(result).toContain("<u>");
    expect(result).toContain("</u>");
  });

  it("renderRichText with link", () => {
    const segment = {
      type: "text" as const,
      text: { content: "click", link: { url: "https://example.com" } },
      plain_text: "click",
      href: "https://example.com",
    };
    const result = renderRichText([segment] as any);
    expect(result).toContain("[click]");
    expect(result).toContain("https://example.com");
  });

  it("renderRichText with strikethrough", () => {
    const segments = [makeTextRichText("text", { strikethrough: true })];
    expect(renderRichText(segments)).toBe("~~text~~");
  });

  it("renderRichText with italic", () => {
    const segments = [makeTextRichText("text", { italic: true })];
    expect(renderRichText(segments)).toBe("*text*");
  });

  it("renderRichText with code+bold annotations", () => {
    const seg = makeTextRichText("text", { code: true, bold: true });
    const result = renderRichText([seg]);
    expect(result).toContain("`");
    expect(result).toContain("**");
  });

  it("richTextFromMarkdown parses underline", () => {
    const result = richTextFromMarkdown("<u>underlined</u>");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.annotations?.underline).toBe(true);
  });

  it("richTextFromMarkdown parses inline code", () => {
    const result = richTextFromMarkdown("`code here`");
    expect(result[0]?.annotations?.code).toBe(true);
  });

  it("richTextFromMarkdown parses strikethrough", () => {
    const result = richTextFromMarkdown("~~strike~~");
    expect(result[0]?.annotations?.strikethrough).toBe(true);
  });

  it("richTextFromMarkdown parses bold with underscores", () => {
    const result = richTextFromMarkdown("__bold__");
    expect(result[0]?.annotations?.bold).toBe(true);
  });

  it("richTextFromMarkdown parses italic with underscore", () => {
    const result = richTextFromMarkdown("_italic_");
    expect(result[0]?.annotations?.italic).toBe(true);
  });

  it("richTextFromMarkdown parses link with styled label", () => {
    const result = richTextFromMarkdown("[**bold link**](https://example.com)");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.text?.link?.url).toBe("https://example.com");
  });

  it("richTextFromMarkdown - empty inline code hits pushText early return (line 85)", () => {
    // Empty inline code: `pushText` is called with "" content for the code literal
    // This triggers the `if (content.length === 0) return;` branch
    const result = richTextFromMarkdown("``");
    // Empty code produces no rich text segments
    expect(result).toEqual([]);
  });

  it("richTextFromMarkdown - findLink returns null when ] not followed by ](", () => {
    const result = richTextFromMarkdown("[text]http://url");
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("richTextFromMarkdown - findLink returns null when no closing paren", () => {
    const result = richTextFromMarkdown("[text](url-missing-paren");
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("richTextFromMarkdown - unclosed bold treated as plain text", () => {
    const result = richTextFromMarkdown("**unclosed bold");
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("richTextFromMarkdown - delimiter wins when earlier than link", () => {
    const result = richTextFromMarkdown("**bold** then [link](https://example.com)");
    const boldPart = result.find((s: any) => s.annotations?.bold === true);
    expect(boldPart).toBeDefined();
  });

  it("textToParagraphBlocks returns empty for blank", () => {
    expect(ttpb("")).toEqual([]);
    expect(ttpb("   ")).toEqual([]);
  });

  it("textToParagraphBlocks splits on double newline", () => {
    const result = ttpb("Para one\n\nPara two");
    expect(result).toHaveLength(2);
    expect(result[0]?.type).toBe("paragraph");
  });
});

// ========================
// markdown/blocks.ts coverage
// ========================
describe("markdown/blocks.ts coverage", () => {
  it("parseHeading h3", () => {
    const block = parseHeading("### Subheading");
    expect(block?.type).toBe("heading_3");
  });

  it("parseHeading returns null for non-heading", () => {
    expect(parseHeading("plain text")).toBeNull();
  });

  it("parseListMarker numbered list", () => {
    const result = parseListMarker("1. First item");
    expect(result?.type).toBe("numbered_list_item");
    expect(result?.text).toBe("First item");
  });

  it("parseListMarker indented bullet", () => {
    const result = parseListMarker("  - nested item");
    expect(result?.type).toBe("bulleted_list_item");
    expect(result?.indent).toBe(2);
  });

  it("parseListMarker todo checked", () => {
    const result = parseListMarker("- [X] checked");
    expect(result?.type).toBe("to_do");
    expect(result?.checked).toBe(true);
  });

  it("parseListMarker returns null for non-list", () => {
    expect(parseListMarker("just a line")).toBeNull();
  });

  it("parseCodeFence with unclosed fence", () => {
    const result = parseCodeFence(["```js", "code here"], 0);
    expect(result.blocks[0]?.type).toBe("code");
    expect(result.nextIndex).toBe(2);
  });

  it("parseCodeFence with empty language", () => {
    const result = parseCodeFence(["```", "content", "```"], 0);
    const block = result.blocks[0];
    expect(block?.type).toBe("code");
    if (block?.type === "code") {
      expect(block.code.language).toBe("plain text");
    }
  });

  it("parseQuote parses multiline", () => {
    const result = parseQuote(["> Line 1", "> Line 2", "other"], 0);
    expect(result.blocks[0]?.type).toBe("quote");
    expect(result.nextIndex).toBe(2);
  });

  it("parseEquation inline form", () => {
    const result = parseEquation(["$$E=mc^2$$"], 0);
    const block = result.blocks[0];
    expect(block?.type).toBe("equation");
    if (block?.type === "equation") {
      expect(block.equation.expression).toBe("E=mc^2");
    }
  });

  it("parseEquation multiline form", () => {
    const result = parseEquation(["$$", "E = mc^2", "$$"], 0);
    const block = result.blocks[0];
    expect(block?.type).toBe("equation");
    if (block?.type === "equation") {
      expect(block.equation.expression).toBe("E = mc^2");
    }
    expect(result.nextIndex).toBe(3);
  });

  it("parseParagraph stops at blank line", () => {
    const result = parseParagraph(["First line", "", "Second para"], 0);
    expect(result.blocks).toHaveLength(1);
    expect(result.nextIndex).toBe(1);
  });

  it("parseParagraph stops at code fence", () => {
    const result = parseParagraph(["text", "```ts"], 0);
    expect(result.nextIndex).toBe(1);
  });

  it("parseParagraph stops at quote", () => {
    const result = parseParagraph(["text", "> quote"], 0);
    expect(result.nextIndex).toBe(1);
  });

  it("parseParagraph stops at divider", () => {
    const result = parseParagraph(["text", "---"], 0);
    expect(result.nextIndex).toBe(1);
  });

  it("parseParagraph stops at heading", () => {
    const result = parseParagraph(["text", "# heading"], 0);
    expect(result.nextIndex).toBe(1);
  });

  it("parseParagraph stops at list", () => {
    const result = parseParagraph(["text", "- item"], 0);
    expect(result.nextIndex).toBe(1);
  });

  it("parseParagraph stops at <details>", () => {
    const result = parseParagraph(["text", "<details>"], 0);
    expect(result.nextIndex).toBe(1);
  });

  it("parseParagraph stops at callout", () => {
    const result = parseParagraph(["text", "::: callout"], 0);
    expect(result.nextIndex).toBe(1);
  });

  it("parseParagraph stops at table_of_contents", () => {
    const result = parseParagraph(["text", "<table_of_contents/>"], 0);
    expect(result.nextIndex).toBe(1);
  });

  it("parseParagraph stops at media block", () => {
    const result = parseParagraph(["text", "![img](https://example.com/img.png)"], 0);
    expect(result.nextIndex).toBe(1);
  });

  it("parseParagraph stops at <file>", () => {
    const result = parseParagraph(["text", '<file src="url" />'], 0);
    expect(result.nextIndex).toBe(1);
  });

  it("parseParagraph stops at <page> tag", () => {
    const result = parseParagraph(["text", '<page title="My Page" />'], 0);
    expect(result.nextIndex).toBe(1);
  });

  it("parseParagraph stops at $$", () => {
    const result = parseParagraph(["text", "$$E=mc^2$$"], 0);
    expect(result.nextIndex).toBe(1);
  });

  it("attachChildren to paragraph with existing", () => {
    const block: NotionBlock = {
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [],
        children: [{ object: "block", type: "divider", divider: {} }],
      },
    };
    attachChildren(block, [{ object: "block", type: "divider", divider: {} }]);
    if (block.type === "paragraph") {
      expect(block.paragraph.children).toHaveLength(2);
    }
  });

  it("attachChildren to paragraph without existing children", () => {
    const block: NotionBlock = {
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: [] },
    };
    attachChildren(block, [{ object: "block", type: "divider", divider: {} }]);
    if (block.type === "paragraph") {
      expect(block.paragraph.children).toHaveLength(1);
    }
  });

  it("attachChildren to numbered_list_item", () => {
    const block: NotionBlock = {
      object: "block",
      type: "numbered_list_item",
      numbered_list_item: { rich_text: [] },
    };
    attachChildren(block, [{ object: "block", type: "divider", divider: {} }]);
    if (block.type === "numbered_list_item") {
      expect(block.numbered_list_item.children).toHaveLength(1);
    }
  });

  it("attachChildren to to_do", () => {
    const block: NotionBlock = {
      object: "block",
      type: "to_do",
      to_do: { rich_text: [], checked: false },
    };
    attachChildren(block, [{ object: "block", type: "divider", divider: {} }]);
    if (block.type === "to_do") {
      expect(block.to_do.children).toHaveLength(1);
    }
  });

  it("attachChildren to quote", () => {
    const block: NotionBlock = {
      object: "block",
      type: "quote",
      quote: { rich_text: [] },
    };
    attachChildren(block, [{ object: "block", type: "divider", divider: {} }]);
    if (block.type === "quote") {
      expect(block.quote.children).toHaveLength(1);
    }
  });

  it("attachChildren to callout", () => {
    const block: NotionBlock = {
      object: "block",
      type: "callout",
      callout: { rich_text: [] },
    };
    attachChildren(block, [{ object: "block", type: "divider", divider: {} }]);
    if (block.type === "callout") {
      expect(block.callout.children).toHaveLength(1);
    }
  });

  it("attachChildren to toggle", () => {
    const block: NotionBlock = {
      object: "block",
      type: "toggle",
      toggle: { rich_text: [] },
    };
    attachChildren(block, [{ object: "block", type: "divider", divider: {} }]);
    if (block.type === "toggle") {
      expect(block.toggle.children).toHaveLength(1);
    }
  });

  it("attachChildren to synced_block", () => {
    const block: NotionBlock = {
      object: "block",
      type: "synced_block",
      synced_block: {},
    };
    attachChildren(block, [{ object: "block", type: "divider", divider: {} }]);
    if (block.type === "synced_block") {
      expect(block.synced_block.children).toHaveLength(1);
    }
  });

  it("attachChildren does nothing for empty children", () => {
    const block: NotionBlock = { object: "block", type: "divider", divider: {} };
    expect(() => attachChildren(block, [])).not.toThrow();
  });

  it("attachChildren to unsupported type does nothing", () => {
    const block: NotionBlock = { object: "block", type: "divider", divider: {} };
    attachChildren(block, [{ object: "block", type: "divider", divider: {} }]);
  });

  it("parseListBlock with numbered list items", () => {
    const result = parseListBlock(["1. first", "2. second"], 0, 0);
    expect(result.blocks).toHaveLength(2);
    expect(result.blocks[0]?.type).toBe("numbered_list_item");
  });

  it("parseListBlock skips blank lines", () => {
    const result = parseListBlock(["- item1", "", "- item2"], 0, 0);
    expect(result.blocks).toHaveLength(2);
  });

  it("parseListBlock handles nested indented items", () => {
    const result = parseListBlock(["- parent", "  - child"], 0, 0);
    expect(result.blocks).toHaveLength(1);
    const parent = result.blocks[0];
    if (parent?.type === "bulleted_list_item") {
      expect(parent.bulleted_list_item.children).toHaveLength(1);
    }
  });

  it("parseListBlock stops when indent < baseIndent", () => {
    const result = parseListBlock(["  - item", "- outer"], 0, 2);
    expect(result.blocks).toHaveLength(1);
    expect(result.nextIndex).toBe(1);
  });

  it("parseListBlock with deeper indent but no previous block", () => {
    const result = parseListBlock(["    - orphan"], 0, 0);
    expect(result.blocks).toHaveLength(0);
  });
});

// ========================
// markdown/media.ts coverage
// ========================
describe("markdown/media.ts coverage", () => {
  it("parseMediaBlock returns null for non-media", () => {
    expect(parseMediaBlock("plain text")).toBeNull();
    expect(parseMediaBlock("not a block")).toBeNull();
  });

  it("parseMediaBlock parses image without caption", () => {
    const block = parseMediaBlock("![](https://example.com/img.png)");
    expect(block?.type).toBe("image");
    if (block?.type === "image") {
      expect(block.image.caption).toBeUndefined();
    }
  });

  it("parseMediaBlock parses image with caption", () => {
    const block = parseMediaBlock("![my caption](https://example.com/img.png)");
    expect(block?.type).toBe("image");
    if (block?.type === "image") {
      expect(block.image.caption).toBeDefined();
    }
  });

  it("parseMediaBlock parses file tag", () => {
    const block = parseMediaBlock('<file src="https://example.com/doc.pdf" />');
    expect(block?.type).toBe("file");
  });

  it("parseMediaBlock parses file tag with caption", () => {
    const block = parseMediaBlock('<file src="https://example.com/doc.pdf" caption="My File" />');
    expect(block?.type).toBe("file");
    if (block?.type === "file") {
      expect(block.file.caption).toBeDefined();
    }
  });

  it("parseMediaBlock parses video tag", () => {
    const block = parseMediaBlock('<video src="https://example.com/vid.mp4" />');
    expect(block?.type).toBe("video");
  });

  it("parseMediaBlock parses audio tag", () => {
    const block = parseMediaBlock('<audio src="https://example.com/sound.mp3" />');
    expect(block?.type).toBe("audio");
  });

  it("parseMediaBlock parses pdf tag", () => {
    const block = parseMediaBlock('<pdf src="https://example.com/doc.pdf" />');
    expect(block?.type).toBe("pdf");
  });

  it("parseMediaBlock parses embed tag", () => {
    const block = parseMediaBlock('<embed src="https://example.com/embed" />');
    expect(block?.type).toBe("embed");
  });

  it("parseMediaBlock parses bookmark tag", () => {
    const block = parseMediaBlock('<bookmark src="https://example.com/page" />');
    expect(block?.type).toBe("bookmark");
  });

  it("parseMediaBlock parses child_page", () => {
    const block = parseMediaBlock('<page title="My Subpage" />');
    expect(block?.type).toBe("child_page");
  });

  it("parseMediaBlock parses child_page with url", () => {
    const block = parseMediaBlock('<page title="My Page" url="https://notion.so/page-123" />');
    expect(block?.type).toBe("child_page");
    if (block?.type === "child_page") {
      expect(block.child_page.url).toBe("https://notion.so/page-123");
    }
  });

  it("parseMediaBlock parses child_database", () => {
    const block = parseMediaBlock('<database title="My DB" />');
    expect(block?.type).toBe("child_database");
  });

  it("parseMediaBlock parses child_database with url", () => {
    const block = parseMediaBlock('<database title="My DB" url="https://notion.so/db-123" />');
    expect(block?.type).toBe("child_database");
    if (block?.type === "child_database") {
      expect(block.child_database.url).toBe("https://notion.so/db-123");
    }
  });
});

// ========================
// markdown/parser.ts coverage
// ========================
describe("markdownToBlocks (parser) coverage", () => {
  it("returns empty for blank markdown", () => {
    expect(markdownToBlocks("")).toEqual([]);
    expect(markdownToBlocks("   ")).toEqual([]);
  });

  it("parses divider", () => {
    const blocks = markdownToBlocks("---");
    expect(blocks[0]?.type).toBe("divider");
  });

  it("parses table_of_contents", () => {
    const blocks = markdownToBlocks("<table_of_contents/>");
    expect(blocks[0]?.type).toBe("table_of_contents");
  });

  it("parses <details> toggle with <summary>", () => {
    const md = "<details>\n<summary>Toggle title</summary>\nContent inside\n</details>";
    const blocks = markdownToBlocks(md);
    expect(blocks[0]?.type).toBe("toggle");
  });

  it("parses <details> toggle without <summary>", () => {
    const md = "<details>\nContent without summary\n</details>";
    const blocks = markdownToBlocks(md);
    expect(blocks[0]?.type).toBe("toggle");
  });

  it("parses callout with icon and color", () => {
    const md = "::: callout [icon=💡] {color=\"blue\"}\nCallout body\n:::";
    const blocks = markdownToBlocks(md);
    expect(blocks[0]?.type).toBe("callout");
    if (blocks[0]?.type === "callout") {
      expect(blocks[0].callout.icon?.type).toBe("emoji");
    }
  });

  it("parses callout with no paragraph start", () => {
    const md = "::: callout\n# Heading inside\n:::";
    const blocks = markdownToBlocks(md);
    expect(blocks[0]?.type).toBe("callout");
  });

  it("parses synced_block", () => {
    const md = "<synced_block>\nSome content\n</synced_block>";
    const blocks = markdownToBlocks(md);
    expect(blocks[0]?.type).toBe("synced_block");
  });

  it("parses equation block", () => {
    const blocks = markdownToBlocks("$$E = mc^2$$");
    expect(blocks[0]?.type).toBe("equation");
  });

  it("parses equation multiline block", () => {
    const blocks = markdownToBlocks("$$\nE = mc^2\n$$");
    expect(blocks[0]?.type).toBe("equation");
  });

  it("parses numbered list items", () => {
    const blocks = markdownToBlocks("1. first\n2. second");
    expect(blocks[0]?.type).toBe("numbered_list_item");
  });

  it("parses child_page block", () => {
    const blocks = markdownToBlocks('<page title="Sub Page" />');
    expect(blocks[0]?.type).toBe("child_page");
  });

  it("parses child_database block", () => {
    const blocks = markdownToBlocks('<database title="My DB" />');
    expect(blocks[0]?.type).toBe("child_database");
  });

  it("handles callout with children blocks", () => {
    const md = "::: callout\nText\n- item1\n:::";
    const blocks = markdownToBlocks(md);
    expect(blocks[0]?.type).toBe("callout");
  });
});

// ========================
// markdown/renderer.ts coverage
// ========================
describe("blocksToMarkdown (renderer) coverage", () => {
  it("renders heading_1", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "heading_1",
      heading_1: { rich_text: [{ type: "text", text: { content: "H1" }, plain_text: "H1", href: null }] },
    }];
    expect(blocksToMd(blocks)).toBe("# H1");
  });

  it("renders heading_3", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "heading_3",
      heading_3: { rich_text: [{ type: "text", text: { content: "H3" }, plain_text: "H3", href: null }] },
    }];
    expect(blocksToMd(blocks)).toBe("### H3");
  });

  it("renders numbered_list_item with children", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "numbered_list_item",
      numbered_list_item: {
        rich_text: [{ type: "text", text: { content: "item" }, plain_text: "item", href: null }],
        children: [{ object: "block", type: "divider", divider: {} }],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain("1. item");
    expect(md).toContain("---");
  });

  it("renders to_do checked", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "to_do",
      to_do: {
        rich_text: [{ type: "text", text: { content: "task" }, plain_text: "task", href: null }],
        checked: true,
      },
    }];
    expect(blocksToMd(blocks)).toBe("- [x] task");
  });

  it("renders to_do unchecked with children", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "to_do",
      to_do: {
        rich_text: [{ type: "text", text: { content: "task" }, plain_text: "task", href: null }],
        checked: false,
        children: [{ object: "block", type: "divider", divider: {} }],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain("- [ ] task");
  });

  it("renders toggle", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "toggle",
      toggle: {
        rich_text: [{ type: "text", text: { content: "My toggle" }, plain_text: "My toggle", href: null }],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain("<details>");
    expect(md).toContain("My toggle");
    expect(md).toContain("</details>");
  });

  it("renders quote with multiline", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "quote",
      quote: {
        rich_text: [{ type: "text", text: { content: "Line 1\nLine 2" }, plain_text: "Line 1\nLine 2", href: null }],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain("> Line 1");
    expect(md).toContain("> Line 2");
  });

  it("renders callout with icon and color", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "callout",
      callout: {
        rich_text: [{ type: "text", text: { content: "Callout text" }, plain_text: "Callout text", href: null }],
        icon: { type: "emoji", emoji: "💡" },
        color: "blue" as any,
        children: [{ object: "block", type: "divider", divider: {} }],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain("::: callout");
    expect(md).toContain("[icon=💡]");
    expect(md).toContain('color="blue"');
  });

  it("renders callout without icon or color", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "callout",
      callout: {
        rich_text: [{ type: "text", text: { content: "Plain callout" }, plain_text: "Plain callout", href: null }],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain("::: callout\nPlain callout");
  });

  it("renders code block", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "code",
      code: {
        rich_text: [{ type: "text", text: { content: "const x = 1" }, plain_text: "const x = 1", href: null }],
        language: "typescript",
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain("```typescript");
    expect(md).toContain("const x = 1");
  });

  it("renders image with file url", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "image",
      image: {
        type: "file",
        file: { url: "https://example.com/hosted.png", expiry_time: "2030-01-01" },
        caption: [],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain("https://example.com/hosted.png");
  });

  it("renders file with file url and caption", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "file",
      file: {
        type: "file",
        file: { url: "https://example.com/doc.pdf", expiry_time: "2030-01-01" },
        caption: [{ type: "text", text: { content: "My file" }, plain_text: "My file", href: null }],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain('<file src="https://example.com/doc.pdf"');
    expect(md).toContain('caption="My file"');
  });

  it("renders video with file url and caption", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "video",
      video: {
        type: "file",
        file: { url: "https://example.com/vid.mp4", expiry_time: "2030-01-01" },
        caption: [{ type: "text", text: { content: "My video" }, plain_text: "My video", href: null }],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain('<video src="');
    expect(md).toContain('caption="My video"');
  });

  it("renders audio with file url and caption", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "audio",
      audio: {
        type: "file",
        file: { url: "https://example.com/sound.mp3", expiry_time: "2030-01-01" },
        caption: [{ type: "text", text: { content: "My audio" }, plain_text: "My audio", href: null }],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain('<audio src="');
    expect(md).toContain('caption="My audio"');
  });

  it("renders pdf with file url and caption", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "pdf",
      pdf: {
        type: "file",
        file: { url: "https://example.com/doc.pdf", expiry_time: "2030-01-01" },
        caption: [{ type: "text", text: { content: "My pdf" }, plain_text: "My pdf", href: null }],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain('<pdf src="');
    expect(md).toContain('caption="My pdf"');
  });

  it("renders bookmark with caption", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "bookmark",
      bookmark: {
        url: "https://example.com",
        caption: [{ type: "text", text: { content: "My bookmark" }, plain_text: "My bookmark", href: null }],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain('<bookmark src="https://example.com"');
    expect(md).toContain('caption="My bookmark"');
  });

  it("renders embed with caption", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "embed",
      embed: {
        url: "https://example.com/embed",
        caption: [{ type: "text", text: { content: "My embed" }, plain_text: "My embed", href: null }],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain('<embed src="https://example.com/embed"');
    expect(md).toContain('caption="My embed"');
  });

  it("renders child_page with url", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "child_page",
      child_page: { title: "Sub Page", url: "https://notion.so/sub" },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain('<page title="Sub Page"');
    expect(md).toContain('url="https://notion.so/sub"');
  });

  it("renders child_page without url", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "child_page",
      child_page: { title: "Sub Page" },
    }];
    const md = blocksToMd(blocks);
    expect(md).toBe('<page title="Sub Page" />');
  });

  it("renders child_database with url", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "child_database",
      child_database: { title: "My DB", url: "https://notion.so/db" },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain('<database title="My DB"');
    expect(md).toContain('url="https://notion.so/db"');
  });

  it("renders child_database without url", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "child_database",
      child_database: { title: "My DB" },
    }];
    const md = blocksToMd(blocks);
    expect(md).toBe('<database title="My DB" />');
  });

  it("renders synced_block", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "synced_block",
      synced_block: {
        children: [{ object: "block", type: "divider", divider: {} }],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain("<synced_block>");
    expect(md).toContain("</synced_block>");
  });

  it("renders table_of_contents", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "table_of_contents", table_of_contents: {},
    }];
    expect(blocksToMd(blocks)).toBe("<table_of_contents/>");
  });

  it("renders unsupported block with original_type", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "unsupported",
      unsupported: {},
      original_type: "custom_block",
    } as any];
    const md = blocksToMd(blocks);
    expect(md).toContain('type="custom_block"');
  });

  it("renders unsupported block without original_type", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "unsupported",
      unsupported: {},
    } as any];
    const md = blocksToMd(blocks);
    expect(md).toContain('type="unsupported"');
  });

  it("renders paragraph with children", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: "text" }, plain_text: "text", href: null }],
        children: [{ object: "block", type: "divider", divider: {} }],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain("text");
    expect(md).toContain("---");
  });

  it("renders bulleted_list_item with children", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "bulleted_list_item",
      bulleted_list_item: {
        rich_text: [{ type: "text", text: { content: "item" }, plain_text: "item", href: null }],
        children: [{ object: "block", type: "divider", divider: {} }],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain("- item");
    expect(md).toContain("---");
  });

  it("renders equation", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "equation",
      equation: { expression: "E=mc^2" },
    }];
    expect(blocksToMd(blocks)).toBe("$$ E=mc^2 $$");
  });

  it("returns empty string for empty blocks array", () => {
    expect(blocksToMd([])).toBe("");
  });

  it("renders code block with no language (undefined)", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "code",
      code: {
        rich_text: [{ type: "text", text: { content: "code" }, plain_text: "code", href: null }],
        language: undefined as any,
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain("```");
  });

  it("renders image with external url", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "image",
      image: {
        type: "external",
        external: { url: "https://example.com/img.png" },
        caption: [],
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain("https://example.com/img.png");
  });

  it("renders image with no caption (undefined)", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "image",
      image: {
        type: "external",
        external: { url: "https://example.com/img.png" },
      } as any,
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain("https://example.com/img.png");
  });

  it("renders synced_block with no children (undefined)", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "synced_block",
      synced_block: {},
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain("<synced_block>");
    expect(md).toContain("</synced_block>");
  });

  it("renders file with external url and no caption", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "file",
      file: {
        type: "external",
        external: { url: "https://example.com/doc.pdf" },
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain('<file src="https://example.com/doc.pdf"');
    expect(md).not.toContain("caption");
  });

  it("renders video with external url and no caption", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "video",
      video: {
        type: "external",
        external: { url: "https://example.com/vid.mp4" },
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain('<video src="https://example.com/vid.mp4"');
    expect(md).not.toContain("caption");
  });

  it("renders audio with external url and no caption", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "audio",
      audio: {
        type: "external",
        external: { url: "https://example.com/sound.mp3" },
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain('<audio src="https://example.com/sound.mp3"');
    expect(md).not.toContain("caption");
  });

  it("renders pdf with external url and no caption", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "pdf",
      pdf: {
        type: "external",
        external: { url: "https://example.com/doc.pdf" },
      },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain('<pdf src="https://example.com/doc.pdf"');
    expect(md).not.toContain("caption");
  });

  it("renders bookmark with no caption", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "bookmark",
      bookmark: { url: "https://example.com" },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain('<bookmark src="https://example.com"');
    expect(md).not.toContain("caption");
  });

  it("renders embed with no caption", () => {
    const blocks: NotionBlock[] = [{
      object: "block", type: "embed",
      embed: { url: "https://example.com/embed" },
    }];
    const md = blocksToMd(blocks);
    expect(md).toContain('<embed src="https://example.com/embed"');
    expect(md).not.toContain("caption");
  });
});

// ========================
// NotionClient additional coverage
// ========================
describe("NotionClient additional coverage", () => {
  it("archivePage with archived=false", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({ id: "page-123", url: "https://notion.so/page-123" })
    );
    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    await client.archivePage("page-123", false);

    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.archived).toBe(false);
  });

  it("markdownToBlocks method on instance", () => {
    const client = new NotionClient({ apiToken: "test-token" });
    const blocks = client.markdownToBlocks("# Hello");
    expect(blocks[0]?.type).toBe("heading_1");
  });

  it("blocksToMarkdown method on instance", () => {
    const client = new NotionClient({ apiToken: "test-token" });
    const blocks: NotionBlock[] = [{ object: "block", type: "divider", divider: {} }];
    const md = client.blocksToMarkdown(blocks);
    expect(md).toBe("---");
  });

  it("NotionClient.buildSectionBlocks static method", () => {
    const blocks = NotionClient.buildSectionBlocks("My Section", "Body content here");
    expect(blocks[0]?.type).toBe("heading_2");
    expect(blocks[1]?.type).toBe("paragraph");
  });

  it("createPage with page draft using string markdown content triggers block conversion", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ id: "page-1", url: "" }))
      .mockResolvedValue(makeJsonResponse({ results: [] }));

    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    // page draft with content string on database parent -> legacy path
    await client.createPage({
      parent: notionParent.database("db-123"),
      title: "My Page",
      content: "# Hello World",
    });

    expect(mockFetch).toHaveBeenCalled();
  });

  it("createPage with database parent and string content uses block conversion", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ id: "page-2", url: "" }))
      .mockResolvedValue(makeJsonResponse({ results: [] }));

    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    // database_id + string content -> block conversion path
    await client.createPage(
      notionParent.database("db-123"),
      { Name: notionProperty.title("Title") },
      "# Heading\n\nBody text"
    );

    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.children).toBeDefined();
    expect(body.children[0]?.type).toBe("heading_1");
  });

  it("createPage page draft with content+blocks throws", async () => {
    const client = new NotionClient({ apiToken: "test-token" });
    await expect(
      client.createPage({
        parent: notionParent.page("p-1"),
        content: "# text",
        blocks: [{ object: "block", type: "divider", divider: {} }],
      })
    ).rejects.toThrow("Provide either content or blocks");
  });

  it("createPage with propertiesOrContent as renderable (no content arg)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeJsonResponse({ id: "page-3", url: "" }));
    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    await client.createPage(
      notionParent.page("parent-123"),
      { toMarkdown: () => "# Renderable" } as any
    );

    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.markdown).toBe("# Renderable");
  });

  it("createPage with array as second arg (content)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeJsonResponse({ id: "page-4", url: "" }));
    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    const blocks: NotionBlock[] = [{ object: "block", type: "divider", divider: {} }];
    await client.createPage(notionParent.page("parent-123"), blocks as any);

    expect(mockFetch).toHaveBeenCalled();
  });

  it("createPageMarkdown uses markdown endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({ id: "page-md", url: "https://notion.so/page-md" })
    );
    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    await client.createPageMarkdown(
      notionParent.page("parent-123"),
      "# Hello\n\nBody text",
      { Name: notionProperty.title("My Page") }
    );

    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.markdown).toBe("# Hello\n\nBody text");
  });

  it("getPageMeta uses modern API version", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        id: "page-123",
        url: "https://notion.so/page-123",
        properties: {},
        object: "page",
      })
    );
    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    const meta = await client.getPageMeta("page-123");
    expect(meta.id).toBe("page-123");
    expect(mockFetch.mock.calls[0]?.[1]?.headers?.["Notion-Version"]).toBe("2025-09-03");
  });

  it("getPageBlocks delegates to retrieveBlockChildren", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({ object: "list", has_more: false, next_cursor: null, results: [] })
    );
    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    const blocks = await client.getPageBlocks("page-123");
    expect(blocks).toEqual([]);
  });

  it("updatePageMarkdown normalizes legacy page response", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        object: "page",
        id: "page-123",
        markdown: "# Updated content",
        truncated: false,
        unknown_block_ids: [],
      })
    );
    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    const result = await client.updatePageMarkdown("page-123", {
      type: "insert_content",
      insert_content: { content: "# New content" },
    });

    expect(result.object).toBe("page_markdown");
    expect(result.markdown).toBe("# Updated content");
  });

  it("readPage with fallbackToBlocks=false does not fall back", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(makeJsonResponse({ message: "Unsupported version for markdown" }, 400));
    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    await expect(
      client.readPage("page-123", { fallbackToBlocks: false })
    ).rejects.toThrow("Notion API error 400");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("replacePageMarkdown with empty markdown uses insert_content", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "page",
          id: "page-123",
          url: "https://notion.so/page-123",
          properties: {},
          markdown: "",
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "page_markdown",
          id: "page-123",
          markdown: "# New content",
          truncated: false,
          unknown_block_ids: [],
        })
      );
    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    await client.replacePageMarkdown("page-123", "# New content");

    const patchBody = JSON.parse(String(mockFetch.mock.calls[1]?.[1]?.body));
    expect(patchBody.type).toBe("insert_content");
  });

  it("replacePageMarkdown with contentRange option", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "page_markdown",
          id: "page-123",
          markdown: "# Replaced",
          truncated: false,
          unknown_block_ids: [],
        })
      );
    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    await client.updatePage("page-123", "# New content", {
      replace: true,
      contentRange: "# Start...# End",
    });

    const patchBody = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(patchBody.type).toBe("replace_content_range");
    expect(patchBody.replace_content_range.content_range).toBe("# Start...# End");
  });

  it("updatePage with after option", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        object: "page_markdown",
        id: "page-123",
        markdown: "# Some content",
        truncated: false,
        unknown_block_ids: [],
      })
    );
    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    await client.appendPageMarkdown("page-123", "## Added section", { after: "block-id" });

    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.insert_content.after).toBe("block-id");
  });

  it("readPage with includeTranscript option", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        object: "page",
        id: "page-123",
        url: "https://notion.so/page-123",
        properties: {},
        markdown: "# Content",
        truncated: false,
        unknown_block_ids: [],
      })
    );
    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    await client.readPage("page-123", { includeTranscript: true });
    expect(mockFetch.mock.calls[0]?.[0]).toContain("include_transcript=true");
  });

  it("getActivityFeed throws when since > until", async () => {
    const client = new NotionClient({ apiToken: "test-token" });
    const since = new Date("2026-03-12T12:00:00Z");
    const until = new Date("2026-03-12T11:00:00Z");

    await expect(
      client.getActivityFeed({ since, until })
    ).rejects.toThrow("`since` must be before or equal to `until`");
  });

  it("getActivityFeed with limit=0 returns empty", async () => {
    const client = new NotionClient({ apiToken: "test-token" });
    const result = await client.getActivityFeed({ limit: 0 });
    expect(result).toEqual([]);
  });

  it("getActivityFeed with both include flags false returns empty", async () => {
    const client = new NotionClient({ apiToken: "test-token" });
    const result = await client.getActivityFeed({ includePages: false, includeComments: false });
    expect(result).toEqual([]);
  });

  it("getActivityFeed filters pages with NaN lastEdited and future pages", async () => {
    const now = Date.now();
    const recentTime = new Date(now - 10 * 1000).toISOString();
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        object: "list",
        has_more: false,
        next_cursor: null,
        results: [
          {
            object: "page", id: "page-bad", url: "",
            last_edited_time: "not-a-date",
            created_time: recentTime,
            properties: { Name: { type: "title", title: [{ type: "text", text: { content: "Bad" } }] } },
          },
          {
            object: "page", id: "page-future", url: "",
            last_edited_time: new Date(now + 10000).toISOString(),
            created_time: recentTime,
            properties: { Name: { type: "title", title: [{ type: "text", text: { content: "Future" } }] } },
          },
        ],
      })
    );
    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    const results = await client.getActivityFeed({ since: new Date(now - 60 * 1000) });
    expect(results.filter(r => r.kind === "page")).toHaveLength(0);
  });

  it("getActivityFeed with includeComments=false skips comment fetching", async () => {
    const now = Date.now();
    const recentTime = new Date(now - 5 * 1000).toISOString();
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        object: "list",
        has_more: false,
        next_cursor: null,
        results: [
          {
            object: "page", id: "page-1", url: "",
            last_edited_time: recentTime, created_time: recentTime,
            properties: { Name: { type: "title", title: [{ type: "text", text: { content: "P1" } }] } },
          },
        ],
      })
    );
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });

    const results = await client.getActivityFeed({
      since: new Date(now - 60 * 1000),
      includeComments: false,
    });
    expect(results.every(r => r.kind === "page")).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("getActivityFeed skips comments with null eventTime", async () => {
    const now = Date.now();
    const recentTime = new Date(now - 5 * 1000).toISOString();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "list", has_more: false, next_cursor: null,
          results: [
            {
              object: "page", id: "page-1", url: "",
              last_edited_time: recentTime, created_time: recentTime,
              properties: { Name: { type: "title", title: [{ type: "text", text: { content: "P1" } }] } },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "list", has_more: false, next_cursor: null,
          results: [
            {
              object: "comment", id: "c-null",
              parent: { type: "page_id", page_id: "page-1" },
            },
          ],
        })
      );

    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const results = await client.getActivityFeed({ since: new Date(now - 60 * 1000), includePages: false });
    expect(results.filter(r => r.kind === "comment")).toHaveLength(0);
  });

  it("getActivityFeed skips comments with NaN timestamp", async () => {
    const now = Date.now();
    const recentTime = new Date(now - 5 * 1000).toISOString();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "list", has_more: false, next_cursor: null,
          results: [
            {
              object: "page", id: "page-1", url: "",
              last_edited_time: recentTime, created_time: recentTime,
              properties: { Name: { type: "title", title: [{ type: "text", text: { content: "P1" } }] } },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "list", has_more: false, next_cursor: null,
          results: [
            {
              object: "comment", id: "c-bad",
              parent: { type: "page_id", page_id: "page-1" },
              created_time: "not-a-date",
              last_edited_time: "not-a-date",
            },
          ],
        })
      );

    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const results = await client.getActivityFeed({ since: new Date(now - 60 * 1000) });
    expect(results.filter(r => r.kind === "comment")).toHaveLength(0);
  });

  it("getActivityFeed sort tie-breaking uses eventId", async () => {
    const now = Date.now();
    const sameTime = new Date(now - 5 * 1000).toISOString();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "list", has_more: false, next_cursor: null,
          results: [
            {
              object: "page", id: "page-a", url: "", last_edited_time: sameTime, created_time: sameTime,
              properties: { Name: { type: "title", title: [{ type: "text", text: { content: "A" } }] } },
            },
            {
              object: "page", id: "page-b", url: "", last_edited_time: sameTime, created_time: sameTime,
              properties: { Name: { type: "title", title: [{ type: "text", text: { content: "B" } }] } },
            },
          ],
        })
      )
      .mockResolvedValue(makeJsonResponse({ object: "list", has_more: false, next_cursor: null, results: [] }));

    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const results = await client.getActivityFeed({ since: new Date(now - 60 * 1000) });
    const pageResults = results.filter(r => r.kind === "page");
    expect(pageResults).toHaveLength(2);
    expect(pageResults[0]!.eventId < pageResults[1]!.eventId).toBe(true);
  });

  it("listComments with limit stops early", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        object: "list", has_more: false, next_cursor: null,
        results: [
          { object: "comment", id: "c1", parent: { type: "page_id", page_id: "p1" }, created_time: "2026-01-01", last_edited_time: "2026-01-01" },
          { object: "comment", id: "c2", parent: { type: "page_id", page_id: "p1" }, created_time: "2026-01-02", last_edited_time: "2026-01-02" },
          { object: "comment", id: "c3", parent: { type: "page_id", page_id: "p1" }, created_time: "2026-01-03", last_edited_time: "2026-01-03" },
        ],
      })
    );
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });

    const comments = await client.listComments("p1", { limit: 2 });
    expect(comments).toHaveLength(2);
  });

  it("searchPages stops at limit", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        object: "list", has_more: true, next_cursor: "cursor",
        results: [
          { object: "page", id: "p1", url: "", properties: { Name: { type: "title", title: [{ type: "text", text: { content: "P1" } }] } } },
          { object: "page", id: "p2", url: "", properties: { Name: { type: "title", title: [{ type: "text", text: { content: "P2" } }] } } },
        ],
      })
    );
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });

    const results = await client.searchPages("", { limit: 1 });
    expect(results).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("getRecentlyModified skips pages with null lastEdited", async () => {
    const now = Date.now();
    const recentTime = new Date(now - 5 * 60 * 1000).toISOString();
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        object: "list", has_more: false, next_cursor: null,
        results: [
          {
            object: "page", id: "no-edit", url: "",
            last_edited_time: null, created_time: recentTime,
            properties: { Name: { type: "title", title: [{ type: "text", text: { content: "No Edit" } }] } },
          },
          {
            object: "page", id: "has-edit", url: "",
            last_edited_time: recentTime, created_time: recentTime,
            properties: { Name: { type: "title", title: [{ type: "text", text: { content: "With Edit" } }] } },
          },
        ],
      })
    );
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const results = await client.getRecentlyModified();
    expect(results.some(p => p.id === "no-edit")).toBe(false);
    expect(results.some(p => p.id === "has-edit")).toBe(true);
  });

  it("retrieveBlockChildren with pagination", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({ object: "list", has_more: true, next_cursor: "cursor-2",
          results: [{ object: "block", id: "b1", type: "paragraph", paragraph: { rich_text: [] } }] })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({ object: "list", has_more: false, next_cursor: null,
          results: [{ object: "block", id: "b2", type: "paragraph", paragraph: { rich_text: [] } }] })
      );
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });

    const blocks = await client.retrieveBlockChildren("page-123");
    expect(blocks).toHaveLength(2);
  });

  it("retrieveBlockChildren attaches children to various block types", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({ object: "list", has_more: false, next_cursor: null,
          results: [
            { object: "block", id: "b1", type: "bulleted_list_item", has_children: true, bulleted_list_item: { rich_text: [] } },
          ] })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({ object: "list", has_more: false, next_cursor: null,
          results: [{ object: "block", id: "inner", type: "paragraph", paragraph: { rich_text: [] } }] })
      );
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const blocks = await client.retrieveBlockChildren("page-123", { recursive: true });
    expect(blocks[0]?.type).toBe("bulleted_list_item");
  });

  it("retrieveBlockChildren attaches children to numbered_list_item", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ object: "list", has_more: false, next_cursor: null,
        results: [{ object: "block", id: "b1", type: "numbered_list_item", has_children: true, numbered_list_item: { rich_text: [] } }] }))
      .mockResolvedValueOnce(makeJsonResponse({ object: "list", has_more: false, next_cursor: null, results: [] }));
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    await client.retrieveBlockChildren("page-123", { recursive: true });
  });

  it("retrieveBlockChildren attaches children to to_do", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ object: "list", has_more: false, next_cursor: null,
        results: [{ object: "block", id: "b1", type: "to_do", has_children: true, to_do: { rich_text: [], checked: false } }] }))
      .mockResolvedValueOnce(makeJsonResponse({ object: "list", has_more: false, next_cursor: null, results: [] }));
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    await client.retrieveBlockChildren("page-123", { recursive: true });
  });

  it("retrieveBlockChildren attaches children to quote", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ object: "list", has_more: false, next_cursor: null,
        results: [{ object: "block", id: "b1", type: "quote", has_children: true, quote: { rich_text: [] } }] }))
      .mockResolvedValueOnce(makeJsonResponse({ object: "list", has_more: false, next_cursor: null, results: [] }));
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    await client.retrieveBlockChildren("page-123", { recursive: true });
  });

  it("retrieveBlockChildren attaches children to callout", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ object: "list", has_more: false, next_cursor: null,
        results: [{ object: "block", id: "b1", type: "callout", has_children: true, callout: { rich_text: [] } }] }))
      .mockResolvedValueOnce(makeJsonResponse({ object: "list", has_more: false, next_cursor: null, results: [] }));
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    await client.retrieveBlockChildren("page-123", { recursive: true });
  });

  it("retrieveBlockChildren attaches children to synced_block", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ object: "list", has_more: false, next_cursor: null,
        results: [{ object: "block", id: "b1", type: "synced_block", has_children: true, synced_block: {} }] }))
      .mockResolvedValueOnce(makeJsonResponse({ object: "list", has_more: false, next_cursor: null, results: [] }));
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    await client.retrieveBlockChildren("page-123", { recursive: true });
  });

  it("retrieveBlockChildren attaches children to paragraph", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ object: "list", has_more: false, next_cursor: null,
        results: [{ object: "block", id: "b1", type: "paragraph", has_children: true, paragraph: { rich_text: [] } }] }))
      .mockResolvedValueOnce(makeJsonResponse({ object: "list", has_more: false, next_cursor: null, results: [] }));
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const blocks = await client.retrieveBlockChildren("page-123", { recursive: true });
    expect(blocks[0]?.type).toBe("paragraph");
  });

  it("retrieveBlockChildren default block type with children (no attachment)", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ object: "list", has_more: false, next_cursor: null,
        results: [{ object: "block", id: "b1", type: "divider", has_children: true, divider: {} }] }))
      .mockResolvedValueOnce(makeJsonResponse({ object: "list", has_more: false, next_cursor: null, results: [] }));
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const blocks = await client.retrieveBlockChildren("page-123", { recursive: true });
    expect(blocks[0]?.type).toBe("divider");
  });

  it("BaseNotionClient returns empty object for empty response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve("   "),
    } as Response);
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    await client.appendBlocks("page-123", []);
  });

  it("NotionApiError stores status and body", () => {
    const err = new NotionApiError(404, "Page not found");
    expect(err.status).toBe(404);
    expect(err.body).toBe("Page not found");
    expect(err.name).toBe("NotionApiError");
    expect(err instanceof NotionApiError).toBe(true);
  });

  it("createPage draft without title uses only properties", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeJsonResponse({ id: "page-no-title", url: "" }));
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });

    // Draft with NO title - covers the `title !== undefined ? ... : {}` false branch
    await client.createPage({
      parent: notionParent.database("db-123"),
      properties: { Name: notionProperty.title("Via Properties") },
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("createPage draft with content (no blocks) calls toPageBody", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeJsonResponse({ id: "page-content", url: "" }));
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });

    // Draft with content string and no explicit blocks - covers `blocks ?? toPageBody(content)` right side
    await client.createPage({
      parent: notionParent.database("db-123"),
      title: "Content Page",
      content: "Some body text",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.children).toBeDefined();
  });

  it("NotionClient with explicit apiVersion uses it", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({ id: "page-123", url: "" })
    );
    const client = new NotionClient({
      apiToken: "test-token",
      apiVersion: "2022-06-28" as any,
      fetchImpl: mockFetch as typeof fetch,
    });
    await client.archivePage("page-123");
    // Request was made (no error thrown)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("getActivityFeed throws on invalid since string", async () => {
    const client = new NotionClient({ apiToken: "test-token" });
    await expect(
      client.getActivityFeed({ since: "not-a-date" })
    ).rejects.toThrow("Invalid since time");
  });

  it("getActivityFeed throws on invalid until string", async () => {
    const client = new NotionClient({ apiToken: "test-token" });
    await expect(
      client.getActivityFeed({ until: "not-a-date" })
    ).rejects.toThrow("Invalid until time");
  });

  it("createPage with >100 blocks triggers appendBlocks for remaining (direct call)", async () => {
    // Create 101 blocks to exceed MAX_BLOCKS_PER_REQUEST=100
    const blocks: NotionBlock[] = Array.from({ length: 101 }, () => ({
      object: "block" as const,
      type: "divider" as const,
      divider: {},
    }));
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ id: "page-big", url: "" }))
      .mockResolvedValueOnce(makeJsonResponse({})); // appendBlocks call

    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    await client.createPage(
      notionParent.database("db-123"),
      { Name: notionProperty.title("Title") },
      blocks
    );

    // First call: create page with first 100 blocks
    // Second call: append remaining 1 block
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const appendBody = JSON.parse(String(mockFetch.mock.calls[1]?.[1]?.body));
    expect(appendBody.children).toHaveLength(1);
  });

  it("createPage draft with >100 blocks triggers line 123 appendBlocks lambda", async () => {
    // Create 101 blocks to exceed MAX_BLOCKS_PER_REQUEST=100 via page draft path (line 123)
    const blocks: NotionBlock[] = Array.from({ length: 101 }, () => ({
      object: "block" as const,
      type: "divider" as const,
      divider: {},
    }));
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ id: "page-draft-big", url: "" }))
      .mockResolvedValueOnce(makeJsonResponse({})); // appendBlocks call

    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    // Use the page DRAFT form to hit line 123
    await client.createPage({
      parent: notionParent.database("db-123"),
      title: "Big Page",
      blocks,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    const appendBody = JSON.parse(String(mockFetch.mock.calls[1]?.[1]?.body));
    expect(appendBody.children).toHaveLength(1);
  });

  it("retrieveBlockChildren with has_more=true but null next_cursor stops loop", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "list",
          has_more: true,
          next_cursor: null,
          results: [{ object: "block", id: "b1", type: "divider", divider: {} }],
        })
      );
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const blocks = await client.retrieveBlockChildren("page-123");
    expect(blocks).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("searchPages with has_more=true but null next_cursor stops loop", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        object: "list",
        has_more: true,
        next_cursor: null,
        results: [
          { object: "page", id: "p1", url: "", properties: {} },
        ],
      })
    );
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const results = await client.searchPages("test");
    expect(results).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("readPage uses content field as fallback for markdown", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        object: "page",
        id: "page-123",
        url: "https://notion.so/page-123",
        properties: {},
        content: "# Fallback content",
        // no markdown, no truncated, no unknown_block_ids
      })
    );
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const result = await client.readPage("page-123");
    expect(result.markdown).toBe("# Fallback content");
    expect(result.truncated).toBe(false);
    expect(result.unknownBlockIds).toEqual([]);
  });

  it("readPage with neither markdown nor content returns empty string", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        object: "page",
        id: "page-123",
        url: "https://notion.so/page-123",
        properties: {},
        // no markdown, no content
      })
    );
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const result = await client.readPage("page-123");
    expect(result.markdown).toBe("");
  });

  it("readPage falls back to blocks on content_format error", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({ message: "content_format is invalid" }, 400)
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "page",
          id: "page-123",
          url: "https://notion.so/page-123",
          properties: {},
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({ object: "list", has_more: false, next_cursor: null, results: [] })
      );

    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const result = await client.readPage("page-123");
    expect(result.markdown).toBe("");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("updatePageMarkdown normalizes legacy response with content field and no truncated/unknown_block_ids", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        object: "page",
        id: "page-123",
        content: "# Content from content field",
        // no truncated, no unknown_block_ids
      })
    );
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const result = await client.updatePageMarkdown("page-123", {
      type: "insert_content",
      insert_content: { content: "new" },
    });
    expect(result.markdown).toBe("# Content from content field");
    expect(result.truncated).toBe(false);
    expect(result.unknown_block_ids).toEqual([]);
  });

  it("updatePageMarkdown normalizes legacy response with neither markdown nor content", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        object: "page",
        id: "page-123",
        // no markdown, no content, no truncated, no unknown_block_ids
      })
    );
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const result = await client.updatePageMarkdown("page-123", {
      type: "insert_content",
      insert_content: { content: "new" },
    });
    expect(result.markdown).toBe("");
    expect(result.truncated).toBe(false);
    expect(result.unknown_block_ids).toEqual([]);
  });

  it("BaseNotionClient handles empty body response from actual request", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(""),
    } as Response);
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    // appendBlocks with non-empty blocks calls request
    const block: NotionBlock = { object: "block", type: "divider", divider: {} };
    await client.appendBlocks("page-123", [block]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
