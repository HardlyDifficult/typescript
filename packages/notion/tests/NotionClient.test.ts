import { describe, expect, it, vi } from "vitest";

import { NotionClient } from "../src/NotionClient.js";

function makeFetch(
  status: number,
  body: unknown
): (input: string, init?: RequestInit) => Promise<Response> {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(JSON.stringify(body)),
  });
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
    it("sends correct request and returns page ID and URL", async () => {
      const mockFetch = makeFetch(200, {
        id: "page-abc",
        url: "https://notion.so/page-abc",
      });
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

    it("throws on non-2xx response", async () => {
      const mockFetch = makeFetch(400, { message: "Invalid database ID" });
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

  describe("buildTranscriptBlocks", () => {
    it("returns a heading block and paragraph blocks", () => {
      const blocks = NotionClient.buildTranscriptBlocks("Hello world");
      expect(blocks).toHaveLength(2);
      expect(blocks[0]?.type).toBe("heading_2");
      expect(blocks[1]?.type).toBe("paragraph");
    });

    it("splits long transcripts into multiple paragraph blocks", () => {
      const longText = "a".repeat(5000);
      const blocks = NotionClient.buildTranscriptBlocks(longText);
      // 1 heading + 3 paragraphs (2000 + 2000 + 1000)
      expect(blocks).toHaveLength(4);
      expect(blocks[0]?.type).toBe("heading_2");
    });
  });
});
