import { describe, expect, it } from "vitest";

import { parseCliArgs, resolveCliArgs } from "../src/cliArgs.js";

describe("parseCliArgs", () => {
  it("parses positional message and flags", () => {
    const parsed = parseCliArgs([
      "hello team",
      "--bot-url",
      "https://primary.example",
      "--fallback-url",
      "https://fallback.example",
      "--max-retries",
      "3",
    ]);

    expect(parsed.firstMessage).toBe("hello team");
    expect(parsed.botUrl).toBe("https://primary.example");
    expect(parsed.fallbackUrls).toEqual(["https://fallback.example"]);
    expect(parsed.maxRetries).toBe(3);
  });

  it("throws for unknown options", () => {
    expect(() => parseCliArgs(["--wat"])).toThrow("Unknown option");
  });
});

describe("resolveCliArgs", () => {
  it("resolves defaults from env", () => {
    const parsed = parseCliArgs(["call me"]);
    const resolved = resolveCliArgs(parsed, {
      COWORK_API_KEY: "token-123",
      COWORK_BOT_URL: "https://primary.example",
      COWORK_BOT_URL_FALLBACKS: "https://f1.example,https://f2.example",
      COWORK_TIMEOUT_SECONDS: "120",
      COWORK_POLL_INTERVAL_SECONDS: "5",
    });

    expect(resolved.apiKey).toBe("token-123");
    expect(resolved.endpoints).toEqual([
      "https://primary.example",
      "https://f1.example",
      "https://f2.example",
    ]);
    expect(resolved.timeoutSeconds).toBe(120);
    expect(resolved.pollIntervalSeconds).toBe(5);
    expect(resolved.firstMessage).toBe("call me");
  });

  it("requires api key", () => {
    const parsed = parseCliArgs(["call me"]);
    expect(() => resolveCliArgs(parsed, {})).toThrow("API key is required");
  });

  it("requires first message unless poll-only", () => {
    const parsed = parseCliArgs([]);
    expect(() =>
      resolveCliArgs(parsed, {
        COWORK_API_KEY: "token",
      }),
    ).toThrow("First message is required");

    const pollOnly = parseCliArgs(["--poll-only", "--source", "abc"]);
    const resolved = resolveCliArgs(pollOnly, { COWORK_API_KEY: "token" });
    expect(resolved.pollOnly).toBe(true);
  });
});
