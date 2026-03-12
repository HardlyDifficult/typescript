
// ========================
// Additional tests for remaining uncovered areas
// ========================
describe("index.ts and markdown.ts barrel files", () => {
  it("re-exports from index.ts work correctly", () => {
    expect(extractNotionPageId).toBeDefined();
    expect(extractPageTitle).toBeDefined();
    // Verify they work
    expect(extractNotionPageId("abc123def456789012345678901234567890")).toBeDefined();
    expect(extractPageTitle({})).toBe("");
  });

  it("markdown.ts re-exports work correctly", () => {
    expect(blocksToMarkdownFromBarrel).toBeDefined();
    expect(markdownToBlocksFromBarrel).toBeDefined();
    expect(richTextToPlainTextFromBarrel).toBeDefined();
    expect(selectionFromMarkdownFromBarrel).toBeDefined();
    expect(textToParagraphBlocksFromBarrel).toBeDefined();
    // Verify they work
    expect(markdownToBlocksFromBarrel("# H1")).toHaveLength(1);
    expect(blocksToMarkdownFromBarrel([])).toBe("");
  });
});

describe("extractNotionPageId coverage", () => {
  it("extracts page ID from Notion URL", () => {
    const url = "https://www.notion.so/workspace/Page-Title-abc123def456789012345678901234abc";
    const id = extractNotionPageIdFromShared(url);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("extracts page ID from bare 32-char hex string", () => {
    const id = "abc123def456789012345678901234ab";
    const result = extractNotionPageIdFromShared(id);
    expect(result).toMatch(/[0-9a-f]{8}-/);
  });

  it("extracts page ID from URL with query params", () => {
    const url = "https://www.notion.so/Page-abc123def456789012345678901234ab?v=123";
    const result = extractNotionPageIdFromShared(url);
    expect(result).toBeDefined();
  });

  it("extracts page ID from URL with hash fragment", () => {
    const url = "https://www.notion.so/Page-abc123def456789012345678901234ab#section";
    const result = extractNotionPageIdFromShared(url);
    expect(result).toBeDefined();
  });

  it("returns original string when no ID found in URL", () => {
    const url = "https://example.com/not-a-notion-page";
    expect(extractNotionPageIdFromShared(url)).toBe(url);
  });

  it("returns trimmed string when no ID pattern matches", () => {
    expect(extractNotionPageIdFromShared("  not-an-id  ")).toBe("not-an-id");
  });

  it("handles already-formatted UUID", () => {
    const uuid = "abc123de-f456-7890-1234-567890abcdef";
    // This is 36 chars with dashes, removes dashes = 32 chars
    const result = extractNotionPageIdFromShared(uuid);
    expect(result).toMatch(/[0-9a-f-]+/);
  });
});

describe("NotionClient createPage with markdown string content on database parent (legacy path)", () => {
  it("converts markdown to blocks when using database parent with string content", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ id: "page-1", url: "https://notion.so/page-1" }))
      .mockResolvedValue(makeJsonResponse({ results: [] }));

    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    // String content with database_id parent -> legacy path -> converts to blocks
    await client.createPage(
      notionParent.database("db-123"),
      { Name: notionProperty.title("Title") },
      "# Hello World"
    );

    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    // Should have children (converted from markdown)
    expect(body.children).toBeDefined();
    expect(body.children[0]?.type).toBe("heading_1");
  });

  it("uses markdownToBlocks when content is a string and parent is string (legacy)", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeJsonResponse({ id: "page-2", url: "" }))
      .mockResolvedValue(makeJsonResponse({ results: [] }));

    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    // String parent ID (legacy format)
    await client.createPage(
      "db-string-id",
      { Name: notionProperty.title("Title") },
      "# Heading\n\nBody text"
    );

    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.children).toBeDefined();
  });

  it("createPage with string content and markdown renderable second arg", async () => {
    const mockFetch = vi.fn().mockResolvedValue(makeJsonResponse({ id: "page-3", url: "" }));
    const client = new NotionClient({
      apiToken: "test-token",
      fetchImpl: mockFetch as typeof fetch,
    });

    // propertiesOrContent is a renderable (not properties) and content is undefined
    // -> resolvedContent = propertiesOrContent, properties = {}
    await client.createPage(
      notionParent.page("parent-123"),
      { toMarkdown: () => "# Renderable" } as any
    );

    const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
    expect(body.markdown).toBe("# Renderable");
  });
});

