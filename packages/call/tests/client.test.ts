import { describe, expect, it, vi } from "vitest";

import { CallClient } from "../src/client.js";

describe("CallClient - poll strategy (default)", () => {
  it("retries when endpoint is temporarily unavailable", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ queued: true, position: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
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
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: "completed", transcript: "done" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
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

describe("CallClient - long-poll strategy", () => {
  it("reconnects immediately without sleep and returns on terminal status", async () => {
    const fetchImpl = vi
      .fn()
      // First long-poll: server holds and returns non-terminal status
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "in-progress" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
      // Second long-poll: status changed to completed
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: "completed", transcript: "hi" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      );

    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const events: string[] = [];

    const client = new CallClient({
      endpoint: "https://api.example.com",
      apiToken: "token",
      maxRetries: 0,
      requestTimeoutMs: 1000,
      longPollWaitSecs: 10,
      fetchImpl,
      sleepFn,
    });

    const result = await client.longPollStatus({
      source: "call-test",
      timeoutMs: 10_000,
      pollIntervalMs: 1000,
      onPoll: (event) => {
        events.push(event.status);
      },
    });

    expect(result.status).toBe("completed");
    expect(result.payload.transcript).toBe("hi");
    expect(events).toEqual(["in-progress", "completed"]);
    // No sleep between iterations (only sleeps on error)
    expect(sleepFn).not.toHaveBeenCalled();
    // URL should include the wait query parameter
    const calledUrl = fetchImpl.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("?wait=10");
  });

  it("dispatches to longPollStatus when strategy is 'long-poll'", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ status: "completed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

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
      pollIntervalMs: 1000,
      strategy: "long-poll",
    });

    expect(result.status).toBe("completed");
    const calledUrl = fetchImpl.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("?wait=");
  });

  it("sleeps briefly and retries on error", async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network error"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "completed" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const events: string[] = [];

    const client = new CallClient({
      endpoint: "https://api.example.com",
      apiToken: "token",
      maxRetries: 0,
      requestTimeoutMs: 1000,
      retryBaseMs: 50,
      fetchImpl,
      sleepFn,
    });

    const result = await client.longPollStatus({
      source: "call-test",
      timeoutMs: 10_000,
      pollIntervalMs: 1000,
      onPoll: (event) => {
        events.push(event.status);
      },
    });

    expect(result.status).toBe("completed");
    expect(events).toContain("error");
    expect(sleepFn).toHaveBeenCalledOnce();
  });
});

describe("CallClient - SSE strategy", () => {
  function makeSseResponse(sseBody: string): Response {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(sseBody));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  it("reads SSE events and returns on terminal status", async () => {
    const sseData = [
      'data: {"status":"queued"}\n\n',
      'data: {"status":"in-progress"}\n\n',
      'data: {"status":"completed","transcript":"hello"}\n\n',
    ].join("");

    const fetchImpl = vi.fn().mockResolvedValue(makeSseResponse(sseData));
    const events: string[] = [];

    const client = new CallClient({
      endpoint: "https://api.example.com",
      apiToken: "token",
      fetchImpl,
      sleepFn: async () => Promise.resolve(),
    });

    const result = await client.sseStatus({
      source: "call-test",
      timeoutMs: 10_000,
      pollIntervalMs: 1000,
      onPoll: (event) => {
        events.push(event.status);
      },
    });

    expect(result.status).toBe("completed");
    expect(result.payload.transcript).toBe("hello");
    expect(events).toEqual(["queued", "in-progress", "completed"]);
  });

  it("dispatches to sseStatus when strategy is 'sse'", async () => {
    const sseData = 'data: {"status":"completed"}\n\n';
    const fetchImpl = vi.fn().mockResolvedValue(makeSseResponse(sseData));

    const client = new CallClient({
      endpoint: "https://api.example.com",
      apiToken: "token",
      fetchImpl,
      sleepFn: async () => Promise.resolve(),
    });

    const result = await client.pollStatus({
      source: "call-test",
      timeoutMs: 5000,
      pollIntervalMs: 1000,
      strategy: "sse",
    });

    expect(result.status).toBe("completed");
    const calledUrl = fetchImpl.mock.calls[0]?.[0] as string;
    expect(calledUrl).toContain("/call/events/");
  });

  it("ignores non-JSON SSE messages and SSE comments", async () => {
    const sseData = [
      ": heartbeat\n\n",
      "data: not-json\n\n",
      'data: {"status":"failed"}\n\n',
    ].join("");

    const fetchImpl = vi.fn().mockResolvedValue(makeSseResponse(sseData));

    const client = new CallClient({
      endpoint: "https://api.example.com",
      apiToken: "token",
      fetchImpl,
      sleepFn: async () => Promise.resolve(),
    });

    const result = await client.sseStatus({
      source: "call-test",
      timeoutMs: 5000,
      pollIntervalMs: 1000,
    });

    expect(result.status).toBe("failed");
  });

  it("reconnects on stream error and succeeds on second attempt", async () => {
    const sseData = 'data: {"status":"completed"}\n\n';

    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("connection reset"))
      .mockResolvedValueOnce(makeSseResponse(sseData));

    const sleepFn = vi.fn().mockResolvedValue(undefined);
    const events: string[] = [];

    const client = new CallClient({
      endpoint: "https://api.example.com",
      apiToken: "token",
      retryBaseMs: 1,
      fetchImpl,
      sleepFn,
    });

    const result = await client.sseStatus({
      source: "call-test",
      timeoutMs: 10_000,
      pollIntervalMs: 1000,
      onPoll: (event) => {
        events.push(event.status);
      },
    });

    expect(result.status).toBe("completed");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(events).toContain("error");
    expect(events).toContain("completed");
  });

  it("uses the SSE events path prefix", async () => {
    const sseData = 'data: {"status":"completed"}\n\n';
    const fetchImpl = vi.fn().mockResolvedValue(makeSseResponse(sseData));

    const client = new CallClient({
      endpoint: "https://api.example.com",
      apiToken: "token",
      ssePathPrefix: "/v2/call/stream",
      fetchImpl,
      sleepFn: async () => Promise.resolve(),
    });

    await client.sseStatus({
      source: "my-source",
      timeoutMs: 5000,
      pollIntervalMs: 1000,
    });

    const calledUrl = fetchImpl.mock.calls[0]?.[0] as string;
    expect(calledUrl).toBe(
      "https://api.example.com/v2/call/stream/my-source"
    );
  });

  it("includes Accept: text/event-stream header", async () => {
    const sseData = 'data: {"status":"completed"}\n\n';
    const fetchImpl = vi.fn().mockResolvedValue(makeSseResponse(sseData));

    const client = new CallClient({
      endpoint: "https://api.example.com",
      apiToken: "token",
      fetchImpl,
      sleepFn: async () => Promise.resolve(),
    });

    await client.sseStatus({
      source: "src",
      timeoutMs: 5000,
      pollIntervalMs: 1000,
    });

    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect((init.headers as Record<string, string>)["Accept"]).toBe(
      "text/event-stream"
    );
  });
});
