/**
 * Additional tests to cover remaining uncovered lines in the AI package.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AITracker, Usage } from "../src/types.js";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGenerateText = vi.fn();
const mockStreamText = vi.fn();

vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  streamText: (...args: unknown[]) => mockStreamText(...args),
  tool: (def: unknown) => def,
  stepCountIs: (n: number) => ({ type: "stepCount", count: n }),
  Output: {
    object: ({ schema }: { schema: unknown }) => ({ type: "object", schema }),
  },
}));

const { createAI } = await import("../src/createAI.js");
const { createAgent } = await import("../src/createAgent.js");
const { runStream } = await import("../src/createStream.js");
const { addCacheControl } = await import("../src/addCacheControl.js");
const { extractJson } = await import("../src/extractJson.js");
const { findBalanced } = await import("../src/findBalanced.js");

function createMockTracker(): AITracker & { calls: Usage[] } {
  const calls: Usage[] = [];
  return { calls, record: (u: Usage) => calls.push(u) };
}

function mockModel(): unknown {
  return { modelId: "test-model", provider: "test" };
}

function mockLogger() {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function mockStreamResult(
  chunks: string[],
  usage: Record<string, unknown> = { inputTokens: 10, outputTokens: 5 }
) {
  async function* textStream() {
    for (const chunk of chunks) yield chunk;
  }
  return {
    textStream: textStream(),
    usage: Promise.resolve({ inputTokenDetails: {}, ...usage }),
  };
}

// ─── addCacheControl ─────────────────────────────────────────────────────────

describe("addCacheControl - prefix boundary", () => {
  it("marks the second-to-last message when there are 3+ messages", () => {
    const messages = [
      { role: "user" as const, content: "msg1" },
      { role: "assistant" as const, content: "msg2" },
      { role: "user" as const, content: "msg3" },
    ];
    const result = addCacheControl(messages);
    expect(result[1]).toHaveProperty("providerOptions");
    expect(result[0]).not.toHaveProperty("providerOptions");
    expect(result[2]).not.toHaveProperty("providerOptions");
  });
});

// ─── createAI - normalizeMessages branches ───────────────────────────────────

describe("createAI - normalizeMessages edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips system prompt prepend when systemPrompt is empty string", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "ok",
      usage: { inputTokens: 5, outputTokens: 3, inputTokenDetails: {} },
    });

    const tracker = createMockTracker();
    const ai = createAI({
      model: mockModel() as never,
      tracker,
      systemPrompt: "",
    });

    await ai.ask("test");
    const callArgs = mockGenerateText.mock.calls[0][0] as {
      messages: unknown[];
    };
    expect(callArgs.messages).toHaveLength(1);
  });

  it("skips system prompt prepend when messages already have system role", async () => {
    mockStreamText.mockReturnValueOnce(mockStreamResult(["ok"]));

    const tracker = createMockTracker();
    const ai = createAI({
      model: mockModel() as never,
      tracker,
      systemPrompt: "Default system",
    });

    await ai.stream(
      [
        { role: "system" as const, content: "Custom system" },
        { role: "user" as const, content: "hello" },
      ],
      () => {}
    );

    const callArgs = mockStreamText.mock.calls[0][0] as {
      messages: Array<{ role: string }>;
    };
    const systemMessages = callArgs.messages.filter((m) => m.role === "system");
    expect(systemMessages).toHaveLength(1);
  });
});

// ─── createAI - getTrackedPrompt fallback paths ──────────────────────────────

describe("createAI - getTrackedPrompt without user messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to last message content when no user message", async () => {
    mockStreamText.mockReturnValueOnce(mockStreamResult(["hi"]));

    const tracker = createMockTracker();
    const ai = createAI({ model: mockModel() as never, tracker });

    await ai.stream(
      [{ role: "assistant" as const, content: "assistant prompt" }],
      () => {}
    );

    expect(tracker.calls[0].prompt).toBe("assistant prompt");
  });

  it("returns empty string when messages is empty", async () => {
    mockStreamText.mockReturnValueOnce(mockStreamResult(["hi"]));

    const tracker = createMockTracker();
    const ai = createAI({ model: mockModel() as never, tracker });

    await ai.stream([], () => {});

    expect(tracker.calls[0].prompt).toBe("");
  });
});

// ─── createAgent - getTrackedPrompt fallback paths ───────────────────────────

describe("createAgent - getTrackedPrompt without user messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to last message when no user message", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "agent result",
      usage: { inputTokens: 5, outputTokens: 3, inputTokenDetails: {} },
    });

    const tracker = createMockTracker();
    const agent = createAgent(
      mockModel() as never,
      {},
      tracker,
      mockLogger() as never
    );

    await agent.run([{ role: "assistant" as const, content: "context" }]);
    expect(tracker.calls[0].prompt).toBe("context");
  });

  it("returns empty string when messages is empty", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "agent result",
      usage: { inputTokens: 5, outputTokens: 3, inputTokenDetails: {} },
    });

    const tracker = createMockTracker();
    const agent = createAgent(
      mockModel() as never,
      {},
      tracker,
      mockLogger() as never
    );

    await agent.run([]);
    expect(tracker.calls[0].prompt).toBe("");
  });
});

// ─── createAI - ChatCall .then(null) false branch (lines 197-220) ────────────

describe("createAI - ChatCall.text().then(null) and .zod().then(null) branches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chat().text().then(null) returns the text unchanged (line 197-199 false branch)", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "hello world",
      usage: { inputTokens: 5, outputTokens: 3, inputTokenDetails: {} },
    });

    const tracker = createMockTracker();
    const ai = createAI({ model: mockModel() as never, tracker });

    // Calling .then(null) exercises the onfulfilled=null branch
    const result = await ai.chat("test").text().then(null);
    expect(result).toBe("hello world");
  });

  it("chat().zod().then(null) returns the data unchanged (line 220-222 false branch)", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '{"name":"Alice"}',
      output: { name: "Alice" },
      usage: { inputTokens: 5, outputTokens: 3, inputTokenDetails: {} },
    });

    const tracker = createMockTracker();
    const ai = createAI({ model: mockModel() as never, tracker });

    // Calling .then(null) on zod() result exercises onfulfilled=null branch at line 220
    const { z } = await import("zod");
    const result = await ai.chat("test").zod(z.object({ name: z.string() })).then(null);
    // onfulfilled=null → returns data as-is (msg.data from result.output)
    expect(result).toEqual({ name: "Alice" });
  });
});

// ─── createAI - ask() with cache tokens in response ──────────────────────────

describe("createAI - ask with cache tokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs cacheCreationTokens and cacheReadTokens in ask() debug (lines 150-155)", async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: "response",
      usage: {
        inputTokens: 10,
        outputTokens: 5,
        inputTokenDetails: {
          cacheWriteTokens: 100,
          cacheReadTokens: 50,
        },
      },
    });

    const logger = mockLogger();
    const tracker = createMockTracker();
    const ai = createAI({ model: mockModel() as never, tracker, logger: logger as never });

    await ai.ask("test");

    const debugCalls = (logger.debug.mock.calls as unknown[][]).filter(
      (c) => c[0] === "AI response"
    );
    expect(debugCalls[0][1]).toHaveProperty("cacheCreationTokens", 100);
    expect(debugCalls[0][1]).toHaveProperty("cacheReadTokens", 50);
  });
});

// ─── createAgent - stream with cache tokens ───────────────────────────────────

describe("createAgent - stream with cache tokens (lines 249-254)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs cacheCreationTokens and cacheReadTokens in agent stream debug", async () => {
    mockStreamText.mockReturnValueOnce({
      fullStream: (async function* () {
        yield { type: "text-delta", text: "hi" };
      })(),
      usage: Promise.resolve({
        inputTokens: 10,
        outputTokens: 5,
        inputTokenDetails: {
          cacheWriteTokens: 75,
          cacheReadTokens: 30,
        },
      }),
    });

    const logger = mockLogger();
    const tracker = createMockTracker();
    const agent = createAgent(
      mockModel() as never,
      {},
      tracker,
      logger as never
    );

    await agent.stream([{ role: "user" as const, content: "test" }], () => {});

    const debugCalls = (logger.debug.mock.calls as unknown[][]).filter(
      (c) => c[0] === "Agent stream complete"
    );
    expect(debugCalls[0][1]).toHaveProperty("cacheCreationTokens", 75);
    expect(debugCalls[0][1]).toHaveProperty("cacheReadTokens", 30);
  });
});

// ─── createStream - empty messages (line 55 false branch) ────────────────────

describe("runStream - empty messages array (line 55 false branch)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses empty string as prompt when messages array is empty", async () => {
    mockStreamText.mockReturnValueOnce({
      textStream: (async function* () {
        yield "ok";
      })(),
      usage: Promise.resolve({
        inputTokens: 1,
        outputTokens: 1,
        inputTokenDetails: {},
      }),
    });

    const tracker = createMockTracker();
    await runStream(
      mockModel() as never,
      tracker,
      mockLogger() as never,
      [],
      () => {}
    );

    expect(tracker.calls[0].prompt).toBe("");
  });
});

// ─── createStream - cacheCreationTokens in debug log ─────────────────────────

describe("runStream - cacheCreationTokens and cacheReadTokens in debug", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes cache tokens in debug log when present", async () => {
    mockStreamText.mockReturnValueOnce({
      textStream: (async function* () {
        yield "hi";
      })(),
      usage: Promise.resolve({
        inputTokens: 10,
        outputTokens: 5,
        inputTokenDetails: {
          cacheWriteTokens: 50,
          cacheReadTokens: 25,
        },
      }),
    });

    const logger = mockLogger();
    const tracker = createMockTracker();
    await runStream(
      mockModel() as never,
      tracker,
      logger as never,
      [{ role: "user" as const, content: "test" }],
      () => {}
    );

    const completeCalls = (logger.debug.mock.calls as unknown[][]).filter(
      (c) => c[0] === "AI stream complete"
    );
    expect(completeCalls[0][1]).toHaveProperty("cacheCreationTokens", 50);
    expect(completeCalls[0][1]).toHaveProperty("cacheReadTokens", 25);
  });
});

// ─── extractJson - bracket false branch ──────────────────────────────────────

describe("extractJson - array bracket scanning", () => {
  it("extracts JSON array from prose via findAllBalanced brackets", () => {
    const text = "Result: [1, 2, 3] end.";
    const result = extractJson(text);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([1, 2, 3]);
  });

  it("skips non-JSON bracket content (line 55 false branch)", () => {
    const text = "See [my example] for details.";
    const result = extractJson(text);
    expect(result).toHaveLength(0);
  });
});

// ─── findBalanced - backslash handling ───────────────────────────────────────

describe("findBalanced - backslash handling", () => {
  it("handles escape inside JSON string (inString=true path)", () => {
    const input = '{"key":"val\\"ue"}';
    const result = findBalanced(input, "{", "}");
    expect(result).toBe(input);
  });

  it("handles backslash outside string context (line 25 false branch)", () => {
    // backslash character encountered while NOT inside a string
    // The scan starts at '{', encounters '\' outside string context
    const input = '{ \\ "x": 1 }';
    const result = findBalanced(input, "{", "}");
    expect(result).toBe(input);
  });
});
