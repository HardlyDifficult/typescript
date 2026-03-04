import { describe, expect, it } from "vitest";

import { parseCliArgs, resolveCliArgs } from "../src/cliArgs.js";

describe("parseCliArgs", () => {
  it("parses positional message and minimal flags", () => {
    const parsed = parseCliArgs([
      "hello team",
      "--endpoint",
      "https://api.example.com",
      "--api-token",
      "token-1",
    ]);

    expect(parsed.firstMessage).toBe("hello team");
    expect(parsed.endpoint).toBe("https://api.example.com");
    expect(parsed.apiToken).toBe("token-1");
  });

  it("throws for unknown options", () => {
    expect(() => parseCliArgs(["--wat"])).toThrow("Unknown option");
  });
});

describe("resolveCliArgs", () => {
  it("resolves required values from env", () => {
    const parsed = parseCliArgs(["call me"]);
    const resolved = resolveCliArgs(parsed, {
      CALL_API_TOKEN: "token-123",
      CALL_API_ENDPOINT: "https://api.example.com",
    });

    expect(resolved.apiToken).toBe("token-123");
    expect(resolved.endpoint).toBe("https://api.example.com");
    expect(resolved.firstMessage).toBe("call me");
  });

  it("requires API token", () => {
    const parsed = parseCliArgs([
      "call me",
      "--endpoint",
      "https://api.example.com",
    ]);
    expect(() => resolveCliArgs(parsed, {})).toThrow("API token is required");
  });

  it("requires endpoint", () => {
    const parsed = parseCliArgs(["call me", "--api-token", "token"]);
    expect(() => resolveCliArgs(parsed, {})).toThrow("Endpoint is required");
  });

  it("requires first message", () => {
    const parsed = parseCliArgs([
      "--api-token",
      "token",
      "--endpoint",
      "https://api.example.com",
    ]);
    expect(() => resolveCliArgs(parsed, {})).toThrow(
      "First message is required"
    );
  });

  it("defaults strategy to poll", () => {
    const parsed = parseCliArgs(["call me"]);
    const resolved = resolveCliArgs(parsed, {
      CALL_API_TOKEN: "token-123",
      CALL_API_ENDPOINT: "https://api.example.com",
    });
    expect(resolved.strategy).toBe("poll");
  });

  it("accepts strategy flag values", () => {
    for (const strategy of ["poll", "long-poll", "sse"]) {
      const parsed = parseCliArgs(["call me", "--strategy", strategy]);
      const resolved = resolveCliArgs(parsed, {
        CALL_API_TOKEN: "token-123",
        CALL_API_ENDPOINT: "https://api.example.com",
      });
      expect(resolved.strategy).toBe(strategy);
    }
  });

  it("rejects unknown strategy values", () => {
    const parsed = parseCliArgs(["call me", "--strategy", "websocket"]);
    expect(() =>
      resolveCliArgs(parsed, {
        CALL_API_TOKEN: "token",
        CALL_API_ENDPOINT: "https://api.example.com",
      })
    ).toThrow('Invalid strategy "websocket"');
  });

  it("reads strategy from CALL_STRATEGY env var", () => {
    const parsed = parseCliArgs(["call me"]);
    const resolved = resolveCliArgs(parsed, {
      CALL_API_TOKEN: "token",
      CALL_API_ENDPOINT: "https://api.example.com",
      CALL_STRATEGY: "sse",
    });
    expect(resolved.strategy).toBe("sse");
  });
});
