import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getClient } from "../src/server.js";
import { runAgent } from "../src/runAgent.js";
import type { AgentEvent } from "../src/types.js";

vi.mock("../src/server.js", () => ({
  getClient: vi.fn(),
  shutdownAgentServer: vi.fn(),
}));

describe("runAgent", () => {
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

  it("runs a task with read-only tools and streams expressive events", async () => {
    process.env.OPENCODE_PROVIDER = "openai";

    const client = createMockClient([
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "text-1",
            sessionID: "session-1",
            messageID: "message-1",
            type: "text",
            text: "Hel",
          },
        },
      },
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "text-1",
            sessionID: "session-1",
            messageID: "message-1",
            type: "text",
            text: "Hello",
          },
        },
      },
      {
        type: "message.part.updated",
        properties: {
          part: {
            id: "tool-1",
            sessionID: "session-1",
            messageID: "message-1",
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
            messageID: "message-1",
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
            messageID: "message-1",
            type: "tool",
            tool: "read",
            state: {
              status: "completed",
              input: { path: "README.md" },
              output: "file body",
            },
          },
        },
      },
      {
        type: "session.idle",
        properties: {
          sessionID: "session-1",
        },
      },
    ]);

    vi.mocked(getClient).mockResolvedValue(client);

    const events: AgentEvent[] = [];

    const result = await runAgent({
      task: "Summarize the README",
      directory: "/tmp/project",
      model: "o3-mini",
      instructions: "Answer in one sentence.",
      mode: "read",
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(vi.mocked(getClient)).toHaveBeenCalledWith("/tmp/project");
    expect(client.session.create).toHaveBeenCalledWith({});
    expect(client.session.prompt).toHaveBeenCalledWith({
      path: { id: "session-1" },
      body: {
        model: { providerID: "openai", modelID: "o3-mini" },
        system: "Answer in one sentence.",
        tools: { read: true, glob: true, grep: true },
        parts: [{ type: "text", text: "Summarize the README" }],
      },
    });
    expect(events).toEqual([
      { type: "text", text: "Hel" },
      { type: "text", text: "lo" },
      { type: "tool-start", tool: "read", input: { path: "README.md" } },
      {
        type: "tool-finish",
        tool: "read",
        input: { path: "README.md" },
        output: "file body",
        ok: true,
      },
    ]);
    expect(result).toMatchObject({
      ok: true,
      output: "Hello",
      sessionId: "session-1",
    });
  });

  it("uses OPENCODE_MODEL when model is omitted", async () => {
    process.env.OPENCODE_MODEL = "anthropic/claude-sonnet";

    const client = createMockClient([
      {
        type: "session.idle",
        properties: {
          sessionID: "session-1",
        },
      },
    ]);

    vi.mocked(getClient).mockResolvedValue(client);

    await runAgent({
      task: "Check the repo",
      directory: "/tmp/project",
    });

    expect(client.session.prompt).toHaveBeenCalledWith({
      path: { id: "session-1" },
      body: {
        model: { providerID: "anthropic", modelID: "claude-sonnet" },
        parts: [{ type: "text", text: "Check the repo" }],
      },
    });
  });

  it("returns the session error when the server reports one", async () => {
    process.env.OPENCODE_MODEL = "openai/o3";

    const client = createMockClient([
      {
        type: "session.error",
        properties: {
          sessionID: "session-1",
          error: { message: "Provider authentication required" },
        },
      },
    ]);

    vi.mocked(getClient).mockResolvedValue(client);

    const result = await runAgent({
      task: "Inspect the workspace",
      directory: "/tmp/project",
    });

    expect(result).toMatchObject({
      ok: false,
      error: "Provider authentication required",
      output: "",
      sessionId: "session-1",
    });
  });

  it("requires a model when nothing is configured", async () => {
    await expect(
      runAgent({
        task: "Inspect the workspace",
        directory: "/tmp/project",
      })
    ).rejects.toThrow(
      "No model configured. Pass `model` to runAgent() or set OPENCODE_MODEL."
    );
  });
});

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

function createEventStream(events: Array<Record<string, unknown>>) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
    },
  };
}
