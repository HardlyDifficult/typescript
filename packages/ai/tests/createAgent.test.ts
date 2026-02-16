import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import type { AITracker, Usage, ToolMap } from "../src/types.js";

// Mock the AI SDK
const mockGenerateText = vi.fn();
const mockStreamText = vi.fn();
const mockSdkTool = vi.fn(
  (def: { description: string; inputSchema: unknown; execute: unknown }) => def
);
vi.mock("ai", () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
  streamText: (...args: unknown[]) => mockStreamText(...args),
  tool: (def: unknown) => mockSdkTool(def as never),
  stepCountIs: (n: number) => ({ type: "stepCount", count: n }),
}));

const { createAgent } = await import("../src/createAgent.js");

function createMockTracker(): AITracker & { calls: Usage[] } {
  const calls: Usage[] = [];
  return { calls, record: (u: Usage) => calls.push(u) };
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

function createTestTools(): ToolMap {
  return {
    read_file: {
      description: "Read a file",
      inputSchema: z.object({ path: z.string() }),
      execute: async ({ path }) => `contents of ${path}`,
    },
  };
}

describe("createAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("run", () => {
    it("returns text and usage", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Done analyzing",
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const tracker = createMockTracker();
      const agent = createAgent(
        mockModel() as never,
        createTestTools(),
        tracker,
        mockLogger() as never
      );

      const result = await agent.run([
        { role: "user", content: "Analyze the code" },
      ]);

      expect(result.text).toBe("Done analyzing");
      expect(result.usage.inputTokens).toBe(100);
      expect(result.usage.outputTokens).toBe(50);
    });

    it("records usage via tracker", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "result",
        usage: { inputTokens: 20, outputTokens: 10 },
      });

      const tracker = createMockTracker();
      const agent = createAgent(
        mockModel() as never,
        createTestTools(),
        tracker,
        mockLogger() as never
      );

      await agent.run([{ role: "user", content: "test" }]);

      expect(tracker.calls).toHaveLength(1);
      expect(tracker.calls[0].inputTokens).toBe(20);
    });

    it("records prompt and response in usage", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Done analyzing",
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const tracker = createMockTracker();
      const agent = createAgent(
        mockModel() as never,
        createTestTools(),
        tracker,
        mockLogger() as never
      );

      await agent.run([{ role: "user", content: "Analyze the code" }]);

      expect(tracker.calls[0].prompt).toBe("Analyze the code");
      expect(tracker.calls[0].response).toBe("Done analyzing");
      expect(tracker.calls[0].systemPrompt).toBeUndefined();
    });

    it("converts ToolMap to SDK tool calls", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "done",
        usage: { inputTokens: 1, outputTokens: 1 },
      });

      const tracker = createMockTracker();
      const agent = createAgent(
        mockModel() as never,
        createTestTools(),
        tracker,
        mockLogger() as never
      );

      await agent.run([{ role: "user", content: "test" }]);

      // sdkTool should have been called once (for read_file)
      expect(mockSdkTool).toHaveBeenCalledTimes(1);
      const toolDef = mockSdkTool.mock.calls[0][0] as {
        description: string;
      };
      expect(toolDef.description).toBe("Read a file");
    });

    it("passes maxSteps and temperature as options", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "done",
        usage: { inputTokens: 1, outputTokens: 1 },
      });

      const tracker = createMockTracker();
      const agent = createAgent(
        mockModel() as never,
        createTestTools(),
        tracker,
        mockLogger() as never,
        { maxSteps: 25, temperature: 0.2 }
      );

      await agent.run([{ role: "user", content: "test" }]);

      const callArgs = mockGenerateText.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArgs).toHaveProperty("temperature", 0.2);
      expect(callArgs).toHaveProperty("stopWhen", {
        type: "stepCount",
        count: 25,
      });
    });

    it("uses default options when none provided", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "done",
        usage: { inputTokens: 1, outputTokens: 1 },
      });

      const tracker = createMockTracker();
      const agent = createAgent(
        mockModel() as never,
        createTestTools(),
        tracker,
        mockLogger() as never
      );

      await agent.run([{ role: "user", content: "test" }]);

      const callArgs = mockGenerateText.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(callArgs).toHaveProperty("temperature", 0.7);
      expect(callArgs).toHaveProperty("maxOutputTokens", 4096);
      expect(callArgs).toHaveProperty("stopWhen", {
        type: "stepCount",
        count: 10,
      });
    });

    it("auto-logs tool calls via logger", async () => {
      // Set up the mock so when generateText is called, it invokes the tool
      mockGenerateText.mockImplementationOnce(
        async (opts: Record<string, unknown>) => {
          const tools = opts.tools as Record<
            string,
            { execute: (args: Record<string, unknown>) => Promise<string> }
          >;
          await tools.read_file.execute({ path: "src/index.ts" });
          return {
            text: "done",
            usage: { inputTokens: 10, outputTokens: 5 },
          };
        }
      );

      const tracker = createMockTracker();
      const logger = mockLogger();
      const agent = createAgent(
        mockModel() as never,
        createTestTools(),
        tracker,
        logger as never
      );

      await agent.run([{ role: "user", content: "test" }]);

      // Logger should have been called with tool call and tool result
      const debugCalls = logger.debug.mock.calls.map(
        (c: unknown[]) => c[0]
      ) as string[];
      expect(debugCalls).toContain("Tool call");
      expect(debugCalls).toContain("Tool result");
    });
  });

  describe("stream", () => {
    function mockStreamResult(
      parts: Array<{ type: string; text?: string; toolName?: string }>,
      usage = { inputTokens: 10, outputTokens: 5 }
    ) {
      async function* fullStream() {
        for (const part of parts) yield part;
      }
      return {
        fullStream: fullStream(),
        usage: Promise.resolve(usage),
      };
    }

    it("calls onText for text deltas via function shorthand", async () => {
      mockStreamText.mockReturnValueOnce(
        mockStreamResult([
          { type: "text-delta", text: "Hello" },
          { type: "text-delta", text: " world" },
        ])
      );

      const tracker = createMockTracker();
      const chunks: string[] = [];
      const agent = createAgent(
        mockModel() as never,
        createTestTools(),
        tracker,
        mockLogger() as never
      );

      const result = await agent.stream(
        [{ role: "user", content: "test" }],
        (text) => chunks.push(text)
      );

      expect(chunks).toEqual(["Hello", " world"]);
      expect(result.text).toBe("Hello world");
    });

    it("calls onText for text deltas via callbacks object", async () => {
      mockStreamText.mockReturnValueOnce(
        mockStreamResult([{ type: "text-delta", text: "Hi" }])
      );

      const tracker = createMockTracker();
      const chunks: string[] = [];
      const agent = createAgent(
        mockModel() as never,
        createTestTools(),
        tracker,
        mockLogger() as never
      );

      const result = await agent.stream([{ role: "user", content: "test" }], {
        onText: (text) => chunks.push(text),
      });

      expect(chunks).toEqual(["Hi"]);
      expect(result.text).toBe("Hi");
    });

    it("records usage via tracker", async () => {
      mockStreamText.mockReturnValueOnce(
        mockStreamResult([{ type: "text-delta", text: "ok" }], {
          inputTokens: 30,
          outputTokens: 15,
        })
      );

      const tracker = createMockTracker();
      const agent = createAgent(
        mockModel() as never,
        createTestTools(),
        tracker,
        mockLogger() as never
      );

      const result = await agent.stream(
        [{ role: "user", content: "test" }],
        () => {}
      );

      expect(tracker.calls).toHaveLength(1);
      expect(result.usage.inputTokens).toBe(30);
      expect(result.usage.outputTokens).toBe(15);
    });

    it("records prompt and response in usage", async () => {
      mockStreamText.mockReturnValueOnce(
        mockStreamResult([
          { type: "text-delta", text: "Hello" },
          { type: "text-delta", text: " world" },
        ])
      );

      const tracker = createMockTracker();
      const agent = createAgent(
        mockModel() as never,
        createTestTools(),
        tracker,
        mockLogger() as never
      );

      await agent.stream([{ role: "user", content: "test prompt" }], () => {});

      expect(tracker.calls[0].prompt).toBe("test prompt");
      expect(tracker.calls[0].response).toBe("Hello world");
      expect(tracker.calls[0].systemPrompt).toBeUndefined();
    });

    it("ignores non-text parts (no crash)", async () => {
      mockStreamText.mockReturnValueOnce(
        mockStreamResult([
          { type: "text-delta", text: "Before" },
          { type: "tool-call", toolName: "read_file" },
          { type: "tool-result" },
          { type: "text-delta", text: " After" },
        ])
      );

      const tracker = createMockTracker();
      const chunks: string[] = [];
      const agent = createAgent(
        mockModel() as never,
        createTestTools(),
        tracker,
        mockLogger() as never
      );

      const result = await agent.stream(
        [{ role: "user", content: "test" }],
        (text) => chunks.push(text)
      );

      expect(chunks).toEqual(["Before", " After"]);
      expect(result.text).toBe("Before After");
    });
  });
});
