import { describe, expect, it, vi } from "vitest";
import { createSocial, createSocialClient } from "../src/index.js";

const originalFetch = globalThis.fetch;

describe("social factories", () => {
  it("creates an X client when configured explicitly", () => {
    const client = createSocialClient({
      type: "x",
      bearerToken: "token",
      userId: "me",
    });

    expect(client).toBeDefined();
  });

  it("createSocial defaults to x", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    globalThis.fetch = fetchMock as typeof fetch;
    process.env.X_BEARER_TOKEN = "token";

    try {
      const client = createSocial();
      await client.timeline();
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/timelines/reverse_chronological"),
        expect.any(Object)
      );
    } finally {
      globalThis.fetch = originalFetch;
      delete process.env.X_BEARER_TOKEN;
    }
  });
});
