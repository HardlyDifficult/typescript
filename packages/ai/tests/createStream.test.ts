import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AITracker, Usage } from "../src/types.js";

// Mock the AI SDK
const mockStreamText = vi.fn();
vi.mock("ai", () => ({
  streamText: (...args: unknown[]) => mockStreamText(...args),
}));

const { runStream } = await import("../src/createStream.js");

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

/** Create a mock streamText result that yields the given chunks. */
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

describe("runStream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onText for each chunk and returns accumulated text", async () => {
    mockStreamText.mockReturnValueOnce(mockStreamResult(["Hello", " world"]));

    const tracker = createMockTracker();
    const chunks: string[] = [];

    const result = await runStream(
      mockModel() as never,
      tracker,
      mockLogger() as never,
      [{ role: "user", content: "Hi" }],
      (text) => chunks.push(text)
    );

    expect(chunks).toEqual(["Hello", " world"]);
    expect(result.text).toBe("Hello world");
  });

  it("records usage via tracker", async () => {
    mockStreamText.mockReturnValueOnce(
      mockStreamResult(["test"], { inputTokens: 15, outputTokens: 8 })
    );

    const tracker = createMockTracker();
    const result = await runStream(
      mockModel() as never,
      tracker,
      mockLogger() as never,
      [{ role: "user", content: "prompt" }],
      () => {}
    );

    expect(tracker.calls).toHaveLength(1);
    expect(tracker.calls[0].inputTokens).toBe(15);
    expect(tracker.calls[0].outputTokens).toBe(8);
    expect(result.usage.inputTokens).toBe(15);
    expect(result.usage.outputTokens).toBe(8);
  });

  it("records prompt and response in usage", async () => {
    mockStreamText.mockReturnValueOnce(mockStreamResult(["Hello", " world"]));

    const tracker = createMockTracker();
    await runStream(
      mockModel() as never,
      tracker,
      mockLogger() as never,
      [{ role: "user", content: "Say hi" }],
      () => {}
    );

    expect(tracker.calls[0].prompt).toBe("Say hi");
    expect(tracker.calls[0].response).toBe("Hello world");
    expect(tracker.calls[0].systemPrompt).toBeUndefined();
  });

  it("passes maxTokens and temperature to streamText", async () => {
    mockStreamText.mockReturnValueOnce(mockStreamResult(["ok"]));

    const tracker = createMockTracker();
    await runStream(
      mockModel() as never,
      tracker,
      mockLogger() as never,
      [{ role: "user", content: "test" }],
      () => {},
      2000,
      0.3
    );

    const callArgs = mockStreamText.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs).toHaveProperty("maxOutputTokens", 2000);
    expect(callArgs).toHaveProperty("temperature", 0.3);
  });

  it("logs debug messages before and after streaming", async () => {
    mockStreamText.mockReturnValueOnce(mockStreamResult(["hi"]));

    const tracker = createMockTracker();
    const logger = mockLogger();
    await runStream(
      mockModel() as never,
      tracker,
      logger as never,
      [{ role: "user", content: "test" }],
      () => {}
    );

    expect(logger.debug).toHaveBeenCalledTimes(2);
    expect(logger.debug).toHaveBeenNthCalledWith(1, "AI stream start", {
      messageCount: 1,
    });
    expect(logger.debug).toHaveBeenNthCalledWith(
      2,
      "AI stream complete",
      expect.objectContaining({ responseLength: 2 })
    );
  });

  it("handles missing usage fields gracefully", async () => {
    mockStreamText.mockReturnValueOnce(mockStreamResult(["text"], {} as never));

    const tracker = createMockTracker();
    const result = await runStream(
      mockModel() as never,
      tracker,
      mockLogger() as never,
      [{ role: "user", content: "test" }],
      () => {}
    );

    expect(result.usage.inputTokens).toBe(0);
    expect(result.usage.outputTokens).toBe(0);
  });
});
