import { afterEach, describe, expect, it, vi } from "vitest";

import { CursorCloudClient } from "../src/CursorCloudClient.js";
import type { FetchLike } from "../src/types.js";
import { LaunchCursorAgentInputSchema } from "../src/schemas.js";

function basicAuth(apiKey: string): string {
  return `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`;
}

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
    it("validates launch/createAgent input and throws descriptive errors", async () => {
      const client = new CursorCloudClient({ apiKey: "test-key" });

      await expect(
        client.launch({ prompt: "", repository: "owner/repo" })
      ).rejects.toThrow("prompt: Prompt cannot be empty");

      await expect(
        client.createAgent({ prompt: "Fix bugs", repository: "" })
      ).rejects.toThrow("repository: Repository cannot be empty");
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
      const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
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
      const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
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

    it("hides archived agents by default", async () => {
      const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
        jsonResponse({
          agents: [
            { id: "agent-1", status: "running", repository: "owner/repo1" },
            { id: "agent-2", status: "archived", repository: "owner/repo1" },
            { id: "agent-3", status: "completed", repository: "owner/repo1" },
          ],
          total: 3,
          hasMore: false,
        })
      );

      const client = new CursorCloudClient({
        apiKey: "test-key",
        fetchImpl,
      });

      const result = await client.listAgents();

      expect(result.agents).toHaveLength(2);
      expect(result.agents.map((agent) => agent.id)).toEqual([
        "agent-1",
        "agent-3",
      ]);
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.cursor.com/v0/agents",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("returns archived agents when explicitly requested via includeArchived", async () => {
      const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
        jsonResponse({
          agents: [
            { id: "agent-1", status: "running", repository: "owner/repo1" },
            { id: "agent-2", status: "archived", repository: "owner/repo1" },
          ],
          total: 2,
          hasMore: false,
        })
      );

      const client = new CursorCloudClient({
        apiKey: "test-key",
        fetchImpl,
      });

      const result = await client.listAgents({ includeArchived: true });

      expect(result.agents).toHaveLength(2);
      expect(result.agents.map((agent) => agent.id)).toEqual([
        "agent-1",
        "agent-2",
      ]);
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.cursor.com/v0/agents",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("returns archived agents when status is explicitly set to archived", async () => {
      const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
        jsonResponse({
          agents: [
            { id: "agent-2", status: "archived", repository: "owner/repo1" },
          ],
          total: 1,
          hasMore: false,
        })
      );

      const client = new CursorCloudClient({
        apiKey: "test-key",
        fetchImpl,
      });

      const result = await client.listAgents({ status: "archived" });

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].id).toBe("agent-2");
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.cursor.com/v0/agents?status=archived",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  describe("cancelAgent", () => {
    it("cancels an agent with optional reason", async () => {
      const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
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
      const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
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
      const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
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
      const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
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
      const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
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

  describe("createAgent", () => {
    it("creates an agent and passes through all params", async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(
          jsonResponse({ id: "agent-5", status: "queued" })
        );

      const client = new CursorCloudClient({ apiKey: "test-key", fetchImpl });

      const result = await client.createAgent({
        prompt: "Add dark mode",
        repository: "owner/repo",
        branch: "feature/dark-mode",
        model: "cursor-small",
      });

      expect(result.id).toBe("agent-5");
      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as {
        prompt: { text: string };
        source: { repository: string; branch: string };
        model: string;
      };
      expect(body.prompt.text).toBe("Add dark mode");
      expect(body.source.repository).toBe("owner/repo");
      expect(body.source.branch).toBe("feature/dark-mode");
      expect(body.model).toBe("cursor-small");
    });

    it("includes webhook in the request when provided", async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(
          jsonResponse({ id: "agent-6", status: "queued" })
        );

      const client = new CursorCloudClient({ apiKey: "test-key", fetchImpl });

      await client.createAgent({
        prompt: "Run pipeline",
        repository: "owner/repo",
        webhook: { url: "https://example.com/hook", secret: "s3cr3t" },
      });

      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(init.body as string) as {
        webhook: { url: string; secret: string };
      };
      expect(body.webhook.url).toBe("https://example.com/hook");
      expect(body.webhook.secret).toBe("s3cr3t");
    });

    it("uses Basic auth header", async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(
          jsonResponse({ id: "agent-7", status: "queued" })
        );

      const client = new CursorCloudClient({ apiKey: "my-api-key", fetchImpl });
      await client.createAgent({
        prompt: "Do something",
        repository: "org/repo",
      });

      const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
      const headers = init.headers as Record<string, string>;
      expect(headers["Authorization"]).toBe(basicAuth("my-api-key"));
    });
  });

  describe("getAgent", () => {
    it("returns agent status and metadata", async () => {
      const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
        jsonResponse({
          id: "agent-1",
          status: "running",
          model: "cursor-small",
          gitBranch: "fix/bug",
        })
      );

      const client = new CursorCloudClient({ apiKey: "test-key", fetchImpl });
      const agent = await client.getAgent("agent-1");

      expect(agent.id).toBe("agent-1");
      expect(agent.status).toBe("running");
      expect(agent.model).toBe("cursor-small");
      expect(agent.gitBranch).toBe("fix/bug");
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.cursor.com/v0/agents/agent-1",
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  describe("getConversation", () => {
    it("retrieves conversation history for an agent", async () => {
      const fetchImpl = vi.fn<FetchLike>().mockResolvedValueOnce(
        jsonResponse({
          messages: [
            { role: "user", content: "Fix the bug" },
            { role: "assistant", content: "I found the issue..." },
          ],
        })
      );

      const client = new CursorCloudClient({ apiKey: "test-key", fetchImpl });
      const result = await client.getConversation("agent-1");

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0].role).toBe("user");
      expect(result.messages[0].content).toBe("Fix the bug");
      expect(result.messages[1].role).toBe("assistant");
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.cursor.com/v0/agents/agent-1/conversation",
        expect.objectContaining({ method: "GET" })
      );
    });

    it("validates agent ID for getConversation", async () => {
      const client = new CursorCloudClient({ apiKey: "test-key" });
      await expect(client.getConversation("")).rejects.toThrow(
        "Agent ID validation failed"
      );
    });
  });

  describe("followup", () => {
    it("sends a followup instruction to an agent", async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(jsonResponse({}));

      const client = new CursorCloudClient({ apiKey: "test-key", fetchImpl });
      await client.followup("agent-1", "Also add unit tests");

      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.cursor.com/v0/agents/agent-1/followup",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ prompt: "Also add unit tests" }),
        })
      );
    });

    it("validates that followup prompt is non-empty", async () => {
      const client = new CursorCloudClient({ apiKey: "test-key" });
      await expect(client.followup("agent-1", "")).rejects.toThrow(
        "Followup prompt validation failed"
      );
    });
  });

  describe("stop", () => {
    it("sends a stop request for an agent", async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(jsonResponse({}));

      const client = new CursorCloudClient({ apiKey: "test-key", fetchImpl });
      await client.stop("agent-1");

      expect(fetchImpl).toHaveBeenCalledWith(
        "https://api.cursor.com/v0/agents/agent-1/stop",
        expect.objectContaining({ method: "POST" })
      );
    });

    it("validates agent ID for stop", async () => {
      const client = new CursorCloudClient({ apiKey: "test-key" });
      await expect(client.stop("")).rejects.toThrow(
        "Agent ID validation failed"
      );
    });
  });

  describe("interrupt", () => {
    it("calls stop before followup", async () => {
      const callOrder: string[] = [];

      const fetchImpl = vi.fn<FetchLike>().mockImplementation(async (url) => {
        const urlStr = typeof url === "string" ? url : String(url);
        if (urlStr.endsWith("/stop")) {
          callOrder.push("stop");
        } else if (urlStr.endsWith("/followup")) {
          callOrder.push("followup");
        }
        return jsonResponse({});
      });

      const client = new CursorCloudClient({ apiKey: "test-key", fetchImpl });
      await client.interrupt("agent-1", "Focus on the auth module instead");

      expect(callOrder).toEqual(["stop", "followup"]);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("sends the correct prompt in the followup after stop", async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(jsonResponse({})) // stop
        .mockResolvedValueOnce(jsonResponse({})); // followup

      const client = new CursorCloudClient({ apiKey: "test-key", fetchImpl });
      await client.interrupt("agent-42", "Rewrite in Rust");

      const [stopUrl] = fetchImpl.mock.calls[0] as [string, RequestInit];
      expect(stopUrl).toBe("https://api.cursor.com/v0/agents/agent-42/stop");

      const [followupUrl, followupInit] = fetchImpl.mock.calls[1] as [
        string,
        RequestInit,
      ];
      expect(followupUrl).toBe(
        "https://api.cursor.com/v0/agents/agent-42/followup"
      );
      const body = JSON.parse(followupInit.body as string) as {
        prompt: string;
      };
      expect(body.prompt).toBe("Rewrite in Rust");
    });

    it("validates agent ID for interrupt", async () => {
      const client = new CursorCloudClient({ apiKey: "test-key" });
      await expect(client.interrupt("", "Do something")).rejects.toThrow(
        "Agent ID validation failed"
      );
    });

    it("validates prompt for interrupt", async () => {
      const fetchImpl = vi
        .fn<FetchLike>()
        .mockResolvedValueOnce(jsonResponse({})); // stop succeeds

      const client = new CursorCloudClient({ apiKey: "test-key", fetchImpl });
      await expect(client.interrupt("agent-1", "")).rejects.toThrow(
        "Followup prompt validation failed"
      );
    });
  });
});
