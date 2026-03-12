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
        usage: { inputTokens: 100, outputTokens: 50, inputTokenDetails: {} },
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
        usage: { inputTokens: 20, outputTokens: 10, inputTokenDetails: {} },
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
        usage: { inputTokens: 100, outputTokens: 50, inputTokenDetails: {} },
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

    it("accepts plain string prompts and injects the default system prompt", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "Done analyzing",
        usage: { inputTokens: 100, outputTokens: 50, inputTokenDetails: {} },
      });

      const tracker = createMockTracker();
      const agent = createAgent(
        mockModel() as never,
        createTestTools(),
        tracker,
        mockLogger() as never,
        { systemPrompt: "Use tools first" }
      );

      await agent.run("Analyze the code");

      const callArgs = mockGenerateText.mock.calls[0][0] as {
        messages: Array<Record<string, unknown>>;
      };

      expect(callArgs.messages).toEqual([
        {
          role: "system",
          content: "Use tools first",
          providerOptions: {
            anthropic: { cacheControl: { type: "ephemeral" } },
          },
        },
        { role: "user", content: "Analyze the code" },
      ]);
      expect(tracker.calls[0].systemPrompt).toBe("Use tools first");
    });

    it("converts ToolMap to SDK tool calls", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "done",
        usage: { inputTokens: 1, outputTokens: 1, inputTokenDetails: {} },
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
        usage: { inputTokens: 1, outputTokens: 1, inputTokenDetails: {} },
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
        usage: { inputTokens: 1, outputTokens: 1, inputTokenDetails: {} },
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
            usage: { inputTokens: 10, outputTokens: 5, inputTokenDetails: {} },
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

    it("logs cacheCreationTokens and cacheReadTokens in run() debug (lines 178-183)", async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: "done",
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          inputTokenDetails: {
            cacheWriteTokens: 80,
            cacheReadTokens: 40,
          },
        },
      });

      const tracker = createMockTracker();
      const logger = mockLogger();
      const agent = createAgent(
        mockModel() as never,
        createTestTools(),
        tracker,
        logger as never
      );

      await agent.run([{ role: "user", content: "test" }]);

      const debugCalls = logger.debug.mock.calls as Array<[string, Record<string, unknown>]>;
      const completeCall = debugCalls.find((c) => c[0] === "Agent run complete");
      expect(completeCall).toBeDefined();
      expect(completeCall![1].cacheCreationTokens).toBe(80);
      expect(completeCall![1].cacheReadTokens).toBe(40);
    });

    it("logs outputType=null when tool returns null (covers line 95)", async () => {
      mockGenerateText.mockImplementationOnce(
        async (opts: Record<string, unknown>) => {
          const tools = opts.tools as Record<
            string,
            { execute: (args: Record<string, unknown>) => Promise<unknown> }
          >;
          await tools.null_tool.execute({});
          return {
            text: "done",
            usage: { inputTokens: 1, outputTokens: 1, inputTokenDetails: {} },
          };
        }
      );

      const tracker = createMockTracker();
      const logger = mockLogger();
      const agent = createAgent(
        mockModel() as never,
        {
          null_tool: {
            description: "Returns null",
            inputSchema: z.object({}),
            execute: async () => null,
          },
        },
        tracker,
        logger as never
      );

      await agent.run([{ role: "user", content: "test" }]);

      const debugCalls = logger.debug.mock.calls as Array<[string, Record<string, unknown>]>;
      const toolResultCall = debugCalls.find((c) => c[0] === "Tool result");
      expect(toolResultCall).toBeDefined();
      expect(toolResultCall![1].outputType).toBe("null");
    });

    it("logs outputType=array when tool returns array (covers line 98)", async () => {
      mockGenerateText.mockImplementationOnce(
        async (opts: Record<string, unknown>) => {
          const tools = opts.tools as Record<
            string,
            { execute: (args: Record<string, unknown>) => Promise<unknown> }
          >;
          await tools.array_tool.execute({});
          return {
            text: "done",
            usage: { inputTokens: 1, outputTokens: 1, inputTokenDetails: {} },
          };
        }
      );

      const tracker = createMockTracker();
      const logger = mockLogger();
      const agent = createAgent(
        mockModel() as never,
        {
          array_tool: {
            description: "Returns array",
            inputSchema: z.object({}),
            execute: async () => [1, 2, 3],
          },
        },
        tracker,
        logger as never
      );

      await agent.run([{ role: "user", content: "test" }]);

      const debugCalls = logger.debug.mock.calls as Array<[string, Record<string, unknown>]>;
      const toolResultCall = debugCalls.find((c) => c[0] === "Tool result");
      expect(toolResultCall).toBeDefined();
      expect(toolResultCall![1].outputType).toBe("array");
    });
  });

  describe("stream", () => {
    function mockStreamResult(
      parts: Array<{ type: string; text?: string; toolName?: string }>,
      usage: Record<string, unknown> = { inputTokens: 10, outputTokens: 5 }
    ) {
      async function* fullStream() {
        for (const part of parts) yield part;
      }
      return {
        fullStream: fullStream(),
        usage: Promise.resolve({ inputTokenDetails: {}, ...usage }),
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

    it("passes structured tool results to callbacks", async () => {
      mockStreamText.mockImplementationOnce(
        (
          options: Record<
            string,
            Record<
              string,
              { execute: (args: Record<string, unknown>) => Promise<unknown> }
            >
          >
        ) => {
          const tools = options.tools;

          async function* fullStream() {
            await tools.read_file.execute({ path: "src/index.ts" });
            yield { type: "text-delta", text: "Done" };
          }

          return {
            fullStream: fullStream(),
            usage: Promise.resolve({
              inputTokens: 10,
              outputTokens: 5,
              inputTokenDetails: {},
            }),
          };
        }
      );

      const tracker = createMockTracker();
      const results: unknown[] = [];
      const agent = createAgent(
        mockModel() as never,
        {
          read_file: {
            description: "Read a file",
            inputSchema: z.object({ path: z.string() }),
            execute: ({ path }) => ({ path, contents: "hello" }),
          },
        },
        tracker,
        mockLogger() as never
      );

      await agent.stream("test", {
        onText() {},
        onToolResult: (_name, result) => results.push(result),
      });

      expect(results).toEqual([{ path: "src/index.ts", contents: "hello" }]);
    });
  });
});
