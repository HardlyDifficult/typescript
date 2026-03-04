import { afterEach, describe, expect, it, vi } from "vitest";

import { CursorCloudClient } from "../src/CursorCloudClient.js";
import type { FetchLike } from "../src/types.js";
import { LaunchCursorAgentInputSchema } from "../src/schemas.js";

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

    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ id: "agent-1", status: "queued" }));

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
    const fetchImpl = vi
      .fn<FetchLike>()
      .mockResolvedValueOnce(jsonResponse({ id: "agent-2", status: "queued" }));

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
        jsonResponse({
          id: "agent-3",
          status: "completed",
          pullRequestUrl: "https://example.com/pr/1",
        })
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

  describe("validation", () => {
    it("validates launch input and throws descriptive errors", async () => {
      const client = new CursorCloudClient({ apiKey: "test-key" });

      await expect(
        client.launch({ prompt: "", repository: "owner/repo" })
      ).rejects.toThrow("Launch input validation failed: prompt: Prompt cannot be empty");

      await expect(
        client.launch({ prompt: "Fix bugs", repository: "" })
      ).rejects.toThrow("Launch input validation failed: repository: Repository cannot be empty");
    });

    it("validates agent ID in status calls", async () => {
      const client = new CursorCloudClient({ apiKey: "test-key" });

      await expect(client.status("")).rejects.toThrow(
        "Agent ID validation failed: : Agent ID cannot be empty"
      );
    });

    it("validates schemas directly", () => {
      expect(() =>
        LaunchCursorAgentInputSchema.parse({
          prompt: "Valid prompt",
          repository: "owner/repo",
        })
      ).not.toThrow();

      expect(() =>
        LaunchCursorAgentInputSchema.parse({
          prompt: "",
          repository: "owner/repo",
        })
      ).toThrow();
    });
  });

  describe("listAgents", () => {
    it("lists agents with query parameters", async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(
          jsonResponse({
            agents: [
              { id: "agent-1", status: "running", repository: "owner/repo1" },
              { id: "agent-2", status: "completed", repository: "owner/repo2" },
            ],
            total: 2,
            hasMore: false,
          })
        );

      const client = new CursorCloudClient({
        apiKey: "test-key",
        fetchImpl,
      });

      const result = await client.listAgents({
        repository: "owner/repo",
        limit: 10,
        status: "running",
      });

      expect(result.agents).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.hasMore).toBe(false);
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.cursor.com/v0/agents?repository=owner%2Frepo&status=running&limit=10",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("handles empty query parameters", async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(
          jsonResponse({
            agents: [],
            total: 0,
            hasMore: false,
          })
        );

      const client = new CursorCloudClient({
        apiKey: "test-key",
        fetchImpl,
      });

      const result = await client.listAgents();

      expect(result.agents).toHaveLength(0);
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.cursor.com/v0/agents",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  describe("cancelAgent", () => {
    it("cancels an agent with optional reason", async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(
          jsonResponse({
            id: "agent-1",
            status: "cancelled",
            cancelledAt: "2026-03-04T01:00:00.000Z",
          })
        );

      const client = new CursorCloudClient({
        apiKey: "test-key",
        fetchImpl,
      });

      const result = await client.cancelAgent("agent-1", {
        reason: "User requested cancellation",
      });

      expect(result.id).toBe("agent-1");
      expect(result.status).toBe("cancelled");
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.cursor.com/v0/agents/agent-1/cancel",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason: "User requested cancellation" }),
        })
      );
    });

    it("cancels agent without reason", async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(
          jsonResponse({
            id: "agent-1",
            status: "cancelled",
            cancelledAt: "2026-03-04T01:00:00.000Z",
          })
        );

      const client = new CursorCloudClient({
        apiKey: "test-key",
        fetchImpl,
      });

      const result = await client.cancelAgent("agent-1");

      expect(result.id).toBe("agent-1");
      expect(result.status).toBe("cancelled");
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.cursor.com/v0/agents/agent-1/cancel",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({}),
        })
      );
    });
  });

  describe("updateAgent", () => {
    it("updates agent metadata and priority", async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(
          jsonResponse({
            id: "agent-1",
            status: "running",
            priority: "high",
            metadata: { project: "important" },
          })
        );

      const client = new CursorCloudClient({
        apiKey: "test-key",
        fetchImpl,
      });

      const result = await client.updateAgent("agent-1", {
        priority: "high",
        metadata: { project: "important" },
      });

      expect(result.id).toBe("agent-1");
      expect(result.status).toBe("running");
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.cursor.com/v0/agents/agent-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            priority: "high",
            metadata: { project: "important" },
          }),
        })
      );
    });
  });

  describe("getAgentLogs", () => {
    it("retrieves agent logs with query parameters", async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(
          jsonResponse({
            logs: [
              {
                timestamp: "2026-03-04T01:00:00.000Z",
                level: "info",
                message: "Agent started",
              },
              {
                timestamp: "2026-03-04T01:01:00.000Z",
                level: "error",
                message: "Error occurred",
                context: { file: "test.js" },
              },
            ],
            hasMore: false,
          })
        );

      const client = new CursorCloudClient({
        apiKey: "test-key",
        fetchImpl,
      });

      const result = await client.getAgentLogs("agent-1", {
        limit: 100,
        level: "info",
      });

      expect(result.logs).toHaveLength(2);
      expect(result.hasMore).toBe(false);
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.cursor.com/v0/agents/agent-1/logs?limit=100&level=info",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  describe("deleteAgent", () => {
    it("deletes an agent", async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(
          jsonResponse({
            id: "agent-1",
            deletedAt: "2026-03-04T01:00:00.000Z",
          })
        );

      const client = new CursorCloudClient({
        apiKey: "test-key",
        fetchImpl,
      });

      const result = await client.deleteAgent("agent-1");

      expect(result.id).toBe("agent-1");
      expect(result.deletedAt).toBe("2026-03-04T01:00:00.000Z");
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.cursor.com/v0/agents/agent-1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("CursorCloudRepo chainable methods", () => {
    it("provides chainable repo-scoped operations", async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(
          jsonResponse({
            agents: [{ id: "agent-1", status: "running" }],
            total: 1,
            hasMore: false,
          })
        )
        .mockResolvedValueOnce(
          jsonResponse({
            id: "agent-1",
            status: "cancelled",
            cancelledAt: "2026-03-04T01:00:00.000Z",
          })
        );

      const client = new CursorCloudClient({
        apiKey: "test-key",
        fetchImpl,
      });

      const repo = client.repo("owner/repo");

      // Test list method
      const agents = await repo.list({ status: "running" });
      expect(agents.total).toBe(1);

      // Test cancel method
      const cancelled = await repo.cancel("agent-1");
      expect(cancelled.status).toBe("cancelled");

      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });
  });
});
