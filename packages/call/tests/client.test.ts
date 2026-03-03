import { describe, expect, it, vi } from "vitest";

import { CallClient } from "../src/client.js";

describe("CallClient", () => {
  it("retries when endpoint is temporarily unavailable", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ queued: true, position: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const client = new CallClient({
      endpoint: "https://api.example.com",
      apiToken: "token",
      maxRetries: 2,
      requestTimeoutMs: 1000,
      retryBaseMs: 1,
      maxRetryDelayMs: 2,
      fetchImpl,
      sleepFn: async () => Promise.resolve(),
    });

    const response = await client.submitCall({
      firstMessage: "hello",
      systemPrompt: "be concise",
      source: "call-test",
    });

    expect(response.queued).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("polls through transient errors and returns completed", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("temporary network"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "queued" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: "completed", transcript: "done" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    const events: string[] = [];
    const client = new CallClient({
      endpoint: "https://api.example.com",
      apiToken: "token",
      maxRetries: 0,
      requestTimeoutMs: 1000,
      fetchImpl,
      sleepFn: async () => Promise.resolve(),
    });

    const result = await client.pollStatus({
      source: "call-test",
      timeoutMs: 5000,
      pollIntervalMs: 1,
      onPoll: (event) => {
        events.push(event.status);
      },
    });

    expect(result.status).toBe("completed");
    expect(result.payload.transcript).toBe("done");
    expect(events).toContain("error");
    expect(events).toContain("queued");
    expect(events).toContain("completed");
  });
});
