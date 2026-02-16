import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AITracker, Usage } from "../src/types.js";

// Mock the AI SDK
const mockGenerateText = vi.fn();
vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  Output: {
    object: ({ schema }: { schema: unknown }) => ({ type: "object", schema }),
  },
}));

// Import after mocking
const { createAI } = await import("../src/createAI.js");

function createMockTracker(): AITracker & { calls: Usage[] } {
  const calls: Usage[] = [];
  return {
    calls,
    record(usage: Usage) {
      calls.push(usage);
    },
  };
}

function mockModel(): unknown {
  return { modelId: "test-model", provider: "test" };
}

function mockLogger(): {
  debug: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
} {
  return { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

describe("createAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws if tracker is not provided", () => {
    expect(() =>
      createAI(mockModel() as never, undefined as never, mockLogger() as never)
    ).toThrow("AITracker is required");
  });

  it("throws if tracker is null", () => {
    expect(() =>
      createAI(mockModel() as never, null as never, mockLogger() as never)
    ).toThrow("AITracker is required");
  });

  describe("chat", () => {
    it("returns text and usage", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Hello world",
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);
      const msg = await ai.chat("Say hello");

      expect(msg.text).toBe("Hello world");
      expect(msg.usage.inputTokens).toBe(10);
      expect(msg.usage.outputTokens).toBe(5);
      expect(msg.usage.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("passes system prompt to generateText", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "response",
        usage: { inputTokens: 1, outputTokens: 1 },
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);
      await ai.chat("prompt", "You are helpful");

      const callArgs = mockGenerateText.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArgs).toHaveProperty("system", "You are helpful");
    });

    it("omits system when not provided", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "response",
        usage: { inputTokens: 1, outputTokens: 1 },
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);
      await ai.chat("prompt");

      const callArgs = mockGenerateText.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArgs).not.toHaveProperty("system");
    });

    it("uses default maxOutputTokens of 4096", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "response",
        usage: { inputTokens: 1, outputTokens: 1 },
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);
      await ai.chat("prompt");

      const callArgs = mockGenerateText.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArgs).toHaveProperty("maxOutputTokens", 4096);
    });

    it("uses custom maxTokens from options", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "response",
        usage: { inputTokens: 1, outputTokens: 1 },
      });

      const tracker = createMockTracker();
      const ai = createAI(
        mockModel() as never,
        tracker,
        mockLogger() as never,
        { maxTokens: 8192 }
      );
      await ai.chat("prompt");

      const callArgs = mockGenerateText.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArgs).toHaveProperty("maxOutputTokens", 8192);
    });

    it("handles missing usage fields gracefully", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "response",
        usage: {},
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);
      const msg = await ai.chat("prompt");

      expect(msg.usage.inputTokens).toBe(0);
      expect(msg.usage.outputTokens).toBe(0);
    });
  });

  describe("logger", () => {
    it("logs debug before and after each call", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "response",
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const tracker = createMockTracker();
      const logger = mockLogger();
      const ai = createAI(mockModel() as never, tracker, logger as never);
      await ai.chat("hello");

      expect(logger.debug).toHaveBeenCalledTimes(2);
      expect(logger.debug).toHaveBeenNthCalledWith(1, "AI request", {
        promptLength: 5,
        hasSystemPrompt: false,
        hasSchema: false,
      });
      expect(logger.debug).toHaveBeenNthCalledWith(
        2,
        "AI response",
        expect.objectContaining({
          responseLength: 8,
          inputTokens: 10,
          outputTokens: 5,
        })
      );
    });
  });

  describe("tracker", () => {
    it("fires for every chat call", async () => {
      mockGenerateText.mockResolvedValue({
        text: "response",
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);

      await ai.chat("first");
      await ai.chat("second");

      expect(tracker.calls).toHaveLength(2);
      expect(tracker.calls[0].inputTokens).toBe(10);
      expect(tracker.calls[1].inputTokens).toBe(10);
    });

    it("fires for reply calls", async () => {
      mockGenerateText.mockResolvedValue({
        text: "response",
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);

      const msg = await ai.chat("first");
      await msg.reply("second");

      expect(tracker.calls).toHaveLength(2);
    });

    it("records prompt and response", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Hello world",
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);
      await ai.chat("Say hello");

      expect(tracker.calls[0].prompt).toBe("Say hello");
      expect(tracker.calls[0].response).toBe("Hello world");
      expect(tracker.calls[0].systemPrompt).toBeUndefined();
    });

    it("records systemPrompt when provided", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "response",
        usage: { inputTokens: 1, outputTokens: 1 },
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);
      await ai.chat("prompt", "You are helpful");

      expect(tracker.calls[0].systemPrompt).toBe("You are helpful");
    });

    it("records follow-up prompt on reply", async () => {
      mockGenerateText.mockResolvedValue({
        text: "response",
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);
      const msg = await ai.chat("first");
      await msg.reply("follow up");

      expect(tracker.calls[0].prompt).toBe("first");
      expect(tracker.calls[1].prompt).toBe("follow up");
    });

    it("includes durationMs", async () => {
      mockGenerateText.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  text: "response",
                  usage: { inputTokens: 1, outputTokens: 1 },
                }),
              10
            )
          )
      );

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);
      await ai.chat("prompt");

      expect(tracker.calls[0].durationMs).toBeGreaterThanOrEqual(5);
    });
  });

  describe("text", () => {
    it("returns text directly", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Hello world",
        usage: { inputTokens: 10, outputTokens: 5 },
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);
      const text = await ai.chat("Say hello").text();

      expect(text).toBe("Hello world");
    });

    it("fires tracker for text calls", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "response",
        usage: { inputTokens: 15, outputTokens: 8 },
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);
      await ai.chat("prompt").text();

      expect(tracker.calls).toHaveLength(1);
      expect(tracker.calls[0].inputTokens).toBe(15);
    });
  });

  describe("zod", () => {
    it("returns structured data directly", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: '{"name":"Alice","age":30}',
        usage: { inputTokens: 10, outputTokens: 5 },
        output: { name: "Alice", age: 30 },
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);

      const fakeSchema = {} as never;
      const data = await ai.chat("Get user info").zod(fakeSchema);

      expect(data).toEqual({ name: "Alice", age: 30 });
    });

    it("passes output config to generateText", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "{}",
        usage: { inputTokens: 1, outputTokens: 1 },
        output: {},
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);

      const fakeSchema = { _type: "zod" } as never;
      await ai.chat("prompt").zod(fakeSchema);

      const callArgs = mockGenerateText.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArgs).toHaveProperty("output");
    });

    it("fires tracker for zod calls", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "{}",
        usage: { inputTokens: 15, outputTokens: 8 },
        output: {},
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);

      await ai.chat("prompt").zod({} as never);

      expect(tracker.calls).toHaveLength(1);
      expect(tracker.calls[0].inputTokens).toBe(15);
    });
  });

  describe("reply", () => {
    it("accumulates message history", async () => {
      mockGenerateText
        .mockResolvedValueOnce({
          text: "First response",
          usage: { inputTokens: 10, outputTokens: 5 },
        })
        .mockResolvedValueOnce({
          text: "Second response",
          usage: { inputTokens: 20, outputTokens: 10 },
        });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);

      const msg1 = await ai.chat("Hello");
      await msg1.reply("Follow up");

      const secondCallArgs = mockGenerateText.mock.calls[1][0] as {
        messages: Array<{ role: string; content: string }>;
      };
      expect(secondCallArgs.messages).toHaveLength(3);
      expect(secondCallArgs.messages[0]).toEqual({
        role: "user",
        content: "Hello",
      });
      expect(secondCallArgs.messages[1]).toEqual({
        role: "assistant",
        content: "First response",
      });
      expect(secondCallArgs.messages[2]).toEqual({
        role: "user",
        content: "Follow up",
      });
    });

    it("supports chaining reply with zod", async () => {
      mockGenerateText
        .mockResolvedValueOnce({
          text: "First response",
          usage: { inputTokens: 10, outputTokens: 5 },
        })
        .mockResolvedValueOnce({
          text: '{"result":true}',
          usage: { inputTokens: 20, outputTokens: 10 },
          output: { result: true },
        });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);

      const msg1 = await ai.chat("Start");
      const data = await msg1.reply("Now give me JSON").zod({} as never);

      expect(data).toEqual({ result: true });
      expect(tracker.calls).toHaveLength(2);
    });

    it("preserves system prompt across replies", async () => {
      mockGenerateText.mockResolvedValue({
        text: "response",
        usage: { inputTokens: 1, outputTokens: 1 },
      });

      const tracker = createMockTracker();
      const ai = createAI(mockModel() as never, tracker, mockLogger() as never);

      const msg = await ai.chat("prompt", "system instructions");
      await msg.reply("follow up");

      const secondCallArgs = mockGenerateText.mock.calls[1][0] as Record<
        string,
        unknown
      >;
      expect(secondCallArgs).toHaveProperty("system", "system instructions");
    });
  });
});
