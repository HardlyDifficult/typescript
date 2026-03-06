import { describe, expect, it, vi } from "vitest";

import {
  NotionClient,
  blocksToMarkdown,
  markdownToBlocks,
  selectionFromMarkdown,
} from "../src/index.js";

function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

describe("NotionClient", () => {
  describe("constructor", () => {
    it("throws when apiToken is empty", () => {
      expect(() => new NotionClient({ apiToken: "" })).toThrow(
        "Notion API token is required"
      );
    });

    it("accepts a valid apiToken", () => {
      expect(() => new NotionClient({ apiToken: "secret" })).not.toThrow();
    });
  });

  describe("createPage", () => {
    it("sends correct request and returns page ID and URL for a legacy database parent", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeJsonResponse({
          id: "page-abc",
          url: "https://notion.so/page-abc",
        })
      );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      const page = await client.createPage("db-123", {
        Name: { title: [{ type: "text", text: { content: "my-source" } }] },
        Status: { select: { name: "completed" } },
        Date: { date: { start: "2026-03-04T00:00:00Z" } },
      });

      expect(page.id).toBe("page-abc");
      expect(page.url).toBe("https://notion.so/page-abc");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.notion.com/v1/pages",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
            "Notion-Version": "2022-06-28",
          }),
        })
      );
    });

    it("uses the markdown endpoint for modern parents when given markdown content", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeJsonResponse({
          id: "page-modern",
          url: "https://notion.so/page-modern",
        })
      );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      await client.createPage(
        { type: "page_id", page_id: "parent-123" },
        {},
        "# Title\n\nBody"
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.notion.com/v1/pages",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Notion-Version": "2025-09-03",
          }),
          body: JSON.stringify({
            parent: { page_id: "parent-123" },
            properties: {},
            markdown: "# Title\n\nBody",
          }),
        })
      );
    });

    it("creates the page with the first 100 blocks and appends the remainder", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          makeJsonResponse({
            id: "page-abc",
            url: "https://notion.so/page-abc",
          })
        )
        .mockResolvedValueOnce(makeJsonResponse({ results: [] }));

      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      const bodyBlocks = Array.from({ length: 105 }, (_, index) => ({
        object: "block" as const,
        type: "paragraph" as const,
        paragraph: {
          rich_text: [
            {
              type: "text" as const,
              text: { content: `block-${String(index)}` },
            },
          ],
        },
      }));

      await client.createPage(
        "db-123",
        {
          Name: { title: [{ type: "text", text: { content: "my-source" } }] },
        },
        bodyBlocks
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);

      const createCall = mockFetch.mock.calls[0];
      expect(createCall?.[0]).toBe("https://api.notion.com/v1/pages");
      expect(createCall?.[1]?.method).toBe("POST");
      expect(JSON.parse(String(createCall?.[1]?.body)).children).toHaveLength(
        100
      );

      const appendCall = mockFetch.mock.calls[1];
      expect(appendCall?.[0]).toBe(
        "https://api.notion.com/v1/blocks/page-abc/children"
      );
      expect(appendCall?.[1]?.method).toBe("PATCH");
      expect(JSON.parse(String(appendCall?.[1]?.body)).children).toHaveLength(
        5
      );
    });

    it("throws on non-2xx response", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(makeJsonResponse({ message: "Invalid database ID" }, 400));
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      await expect(
        client.createPage("bad-db", {
          Name: { title: [{ type: "text", text: { content: "src" } }] },
        })
      ).rejects.toThrow("Notion API error 400");
    });
  });

  describe("appendBlocks", () => {
    it("batches append requests in groups of 100 blocks", async () => {
      const mockFetch = vi.fn().mockResolvedValue(makeJsonResponse({ results: [] }));
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      const blocks = Array.from({ length: 205 }, (_, index) => ({
        object: "block" as const,
        type: "paragraph" as const,
        paragraph: {
          rich_text: [
            {
              type: "text" as const,
              text: { content: `block-${String(index)}` },
            },
          ],
        },
      }));

      await client.appendBlocks("page-123", blocks);

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(
        JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body)).children
      ).toHaveLength(100);
      expect(
        JSON.parse(String(mockFetch.mock.calls[1]?.[1]?.body)).children
      ).toHaveLength(100);
      expect(
        JSON.parse(String(mockFetch.mock.calls[2]?.[1]?.body)).children
      ).toHaveLength(5);
    });
  });

  describe("page reads and updates", () => {
    it("retrieves a page as markdown and extracts metadata", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeJsonResponse({
          object: "page",
          id: "page-123",
          url: "https://notion.so/page-123",
          last_edited_time: "2026-03-06T12:00:00Z",
          created_time: "2026-03-01T12:00:00Z",
          properties: {
            Name: {
              type: "title",
              title: [{ type: "text", text: { content: "My page" } }],
            },
          },
          markdown: "# My page\n\nBody",
          truncated: false,
          unknown_block_ids: [],
        })
      );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      const page = await client.readPage("page-123");

      expect(page.title).toBe("My page");
      expect(page.markdown).toBe("# My page\n\nBody");
      expect(page.lastEdited).toBe("2026-03-06T12:00:00Z");
      expect(mockFetch.mock.calls[0]?.[0]).toBe(
        "https://api.notion.com/v1/pages/page-123?content_format=markdown"
      );
      expect(mockFetch.mock.calls[0]?.[1]?.headers).toMatchObject({
        "Notion-Version": "2025-09-03",
      });
    });

    it("falls back to block retrieval when markdown retrieval fails", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          makeJsonResponse({ message: "Unsupported version for markdown" }, 400)
        )
        .mockResolvedValueOnce(
          makeJsonResponse({
            object: "page",
            id: "page-123",
            url: "https://notion.so/page-123",
            properties: {
              Name: {
                type: "title",
                title: [{ type: "text", text: { content: "Fallback page" } }],
              },
            },
          })
        )
        .mockResolvedValueOnce(
          makeJsonResponse({
            object: "list",
            has_more: false,
            next_cursor: null,
            results: [
              {
                object: "block",
                id: "block-1",
                type: "paragraph",
                paragraph: {
                  rich_text: [{ type: "text", text: { content: "Fallback body" } }],
                },
              },
            ],
          })
        );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      const page = await client.readPage("page-123", { fallbackToBlocks: true });

      expect(page.title).toBe("Fallback page");
      expect(page.markdown).toContain("Fallback body");
    });

    it("updates page content in replace mode by deriving a content range", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          makeJsonResponse({
            object: "page",
            id: "page-123",
            url: "https://notion.so/page-123",
            properties: {
              Name: {
                type: "title",
                title: [{ type: "text", text: { content: "My page" } }],
              },
            },
            markdown:
              "# Replace me\n\nThis is the body we want to fully replace.",
          })
        )
        .mockResolvedValueOnce(
          makeJsonResponse({
            object: "page_markdown",
            id: "page-123",
            markdown: "# New title\n\nReplacement body",
            truncated: false,
            unknown_block_ids: [],
          })
        );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      await client.updatePage("page-123", "# New title\n\nReplacement body", {
        replace: true,
      });

      const patchCall = mockFetch.mock.calls[1];
      expect(patchCall?.[0]).toBe(
        "https://api.notion.com/v1/pages/page-123/markdown"
      );
      expect(JSON.parse(String(patchCall?.[1]?.body))).toEqual({
        type: "replace_content_range",
        replace_content_range: {
          content: "# New title\n\nReplacement body",
          content_range: selectionFromMarkdown(
            "# Replace me\n\nThis is the body we want to fully replace."
          ),
        },
      });
    });

    it("updates page properties", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeJsonResponse({
          object: "page",
          id: "page-123",
          url: "https://notion.so/page-123",
        })
      );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      await client.updatePageProperties("page-123", {
        Status: { status: { name: "Done" } },
        Score: { number: 42 },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.notion.com/v1/pages/page-123",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            properties: {
              Status: { status: { name: "Done" } },
              Score: { number: 42 },
            },
          }),
        })
      );
    });
  });

  describe("search and block traversal", () => {
    it("searches pages and respects the result limit across pages", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          makeJsonResponse({
            object: "list",
            has_more: true,
            next_cursor: "cursor-2",
            results: [
              {
                object: "page",
                id: "page-1",
                url: "https://notion.so/page-1",
                properties: {
                  Name: {
                    type: "title",
                    title: [{ type: "text", text: { content: "First" } }],
                  },
                },
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
                object: "page",
                id: "page-2",
                url: "https://notion.so/page-2",
                properties: {
                  Name: {
                    type: "title",
                    title: [{ type: "text", text: { content: "Second" } }],
                  },
                },
              },
            ],
          })
        );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      const results = await client.searchPages("page", { limit: 2 });

      expect(results.map((result) => result.title)).toEqual(["First", "Second"]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("retrieves nested block children recursively", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          makeJsonResponse({
            object: "list",
            has_more: false,
            next_cursor: null,
            results: [
              {
                object: "block",
                id: "toggle-1",
                type: "toggle",
                has_children: true,
                toggle: {
                  rich_text: [{ type: "text", text: { content: "More" } }],
                },
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
                object: "block",
                id: "para-1",
                type: "paragraph",
                paragraph: {
                  rich_text: [{ type: "text", text: { content: "Nested body" } }],
                },
              },
            ],
          })
        );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      const blocks = await client.retrieveBlockChildren("page-123", {
        recursive: true,
      });

      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.type).toBe("toggle");
      expect(blocks[0]?.type === "toggle" && blocks[0].toggle.children).toHaveLength(1);
    });
  });

  describe("markdown conversion", () => {
    it("parses markdown into richer block types", () => {
      const blocks = markdownToBlocks(
        [
          "# Heading",
          "",
          "- item one",
          "  - nested item",
          "- [x] done",
          "",
          "> quoted",
          "",
          "```ts",
          "const value = 1;",
          "```",
          "",
          "![caption](https://example.com/image.png)",
        ].join("\n")
      );

      expect(blocks[0]?.type).toBe("heading_1");
      expect(blocks[1]?.type).toBe("bulleted_list_item");
      expect(blocks[2]?.type).toBe("to_do");
      expect(blocks[3]?.type).toBe("quote");
      expect(blocks[4]?.type).toBe("code");
      expect(blocks[5]?.type).toBe("image");
    });

    it("renders blocks back to markdown", () => {
      const markdown = blocksToMarkdown(
        markdownToBlocks(
          [
            "## Section",
            "",
            "Paragraph with **bold** text and a [link](https://example.com).",
            "",
            "- first",
            "- second",
          ].join("\n")
        )
      );

      expect(markdown).toContain("## Section");
      expect(markdown).toContain("**bold**");
      expect(markdown).toContain("[link](https://example.com)");
      expect(markdown).toContain("- first");
      expect(markdown).toContain("- second");
    });

    it("builds a replacement selection from existing markdown", () => {
      const selection = selectionFromMarkdown(
        "# Heading\n\nBody text that is long enough to produce an ellipsis range."
      );

      expect(selection).toContain("...");
    });
  });
});
