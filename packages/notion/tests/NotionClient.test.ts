import { describe, expect, it, vi } from "vitest";

import {
  NotionClient,
  blocksToMarkdown,
  markdownToBlocks,
  notionParent,
  notionProperty,
  selectionFromMarkdown,
} from "../src/index.js";

function makeJsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

function makeMarkdownDoc(markdown: string) {
  return {
    toMarkdown: () => markdown,
  };
}

describe("NotionClient", () => {
  describe("builders", () => {
    it("builds clean parent and property payloads", () => {
      const createdAt = new Date("2026-03-04T12:00:00.000Z");

      expect(notionParent.database("db-123")).toEqual({
        type: "database_id",
        database_id: "db-123",
      });
      expect(notionParent.page("page-123")).toEqual({
        type: "page_id",
        page_id: "page-123",
      });
      expect(notionParent.workspace()).toEqual({
        type: "workspace",
        workspace: true,
      });

      expect(notionProperty.title("My page")).toEqual({
        title: [{ type: "text", text: { content: "My page" } }],
      });
      expect(notionProperty.status("Done")).toEqual({
        status: { name: "Done" },
      });
      expect(notionProperty.date(createdAt)).toEqual({
        date: { start: "2026-03-04T12:00:00.000Z" },
      });
      expect(notionProperty.multiSelect("alpha", "beta")).toEqual({
        multi_select: [{ name: "alpha" }, { name: "beta" }],
      });
    });

    it("rejects blank required builder inputs", () => {
      expect(() => notionParent.database("   ")).toThrow(
        "databaseId is required"
      );
      expect(() => notionProperty.status("   ")).toThrow(
        "status name is required"
      );
    });
  });

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
    it("accepts a page draft with plain property values and markdown renderables", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeJsonResponse({
          id: "page-draft",
          url: "https://notion.so/page-draft",
        })
      );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      await client.createPage({
        parent: notionParent.page("parent-123"),
        title: "Q2 Launch Plan",
        properties: {
          Status: notionProperty.status("In Progress"),
          Score: 42,
          Notes: "Created from the SDK",
          Tags: ["launch", "marketing"],
          DueDate: new Date("2026-03-20T00:00:00.000Z"),
        },
        content: makeMarkdownDoc("# Goals\n\n- Lock scope\n- Launch cleanly"),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.notion.com/v1/pages",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Notion-Version": "2025-09-03",
          }),
          body: JSON.stringify({
            parent: { page_id: "parent-123" },
            properties: {
              Name: {
                title: [{ type: "text", text: { content: "Q2 Launch Plan" } }],
              },
              Status: { status: { name: "In Progress" } },
              Score: { number: 42 },
              Notes: {
                rich_text: [
                  { type: "text", text: { content: "Created from the SDK" } },
                ],
              },
              Tags: {
                multi_select: [{ name: "launch" }, { name: "marketing" }],
              },
              DueDate: {
                date: { start: "2026-03-20T00:00:00.000Z" },
              },
            },
            markdown: "# Goals\n\n- Lock scope\n- Launch cleanly",
          }),
        })
      );
    });

    it("accepts content as the second argument when no properties are needed", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeJsonResponse({
          id: "page-content-only",
          url: "https://notion.so/page-content-only",
        })
      );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      await client.createPage(
        notionParent.page("parent-123"),
        "# Planning Notes\n\n- Draft agenda"
      );

      expect(JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body))).toEqual({
        parent: { page_id: "parent-123" },
        properties: {},
        markdown: "# Planning Notes\n\n- Draft agenda",
      });
    });

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

      const page = await client.createPage(notionParent.database("db-123"), {
        Name: notionProperty.title("my-source"),
        Status: notionProperty.select("completed"),
        Date: notionProperty.date("2026-03-04T00:00:00Z"),
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
        notionParent.page("parent-123"),
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
        notionParent.database("db-123"),
        {
          Name: notionProperty.title("my-source"),
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
        .mockResolvedValue(
          makeJsonResponse({ message: "Invalid database ID" }, 400)
        );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      await expect(
        client.createPage(notionParent.database("bad-db"), {
          Name: notionProperty.title("src"),
        })
      ).rejects.toThrow("Notion API error 400");
    });

    it("rejects page drafts that set the title twice", async () => {
      const client = new NotionClient({ apiToken: "test-token" });

      await expect(
        client.createPage({
          parent: notionParent.database("db-123"),
          title: "Launch Plan",
          properties: {
            Name: notionProperty.title("Duplicate title"),
          },
        })
      ).rejects.toThrow('Notion page draft sets title twice');
    });
  });

  describe("appendBlocks", () => {
    it("batches append requests in groups of 100 blocks", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValue(makeJsonResponse({ results: [] }));
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

    it("falls back to block retrieval by default when markdown retrieval is unsupported", async () => {
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
                  rich_text: [
                    { type: "text", text: { content: "Fallback body" } },
                  ],
                },
              },
            ],
          })
        );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      const page = await client.readPage("page-123");

      expect(page.title).toBe("Fallback page");
      expect(page.markdown).toContain("Fallback body");
    });

    it("does not hide non-markdown read failures behind block fallback", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeJsonResponse({ message: "Unauthorized" }, 401)
      );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      await expect(client.readPage("page-123")).rejects.toThrow(
        "Notion API error 401"
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("replaces page content in replace mode by deriving a content range", async () => {
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

      await client.replacePageMarkdown(
        "page-123",
        "# New title\n\nReplacement body"
      );

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

    it("appends page markdown without requiring update flags", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeJsonResponse({
          object: "page_markdown",
          id: "page-123",
          markdown: "## Follow-up\n\nAdded from the API.",
          truncated: false,
          unknown_block_ids: [],
        })
      );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      await client.appendPageMarkdown(
        "page-123",
        "## Follow-up\n\nAdded from the API."
      );

      expect(JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body))).toEqual({
        type: "insert_content",
        insert_content: {
          content: "## Follow-up\n\nAdded from the API.",
        },
      });
    });

    it("accepts markdown renderables when appending page markdown", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeJsonResponse({
          object: "page_markdown",
          id: "page-123",
          markdown: "## Follow-up\n\nAdded from a document builder.",
          truncated: false,
          unknown_block_ids: [],
        })
      );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      await client.appendPageMarkdown(
        "page-123",
        makeMarkdownDoc("## Follow-up\n\nAdded from a document builder.")
      );

      expect(JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body))).toEqual({
        type: "insert_content",
        insert_content: {
          content: "## Follow-up\n\nAdded from a document builder.",
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
        Status: notionProperty.status("Done"),
        Score: 42,
        Notes: "Clear owner handoff",
        Tags: ["ops", "launch"],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.notion.com/v1/pages/page-123",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            properties: {
              Status: { status: { name: "Done" } },
              Score: { number: 42 },
              Notes: {
                rich_text: [
                  { type: "text", text: { content: "Clear owner handoff" } },
                ],
              },
              Tags: { multi_select: [{ name: "ops" }, { name: "launch" }] },
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

      expect(results.map((result) => result.title)).toEqual([
        "First",
        "Second",
      ]);
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
                  rich_text: [
                    { type: "text", text: { content: "Nested body" } },
                  ],
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
      expect(
        blocks[0]?.type === "toggle" && blocks[0].toggle.children
      ).toHaveLength(1);
    });
  });

  describe("getRecentlyModified", () => {
    it("returns only pages edited within the time window", async () => {
      const now = Date.now();
      const recentTime = new Date(now - 30 * 60 * 1000).toISOString(); // 30 min ago
      const oldTime = new Date(now - 120 * 60 * 1000).toISOString(); // 2 hours ago

      const mockFetch = vi.fn().mockResolvedValue(
        makeJsonResponse({
          object: "list",
          has_more: false,
          next_cursor: null,
          results: [
            {
              object: "page",
              id: "recent-page",
              url: "https://notion.so/recent-page",
              last_edited_time: recentTime,
              created_time: recentTime,
              properties: {
                Name: {
                  type: "title",
                  title: [{ type: "text", text: { content: "Recent" } }],
                },
              },
            },
            {
              object: "page",
              id: "old-page",
              url: "https://notion.so/old-page",
              last_edited_time: oldTime,
              created_time: oldTime,
              properties: {
                Name: {
                  type: "title",
                  title: [{ type: "text", text: { content: "Old" } }],
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

      const results = await client.getRecentlyModified({
        sinceMinutesAgo: 60,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.title).toBe("Recent");

      // Verify sort was requested
      const body = JSON.parse(String(mockFetch.mock.calls[0]?.[1]?.body));
      expect(body.sort).toEqual({
        direction: "descending",
        timestamp: "last_edited_time",
      });
    });

    it("respects the limit option", async () => {
      const now = Date.now();
      const recentTime = new Date(now - 5 * 60 * 1000).toISOString();

      const mockFetch = vi.fn().mockResolvedValue(
        makeJsonResponse({
          object: "list",
          has_more: false,
          next_cursor: null,
          results: Array.from({ length: 10 }, (_, i) => ({
            object: "page",
            id: `page-${String(i)}`,
            url: `https://notion.so/page-${String(i)}`,
            last_edited_time: recentTime,
            created_time: recentTime,
            properties: {
              Name: {
                type: "title",
                title: [
                  { type: "text", text: { content: `Page ${String(i)}` } },
                ],
              },
            },
          })),
        })
      );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      const results = await client.getRecentlyModified({ limit: 3 });

      expect(results).toHaveLength(3);
    });

    it("uses defaults of 60 minutes and limit 50", async () => {
      const mockFetch = vi.fn().mockResolvedValue(
        makeJsonResponse({
          object: "list",
          has_more: false,
          next_cursor: null,
          results: [],
        })
      );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      const results = await client.getRecentlyModified();

      expect(results).toHaveLength(0);
    });
  });

  describe("activity feed", () => {
    it("lists comments for a block with pagination", async () => {
      const mockFetch = vi
        .fn()
        .mockResolvedValueOnce(
          makeJsonResponse({
            object: "list",
            has_more: true,
            next_cursor: "cursor-2",
            results: [
              {
                object: "comment",
                id: "comment-1",
                parent: { type: "page_id", page_id: "page-1" },
                discussion_id: "discussion-1",
                created_time: "2026-03-07T00:00:00.000Z",
                last_edited_time: "2026-03-07T00:05:00.000Z",
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
                id: "comment-2",
                parent: { type: "page_id", page_id: "page-1" },
                created_time: "2026-03-07T00:10:00.000Z",
                last_edited_time: "2026-03-07T00:11:00.000Z",
              },
            ],
          })
        );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      const comments = await client.listComments("page-1");

      expect(comments).toHaveLength(2);
      expect(comments[0]).toMatchObject({
        id: "comment-1",
        pageId: "page-1",
        discussionId: "discussion-1",
      });
      expect(mockFetch.mock.calls[0]?.[0]).toBe(
        "https://api.notion.com/v1/comments?block_id=page-1"
      );
      expect(mockFetch.mock.calls[1]?.[0]).toBe(
        "https://api.notion.com/v1/comments?block_id=page-1&start_cursor=cursor-2"
      );
    });

    it("builds a page and comment activity timeline with overlap", async () => {
      const now = Date.now();
      const recentTime = new Date(now - 40 * 1000).toISOString();
      const overlapTime = new Date(now - 75 * 1000).toISOString();
      const oldTime = new Date(now - 10 * 60 * 1000).toISOString();

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
                properties: {
                  Name: {
                    type: "title",
                    title: [{ type: "text", text: { content: "Recent page" } }],
                  },
                },
              },
              {
                object: "page",
                id: "page-2",
                url: "https://notion.so/page-2",
                last_edited_time: oldTime,
                created_time: oldTime,
                properties: {
                  Name: {
                    type: "title",
                    title: [{ type: "text", text: { content: "Old page" } }],
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
                object: "comment",
                id: "comment-overlap",
                parent: { type: "page_id", page_id: "page-1" },
                created_time: overlapTime,
                last_edited_time: overlapTime,
              },
              {
                object: "comment",
                id: "comment-old",
                parent: { type: "page_id", page_id: "page-1" },
                created_time: oldTime,
                last_edited_time: oldTime,
              },
            ],
          })
        );
      const client = new NotionClient({
        apiToken: "test-token",
        fetchImpl: mockFetch as typeof fetch,
      });

      const results = await client.getActivityFeed({
        since: new Date(now - 30 * 1000),
        overlapMinutes: 1,
      });

      expect(results).toHaveLength(2);
      expect(results[0]?.kind).toBe("page");
      expect(results[1]).toMatchObject({
        kind: "comment",
        comment: { id: "comment-overlap" },
      });
    });

    it("can return only page events", async () => {
      const now = Date.now();
      const recentTime = new Date(now - 20 * 1000).toISOString();

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
              properties: {
                Name: {
                  type: "title",
                  title: [{ type: "text", text: { content: "Recent page" } }],
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

      const results = await client.getActivityFeed({
        includeComments: false,
      });

      expect(results).toHaveLength(1);
      expect(results[0]?.kind).toBe("page");
      expect(mockFetch).toHaveBeenCalledTimes(1);
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
