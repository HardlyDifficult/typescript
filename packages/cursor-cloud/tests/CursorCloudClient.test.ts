import { afterEach, describe, expect, it, vi } from "vitest";

import { CursorCloudClient } from "../src/CursorCloudClient.js";
import type { FetchLike } from "../src/types.js";

const originalApiKey = process.env.CURSOR_API_KEY;

function jsonResponse(body: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.CURSOR_API_KEY;
  } else {
    process.env.CURSOR_API_KEY = originalApiKey;
  }
});

describe("CursorCloudClient", () => {
  it("throws when API key is missing", () => {
    delete process.env.CURSOR_API_KEY;
    expect(() => new CursorCloudClient()).toThrow("Cursor API key is required");
  });

  it("uses CURSOR_API_KEY from env and launches an agent", async () => {
    process.env.CURSOR_API_KEY = "env-key";

    const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
      jsonResponse({ id: "agent-1", status: "queued" })
    );

    const client = new CursorCloudClient({ fetchImpl });
    const launch = await client.repo("owner/repo").launch("Fix lint errors");

    expect(launch.id).toBe("agent-1");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.cursor.com/v0/agents",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer env-key",
          "Content-Type": "application/json",
        }),
      })
    );

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      prompt: { text: string };
      source: { repository: string; branch: string };
    };
    expect(body.prompt.text).toBe("Fix lint errors");
    expect(body.source.repository).toBe("owner/repo");
    expect(body.source.branch).toBe("main");
  });

  it("supports chainable branch/model overrides", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
      jsonResponse({ id: "agent-2", status: "queued" })
    );

    const client = new CursorCloudClient({
      apiKey: "test-key",
      defaultModel: "claude-4-sonnet",
      fetchImpl,
    });

    await client
      .repo("owner/repo")
      .branch("develop")
      .model("cursor-small")
      .launch("Refactor the parser");

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      model?: string;
      source: { branch: string };
    };

    expect(body.model).toBe("cursor-small");
    expect(body.source.branch).toBe("develop");
  });

  it("run launches then polls until terminal status", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ id: "agent-3", status: "queued" }))
      .mockResolvedValueOnce(jsonResponse({ id: "agent-3", status: "running" }))
      .mockResolvedValueOnce(
        jsonResponse({ id: "agent-3", status: "completed", pullRequestUrl: "https://example.com/pr/1" })
      );

    const sleepFn = vi.fn(async () => undefined);

    const client = new CursorCloudClient({
      apiKey: "test-key",
      fetchImpl,
      sleepFn,
      pollIntervalMs: 1,
      timeoutMs: 5_000,
    });

    const result = await client.repo("owner/repo").run("Fix failing tests");

    expect(result.agentId).toBe("agent-3");
    expect(result.final.status).toBe("completed");
    expect(result.final.pullRequestUrl).toBe("https://example.com/pr/1");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenCalledTimes(1);
  });
});
