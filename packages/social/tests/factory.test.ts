import { afterEach, describe, expect, it, vi } from "vitest";

import * as socialExports from "../src/index.js";
import { createSocial } from "../src/index.js";

const originalFetch = globalThis.fetch;
const originalToken = process.env.X_BEARER_TOKEN;

afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalToken === undefined) {
    delete process.env.X_BEARER_TOKEN;
  } else {
    process.env.X_BEARER_TOKEN = originalToken;
  }
});

describe("social factories", () => {
  it("exports only createSocial at runtime", () => {
    expect(Object.keys(socialExports)).toEqual(["createSocial"]);
  });

  it("uses X_BEARER_TOKEN when token is omitted", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    globalThis.fetch = fetchMock as typeof fetch;
    process.env.X_BEARER_TOKEN = "token-from-env";

    try {
      const client = createSocial();
      await client.timeline();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/timelines/reverse_chronological"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer token-from-env",
          }),
        })
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("accepts a bare token string", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const client = createSocial("token-from-options");
    await client.likes();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/liked_tweets"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-from-options",
        }),
      })
    );
  });

  it("prefers token over X_BEARER_TOKEN", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });

    globalThis.fetch = fetchMock as typeof fetch;
    process.env.X_BEARER_TOKEN = "token-from-env";

    const client = createSocial({ token: "token-from-options" });
    await client.likes();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/liked_tweets"),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer token-from-options",
        }),
      })
    );
  });

  it("throws when no token is configured", () => {
    delete process.env.X_BEARER_TOKEN;

    expect(() => createSocial()).toThrow(
      "X bearer token is required. Set X_BEARER_TOKEN."
    );
  });
});