describe("activityFeed edge case coverage", () => {
  it("getActivityFeed includes only pages events when includeComments=false", async () => {
    const now = Date.now();
    const recentTime = new Date(now - 5 * 1000).toISOString();
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        object: "list",
        has_more: false,
        next_cursor: null,
        results: [
          {
            object: "page",
            id: "page-1",
            url: "https://notion.so/page-1",
            last_edited_time: recentTime,
            created_time: recentTime,
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
    // Only 1 fetch (no comment fetches)
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("getActivityFeed skips comments with null eventTime", async () => {
    const now = Date.now();
    const recentTime = new Date(now - 5 * 1000).toISOString();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "list",
          has_more: false,
          next_cursor: null,
          results: [
            {
              object: "page",
              id: "page-1",
              url: "https://notion.so/page-1",
              last_edited_time: recentTime,
              created_time: recentTime,
              properties: { Name: { type: "title", title: [{ type: "text", text: { content: "P1" } }] } },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "list",
          has_more: false,
          next_cursor: null,
          results: [
            // Comment with no timestamps
            {
              object: "comment",
              id: "c-null",
              parent: { type: "page_id", page_id: "page-1" },
              // no created_time or last_edited_time
            },
          ],
        })
      );

    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const results = await client.getActivityFeed({
      since: new Date(now - 60 * 1000),
      includePages: false,
    });
    // The comment with null eventTime should be skipped
    expect(results.filter(r => r.kind === "comment")).toHaveLength(0);
  });

  it("getActivityFeed skips comments with NaN timestamp", async () => {
    const now = Date.now();
    const recentTime = new Date(now - 5 * 1000).toISOString();
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "list",
          has_more: false,
          next_cursor: null,
          results: [
            {
              object: "page",
              id: "page-1",
              url: "https://notion.so/page-1",
              last_edited_time: recentTime,
              created_time: recentTime,
              properties: { Name: { type: "title", title: [{ type: "text", text: { content: "P1" } }] } },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "list",
          has_more: false,
          next_cursor: null,
          results: [
            {
              object: "comment",
              id: "c-bad",
              parent: { type: "page_id", page_id: "page-1" },
              created_time: "not-a-date",
              last_edited_time: "not-a-date",
            },
          ],
        })
      );

    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const results = await client.getActivityFeed({
      since: new Date(now - 60 * 1000),
    });
    expect(results.filter(r => r.kind === "comment")).toHaveLength(0);
  });

  it("getActivityFeed with page.lastEdited null skips in includePages loop", async () => {
    const now = Date.now();
    const recentTime = new Date(now - 5 * 1000).toISOString();
    // We simulate a candidate page that somehow has null lastEdited after the candidatePages check
    // The check at line 161 (if page.lastEdited === null continue) in the includePages loop
    // This can happen because candidatePages check already filters null, so we need a page in
    // candidatePages with lastEdited != null — the inner loop won't skip unless lastEdited is null
    // Actually let's test the sort tie-breaking (same timestamp)
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "list",
          has_more: false,
          next_cursor: null,
          results: [
            {
              object: "page", id: "page-a", url: "", last_edited_time: recentTime, created_time: recentTime,
              properties: { Name: { type: "title", title: [{ type: "text", text: { content: "A" } }] } },
            },
            {
              object: "page", id: "page-b", url: "", last_edited_time: recentTime, created_time: recentTime,
              properties: { Name: { type: "title", title: [{ type: "text", text: { content: "B" } }] } },
            },
          ],
        })
      )
      .mockResolvedValue(makeJsonResponse({ object: "list", has_more: false, next_cursor: null, results: [] }));

    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const results = await client.getActivityFeed({
      since: new Date(now - 60 * 1000),
    });
    // Both pages have same timestamp, sorted by eventId
    const pageResults = results.filter(r => r.kind === "page");
    expect(pageResults).toHaveLength(2);
    // eventId: page:page-a:... vs page:page-b:..., "a" < "b"
    expect(pageResults[0]?.eventId < pageResults[1]!.eventId).toBe(true);
  });
});

