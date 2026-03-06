import { afterEach, describe, expect, it, vi } from "vitest";

import { LaunchCursorAgentInputSchema } from "../src/schemas.js";
import { CursorCloudClient } from "../src/CursorCloudClient.js";
import type { FetchLike } from "../src/types.js";

function basicAuth(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

const originalApiKey = process.env.CURSOR_API_KEY;

function jsonResponse(body: unknown, status = 200): Response {
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

  it("select().prompt() uses CURSOR_API_KEY and sends expected payload", async () => {
    process.env.CURSOR_API_KEY = "env-key";
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ id: "agent-1", status: "queued" }))
      .mockResolvedValueOnce(
        jsonResponse({ id: "agent-1", status: "completed" })
      );

    const client = new CursorCloudClient({ fetchImpl });
    const final = await client.select("owner/repo").prompt("Fix lint errors");

    expect(final.id).toBe("agent-1");
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      "https://api.cursor.com/v0/agents",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: basicAuth("env-key"),
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

  it("session is thenable and can be awaited", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ id: "agent-2", status: "queued" }))
      .mockResolvedValueOnce(jsonResponse({ id: "agent-2", status: "running" }))
      .mockResolvedValueOnce(
        jsonResponse({ id: "agent-2", status: "completed" })
      );
    const sleepFn = vi.fn(async () => undefined);

    const client = new CursorCloudClient({
      apiKey: "test-key",
      fetchImpl,
      sleepFn,
      pollIntervalMs: 1,
      timeoutMs: 5_000,
    });

    const session = client.select("owner/repo").prompt("Fix failing tests");

    const resultViaThen = await session.then((result) => result);
    expect(resultViaThen.status).toBe("completed");

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenCalledTimes(1);
  });

  it("reply is chainable and sends followups in order", async () => {
    const callOrder: string[] = [];
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockImplementation(async (url, init) => {
        const urlStr = typeof url === "string" ? url : String(url);
        if (urlStr.endsWith("/v0/agents")) {
          return jsonResponse({ id: "agent-3", status: "queued" });
        }
        if (urlStr.endsWith("/stop")) {
          callOrder.push("stop");
          return jsonResponse({});
        }
        if (urlStr.endsWith("/followup")) {
          const body = JSON.parse(
            (init?.body as string | undefined) ?? "{}"
          ) as {
            prompt?: string;
          };
          callOrder.push(`followup:${body.prompt ?? ""}`);
          return jsonResponse({});
        }
        return jsonResponse({ id: "agent-3", status: "completed" });
      });

    const client = new CursorCloudClient({
      apiKey: "test-key",
      fetchImpl,
    });

    await client
      .select("owner/repo")
      .prompt("Initial")
      .reply("Message A")
      .reply("Message B");

    expect(callOrder).toEqual(["followup:Message A", "followup:Message B"]);
  });

  it("session methods use launch id", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ id: "agent-4", status: "queued" })) // launch
      .mockResolvedValueOnce(jsonResponse({ id: "agent-4", status: "running" })) // status()
      .mockResolvedValueOnce(jsonResponse({})) // stop()
      .mockResolvedValueOnce(
        jsonResponse({ id: "agent-4", status: "completed" })
      ); // await agent.stop() thenable resolution

    const client = new CursorCloudClient({ apiKey: "test-key", fetchImpl });
    const session = client.select("owner/repo").prompt("Do work");

    const status = await session.status();
    expect(status.id).toBe("agent-4");

    await session.stop();
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      "https://api.cursor.com/v0/agents/agent-4/stop",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("uses default webhook from createCursorCloud options", async () => {
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ id: "agent-8", status: "queued" }))
      .mockResolvedValueOnce(
        jsonResponse({ id: "agent-8", status: "completed" })
      );

    const client = new CursorCloudClient({
      apiKey: "test-key",
      fetchImpl,
      webhook: { url: "https://example.com/hook", secret: "abc123" },
    });

    await client.select("owner/repo").prompt("Run pipeline");

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as {
      webhook: { url: string; secret: string };
    };
    expect(body.webhook.url).toBe("https://example.com/hook");
    expect(body.webhook.secret).toBe("abc123");
  });

  it("listAgents accepts repo filter and maps to repository query", async () => {
    const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
      jsonResponse({
        agents: [
          { id: "agent-5", status: "running", repository: "owner/repo" },
        ],
        total: 1,
        hasMore: false,
      })
    );
    const client = new CursorCloudClient({ apiKey: "test-key", fetchImpl });

    const result = await client.listAgents({ repo: "owner/repo", limit: 10 });
    expect(result.total).toBe(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.cursor.com/v0/agents?limit=10&repository=owner%2Frepo",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("validates launch schema with repo field", () => {
    expect(() =>
      LaunchCursorAgentInputSchema.parse({
        prompt: "Valid prompt",
        repo: "owner/repo",
      })
    ).not.toThrow();

    expect(() =>
      LaunchCursorAgentInputSchema.parse({
        prompt: "Valid prompt",
        repository: "owner/repo",
      })
    ).toThrow();
  });
});
