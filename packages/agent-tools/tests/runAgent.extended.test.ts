import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getClient } from "../src/server.js";
import { runAgent } from "../src/runAgent.js";

vi.mock("../src/server.js", () => ({
  getClient: vi.fn(),
  shutdownAgentServer: vi.fn(),
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function createMockClient(events: Array<Record<string, unknown>>) {
  return {
    session: {
      create: vi.fn().mockResolvedValue({ id: "session-1" }),
      prompt: vi.fn().mockResolvedValue({}),
      abort: vi.fn().mockResolvedValue(true),
    },
    event: {
      subscribe: vi.fn().mockResolvedValue(createEventStream(events)),
    },
  };
}

function createMockClientWithThrowingSubscribe(events: Array<Record<string, unknown>>) {
  return {
    session: {
      create: vi.fn().mockResolvedValue({ id: "session-1" }),
      prompt: vi.fn().mockResolvedValue({}),
      abort: vi.fn().mockResolvedValue(true),
    },
    event: {
      subscribe: vi.fn().mockResolvedValue(createThrowingEventStream(events)),
    },
  };
}

function createEventStream(events: Array<Record<string, unknown>>) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
    },
  };
}

function createThrowingEventStream(events: Array<Record<string, unknown>>) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
      throw new Error("SSE stream closed");
    },
  };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe("runAgent - extended coverage", () => {
  const originalModel = process.env.OPENCODE_MODEL;
  const originalProvider = process.env.OPENCODE_PROVIDER;

  beforeEach(() => {
    delete process.env.OPENCODE_MODEL;
    delete process.env.OPENCODE_PROVIDER;
    vi.mocked(getClient).mockReset();
  });

  afterEach(() => {
    if (originalModel === undefined) {
      delete process.env.OPENCODE_MODEL;
    } else {
      process.env.OPENCODE_MODEL = originalModel;
    }
    if (originalProvider === undefined) {
      delete process.env.OPENCODE_PROVIDER;
    } else {
      process.env.OPENCODE_PROVIDER = originalProvider;
    }
  });

  // ── requireNonEmpty ───────────────────────────────────────────────────────

  it("throws when task is empty string", async () => {
    process.env.OPENCODE_MODEL = "anthropic/claude";
    await expect(
      runAgent({ task: "   ", directory: "/tmp/project" })
    ).rejects.toThrow("`task` must not be empty");
  });

  it("throws when directory is empty string", async () => {
    process.env.OPENCODE_MODEL = "anthropic/claude";
    await expect(
      runAgent({ task: "do something", directory: "   " })
    ).rejects.toThrow("`directory` must not be empty");
  });

  // ── resolveModel – edge cases ─────────────────────────────────────────────

  it("throws for model with only a slash separator and empty provider", async () => {
    await expect(
      runAgent({ task: "do it", directory: "/tmp", model: "/model-id" })
    ).rejects.toThrow("Invalid model");
  });

  it("throws for model with only a slash separator and empty modelID", async () => {
    await expect(
      runAgent({ task: "do it", directory: "/tmp", model: "provider/" })
    ).rejects.toThrow("Invalid model");
  });

  it("uses OPENCODE_PROVIDER env when model has no provider prefix", async () => {
    process.env.OPENCODE_PROVIDER = "my-provider";
    process.env.OPENCODE_MODEL = "my-model";

    const client = createMockClient([
      { type: "session.idle", properties: { sessionID: "session-1" } },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    await runAgent({ task: "Do something", directory: "/tmp/project" });

    expect(client.session.prompt).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          model: { providerID: "my-provider", modelID: "my-model" },
        }),
      })
    );
  });

  it("defaults to anthropic provider when OPENCODE_PROVIDER is not set", async () => {
    process.env.OPENCODE_MODEL = "claude-3";

    const client = createMockClient([
      { type: "session.idle", properties: { sessionID: "session-1" } },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    await runAgent({ task: "Do something", directory: "/tmp/project" });

    expect(client.session.prompt).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          model: { providerID: "anthropic", modelID: "claude-3" },
        }),
      })
    );
  });

  // ── session.error – extractSessionError branches ──────────────────────────

  it("handles session.error with an Error instance (non-empty message)", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";

    const errorObj = new Error("Auth failed");
    const client = createMockClient([
      {
        type: "session.error",
        properties: {
          sessionID: "session-1",
          error: errorObj,
        },
      },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    const result = await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Auth failed");
  });

  it("handles session.error with plain object having message field", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";

    const client = createMockClient([
      {
        type: "session.error",
        properties: {
          sessionID: "session-1",
          error: { message: "Plain object error" },
        },
      },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    const result = await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Plain object error");
  });

  it("handles session.error with object having data.message field", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";

    const client = createMockClient([
      {
        type: "session.error",
        properties: {
          sessionID: "session-1",
          error: { data: { message: "Data message error" } },
        },
      },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    const result = await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Data message error");
  });

  it("handles session.error with null error (falls back to unknown)", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";

    const client = createMockClient([
      {
        type: "session.error",
        properties: {
          sessionID: "session-1",
          error: null,
        },
      },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    const result = await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Unknown session error");
  });

  it("handles session.error with undefined sessionID (broadcasts to any session)", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";

    const client = createMockClient([
      {
        type: "session.error",
        properties: {
          // no sessionID => matches any session
          error: { message: "Global error" },
        },
      },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    const result = await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Global error");
  });

  it("ignores session.error for a different sessionID", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";

    const client = createMockClient([
      {
        type: "session.error",
        properties: {
          sessionID: "other-session",
          error: { message: "Should be ignored" },
        },
      },
      { type: "session.idle", properties: { sessionID: "session-1" } },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    const result = await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
    });
    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // ── session.idle for different session ───────────────────────────────────

  it("ignores session.idle for a different sessionID", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";

    const client = createMockClient([
      {
        type: "session.idle",
        properties: { sessionID: "other-session" },
      },
      {
        type: "session.idle",
        properties: { sessionID: "session-1" },
      },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    const result = await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
    });
    expect(result.ok).toBe(true);
  });

  // ── message.part.updated for different session ────────────────────────────

  it("ignores message.part.updated events for a different sessionID", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";

    const events: AgentEvent[] = [];
    const client = createMockClient([
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "text-1",
            sessionID: "other-session",
            type: "text",
            text: "Should be ignored",
          },
        },
      },
      { type: "session.idle", properties: { sessionID: "session-1" } },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    const result = await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
      onEvent: (e) => {
        events.push(e);
      },
    });
    expect(result.output).toBe("");
    expect(events).toHaveLength(0);
  });

  // ── tool event – error status ─────────────────────────────────────────────

  it("emits tool-finish with ok=false for tool error status", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";
    const events: import("../src/types.js").AgentEvent[] = [];

    const client = createMockClient([
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "tool-1",
            sessionID: "session-1",
            type: "tool",
            tool: "read",
            state: {
              status: "running",
              input: { path: "README.md" },
            },
          },
        },
      },
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "tool-1",
            sessionID: "session-1",
            type: "tool",
            tool: "read",
            state: {
              status: "error",
              input: { path: "README.md" },
              error: "File not found",
            },
          },
        },
      },
      { type: "session.idle", properties: { sessionID: "session-1" } },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    await runAgent({
      task: "Read README",
      directory: "/tmp/project",
      onEvent: (e) => events.push(e),
    });

    const toolFinish = events.find((e) => e.type === "tool-finish");
    expect(toolFinish).toBeDefined();
    expect(toolFinish).toMatchObject({
      type: "tool-finish",
      tool: "read",
      ok: false,
      output: "File not found",
    });
  });

  it("does not emit duplicate tool events for same status", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";
    const events: import("../src/types.js").AgentEvent[] = [];

    const client = createMockClient([
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "tool-1",
            sessionID: "session-1",
            type: "tool",
            tool: "read",
            state: { status: "running", input: {} },
          },
        },
      },
      // same status again – should be de-duplicated
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "tool-1",
            sessionID: "session-1",
            type: "tool",
            tool: "read",
            state: { status: "running", input: {} },
          },
        },
      },
      { type: "session.idle", properties: { sessionID: "session-1" } },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
      onEvent: (e) => events.push(e),
    });

    const toolStarts = events.filter((e) => e.type === "tool-start");
    expect(toolStarts).toHaveLength(1);
  });

  it("emits tool-start with empty input when state.input is undefined", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";
    const events: import("../src/types.js").AgentEvent[] = [];

    const client = createMockClient([
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "tool-1",
            sessionID: "session-1",
            type: "tool",
            tool: "read",
            state: {
              status: "running",
              // input is intentionally missing
            },
          },
        },
      },
      { type: "session.idle", properties: { sessionID: "session-1" } },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
      onEvent: (e) => events.push(e),
    });

    const toolStart = events.find((e) => e.type === "tool-start");
    expect(toolStart).toMatchObject({ type: "tool-start", input: {} });
  });

  it("emits tool-finish with empty output when state.output is undefined", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";
    const events: import("../src/types.js").AgentEvent[] = [];

    const client = createMockClient([
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "tool-1",
            sessionID: "session-1",
            type: "tool",
            tool: "read",
            state: {
              status: "running",
              input: {},
            },
          },
        },
      },
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "tool-1",
            sessionID: "session-1",
            type: "tool",
            tool: "read",
            state: {
              status: "completed",
              // output intentionally missing
            },
          },
        },
      },
      { type: "session.idle", properties: { sessionID: "session-1" } },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
      onEvent: (e) => events.push(e),
    });

    const toolFinish = events.find((e) => e.type === "tool-finish");
    expect(toolFinish).toMatchObject({ type: "tool-finish", output: "", ok: true });
  });

  it("emits tool-finish with 'Tool error' fallback when state.error is undefined", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";
    const events: import("../src/types.js").AgentEvent[] = [];

    const client = createMockClient([
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "tool-1",
            sessionID: "session-1",
            type: "tool",
            tool: "read",
            state: {
              status: "running",
              input: {},
            },
          },
        },
      },
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "tool-1",
            sessionID: "session-1",
            type: "tool",
            tool: "read",
            state: {
              status: "error",
              // error intentionally missing
            },
          },
        },
      },
      { type: "session.idle", properties: { sessionID: "session-1" } },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
      onEvent: (e) => events.push(e),
    });

    const toolFinish = events.find((e) => e.type === "tool-finish");
    expect(toolFinish).toMatchObject({ type: "tool-finish", output: "Tool error", ok: false });
  });

  it("does not emit tool event when status is undefined", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";
    const events: import("../src/types.js").AgentEvent[] = [];

    const client = createMockClient([
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "tool-1",
            sessionID: "session-1",
            type: "tool",
            tool: "read",
            // no state
          },
        },
      },
      { type: "session.idle", properties: { sessionID: "session-1" } },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
      onEvent: (e) => events.push(e),
    });

    expect(events).toHaveLength(0);
  });

  // ── getTextDelta – delta provided vs full text ────────────────────────────

  it("uses delta from payload when provided instead of computing diff", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";
    const events: import("../src/types.js").AgentEvent[] = [];

    const client = createMockClient([
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "text-1",
            sessionID: "session-1",
            type: "text",
            text: "Hello world",
          },
          delta: "explicit delta",
        },
      },
      { type: "session.idle", properties: { sessionID: "session-1" } },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
      onEvent: (e) => events.push(e),
    });

    const textEvent = events.find((e) => e.type === "text");
    expect(textEvent).toMatchObject({ type: "text", text: "explicit delta" });
  });

  it("emits full text when new text does not start with previous text", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";
    const events: import("../src/types.js").AgentEvent[] = [];

    const client = createMockClient([
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "text-1",
            sessionID: "session-1",
            type: "text",
            text: "Hello",
          },
        },
      },
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "text-1",
            sessionID: "session-1",
            type: "text",
            // Completely different text, doesn't start with "Hello"
            text: "World",
          },
        },
      },
      { type: "session.idle", properties: { sessionID: "session-1" } },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
      onEvent: (e) => events.push(e),
    });

    const textEvents = events.filter((e) => e.type === "text");
    expect(textEvents).toHaveLength(2);
    // Second event should emit "World" as it doesn't start with "Hello"
    expect(textEvents[1]).toMatchObject({ type: "text", text: "World" });
  });

  it("does not emit text event when delta is empty string", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";
    const events: import("../src/types.js").AgentEvent[] = [];

    const client = createMockClient([
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "text-1",
            sessionID: "session-1",
            type: "text",
            text: "Hello",
          },
          // Same text as before (text starts with previous, so delta is empty)
        },
      },
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "text-1",
            sessionID: "session-1",
            type: "text",
            text: "Hello",
          },
          // Repeated same text – delta would be ""
        },
      },
      { type: "session.idle", properties: { sessionID: "session-1" } },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    await runAgent({
      task: "Inspect",
      directory: "/tmp/project",
      onEvent: (e) => events.push(e),
    });

    const textEvents = events.filter((e) => e.type === "text");
    // Only the first emission (full "Hello"), second should be empty delta skipped
    expect(textEvents).toHaveLength(1);
  });

  // ── prompt throws / abort signal ─────────────────────────────────────────

  it("returns error when prompt call throws with non-Error value", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";

    const client = {
      session: {
        create: vi.fn().mockResolvedValue({ id: "session-1" }),
        prompt: vi.fn().mockRejectedValue("string error"),
        abort: vi.fn().mockResolvedValue(true),
      },
      event: {
        subscribe: vi.fn().mockResolvedValue(
          createEventStream([
            { type: "session.idle", properties: { sessionID: "session-1" } },
          ])
        ),
      },
    };
    vi.mocked(getClient).mockResolvedValue(client);

    const result = await runAgent({
      task: "Do something",
      directory: "/tmp/project",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Agent run failed");
    expect(result.error).toContain("string error");
  });

  it("returns error when prompt throws an Error instance (non-aborted signal)", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";

    const client = {
      session: {
        create: vi.fn().mockResolvedValue({ id: "session-1" }),
        prompt: vi.fn().mockRejectedValue(new Error("Connection refused")),
        abort: vi.fn().mockResolvedValue(true),
      },
      event: {
        subscribe: vi.fn().mockResolvedValue(
          createEventStream([
            { type: "session.idle", properties: { sessionID: "session-1" } },
          ])
        ),
      },
    };
    vi.mocked(getClient).mockResolvedValue(client);

    const result = await runAgent({
      task: "Do something",
      directory: "/tmp/project",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Agent run failed: Connection refused");
  });

  it("sets error to 'Cancelled' when prompt fails with aborted signal", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";

    const abortController = new AbortController();

    const client = {
      session: {
        create: vi.fn().mockResolvedValue({ id: "session-1" }),
        prompt: vi.fn().mockImplementation(() => {
          abortController.abort();
          return Promise.reject(new Error("Aborted"));
        }),
        abort: vi.fn().mockResolvedValue(true),
      },
      event: {
        subscribe: vi.fn().mockResolvedValue(
          createEventStream([
            { type: "session.idle", properties: { sessionID: "session-1" } },
          ])
        ),
      },
    };
    vi.mocked(getClient).mockResolvedValue(client);

    const result = await runAgent({
      task: "Do something",
      directory: "/tmp/project",
      signal: abortController.signal,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Cancelled");
  });

  it("registers and removes the abort signal listener", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";

    const abortController = new AbortController();
    const addSpy = vi.spyOn(abortController.signal, "addEventListener");
    const removeSpy = vi.spyOn(abortController.signal, "removeEventListener");

    const client = createMockClient([
      { type: "session.idle", properties: { sessionID: "session-1" } },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    await runAgent({
      task: "Do something",
      directory: "/tmp/project",
      signal: abortController.signal,
    });

    expect(addSpy).toHaveBeenCalledWith("abort", expect.any(Function), { once: true });
    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  // ── SSE stream throws ─────────────────────────────────────────────────────

  it("silently swallows SSE stream errors (server shutdown)", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";

    const client = createMockClientWithThrowingSubscribe([
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "text-1",
            sessionID: "session-1",
            type: "text",
            text: "Hello",
          },
        },
      },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    // Should not throw
    const result = await runAgent({
      task: "Do something",
      directory: "/tmp/project",
    });

    // The stream error is swallowed – result should still be formed
    expect(result.sessionId).toBe("session-1");
  });

  // ── unknown event type ────────────────────────────────────────────────────

  it("ignores unknown event types without throwing", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";

    const client = createMockClient([
      {
        type: "some.unknown.event",
        properties: { foo: "bar" },
      },
      { type: "session.idle", properties: { sessionID: "session-1" } },
    ]);
    vi.mocked(getClient).mockResolvedValue(client);

    const result = await runAgent({
      task: "Do something",
      directory: "/tmp/project",
    });

    expect(result.ok).toBe(true);
  });
});

// Keep the same import used in the test body (AgentEvent is a type)
type AgentEvent = import("../src/types.js").AgentEvent;