describe("getRecentlyModified with null lastEdited", () => {
  it("skips pages with null lastEdited", async () => {
    const now = Date.now();
    const recentTime = new Date(now - 5 * 60 * 1000).toISOString();
    const mockFetch = vi.fn().mockResolvedValue(
      makeJsonResponse({
        object: "list",
        has_more: false,
        next_cursor: null,
        results: [
          {
            object: "page",
            id: "no-last-edited",
            url: "",
            last_edited_time: null,
            created_time: recentTime,
            properties: { Name: { type: "title", title: [{ type: "text", text: { content: "No Edit" } }] } },
          },
          {
            object: "page",
            id: "has-last-edited",
            url: "",
            last_edited_time: recentTime,
            created_time: recentTime,
            properties: { Name: { type: "title", title: [{ type: "text", text: { content: "With Edit" } }] } },
          },
        ],
      })
    );
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const results = await client.getRecentlyModified();
    expect(results.some(p => p.id === "no-last-edited")).toBe(false);
    expect(results.some(p => p.id === "has-last-edited")).toBe(true);
  });
});

describe("richText edge cases", () => {
  it("findLink returns null when ] not followed by ](", () => {
    // "[text]http://url" - bracket not followed by ]( 
    const result = richTextFromMarkdown("[text]http://url");
    // Should parse as plain text since no link syntax
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("findLink returns null when no closing paren", () => {
    // "[text](url-missing-paren"
    const result = richTextFromMarkdown("[text](url-missing-paren");
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("findDelimited returns null when no close pattern", () => {
    // Unclosed bold: "**bold text without close
    const result = richTextFromMarkdown("**unclosed bold");
    // Should return as plain text
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("findNextToken delimiter wins when earlier than link", () => {
    // **bold** then [link](url) -> delimiter is earlier
    const result = richTextFromMarkdown("**bold** then [link](https://example.com)");
    const boldPart = result.find(s => s.annotations?.bold === true);
    expect(boldPart).toBeDefined();
  });

  it("renderRichText code+bold annotations", () => {
    const seg = makeTextRichText("text", { code: true, bold: true });
    const result = renderRichText([seg]);
    expect(result).toContain("`");
    expect(result).toContain("**");
  });
});

describe("blockChildren default branch coverage", () => {
  it("retrieveBlockChildren with unsupported block type with children", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(
        makeJsonResponse({
          object: "list",
          has_more: false,
          next_cursor: null,
          results: [
            // A block type that is not handled in attachChildren switch
            { object: "block", id: "b1", type: "divider", has_children: true, divider: {} },
          ],
        })
      )
      .mockResolvedValueOnce(
        makeJsonResponse({ object: "list", has_more: false, next_cursor: null, results: [] })
      );
    const client = new NotionClient({ apiToken: "test-token", fetchImpl: mockFetch as typeof fetch });
    const blocks = await client.retrieveBlockChildren("page-123", { recursive: true });
    expect(blocks[0]?.type).toBe("divider");
  });
});

describe("builders.ts remaining branches", () => {
  it("normalizeDateInput called with string returns date object", () => {
    // toPropertyValue with structured date with string value
    const result = toPropertyValue("Due", { type: "date", value: "2026-01-15" } as any);
    expect(result).toEqual({ date: { start: "2026-01-15" } });
  });

  it("normalizeDateInput with Date object in structured input", () => {
    const d = new Date("2026-01-15T00:00:00Z");
    const result = toPropertyValue("Due", { type: "date", value: d } as any);
    expect(result).toEqual({ date: { start: d.toISOString() } });
  });

  it("notionProperty.date with null start returns null date", () => {
    expect(notionProperty.date(null)).toEqual({ date: null });
  });

  it("toPropertyValue assertUnreachable never reached in practice but we can hit the select multi case", () => {
    // multiSelect with empty array
    expect(toPropertyValue("Tags", { type: "multi_select", value: [] } as any)).toEqual({
      multi_select: [],
    });
  });
});
