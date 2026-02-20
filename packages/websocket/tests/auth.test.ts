import { describe, it, expect, vi } from "vitest";
import { WebSocketServer, type WebSocket as WsType } from "ws";
import { ReconnectingWebSocket } from "../src/ReconnectingWebSocket.js";

async function createServer(): Promise<{
  server: WebSocketServer;
  url: string;
}> {
  return new Promise((resolve) => {
    const server = new WebSocketServer({ port: 0 });
    server.on("listening", () => {
      const addr = server.address() as { port: number };
      resolve({ server, url: `ws://127.0.0.1:${addr.port}` });
    });
  });
}

function closeServer(server: WebSocketServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function waitFor(
  condition: () => boolean,
  timeoutMs = 2000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("waitFor timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("ReconnectingWebSocket auth", () => {
  it("sends Authorization header when auth is configured", async () => {
    const { server, url } = await createServer();
    let receivedHeaders: Record<string, string> = {};

    server.on("connection", (_ws: WsType, req) => {
      receivedHeaders = req.headers as Record<string, string>;
    });

    const client = new ReconnectingWebSocket({
      url,
      auth: { getToken: () => "my-secret-token" },
    });

    const opened = vi.fn();
    client.on("open", opened);
    client.connect();
    await waitFor(() => opened.mock.calls.length > 0);

    expect(receivedHeaders["authorization"]).toBe("Bearer my-secret-token");

    client.disconnect();
    await closeServer(server);
  });

  it("calls getToken on each reconnect", async () => {
    const { server, url } = await createServer();
    const tokens: string[] = [];
    let tokenCounter = 0;

    server.on("connection", (_ws: WsType, req) => {
      const auth = req.headers["authorization"];
      if (auth) tokens.push(auth);
    });

    const getToken = vi.fn(() => {
      tokenCounter++;
      return `token-${tokenCounter}`;
    });

    const client = new ReconnectingWebSocket({
      url,
      auth: { getToken },
      backoff: { initialDelayMs: 20, maxDelayMs: 100, multiplier: 2 },
    });

    let openCount = 0;
    client.on("open", () => {
      openCount++;
    });

    client.connect();
    await waitFor(() => openCount === 1);

    // Force server-initiated close to trigger reconnect
    for (const ws of server.clients) ws.terminate();
    await waitFor(() => openCount >= 2, 3000);

    expect(getToken).toHaveBeenCalledTimes(2);
    expect(tokens[0]).toBe("Bearer token-1");
    expect(tokens[1]).toBe("Bearer token-2");

    client.disconnect();
    await closeServer(server);
  });

  it("supports async getToken", async () => {
    const { server, url } = await createServer();
    let receivedAuth = "";

    server.on("connection", (_ws: WsType, req) => {
      receivedAuth = req.headers["authorization"] ?? "";
    });

    const client = new ReconnectingWebSocket({
      url,
      auth: {
        getToken: async () => {
          await new Promise((r) => setTimeout(r, 10));
          return "async-token";
        },
      },
    });

    const opened = vi.fn();
    client.on("open", opened);
    client.connect();
    await waitFor(() => opened.mock.calls.length > 0);

    expect(receivedAuth).toBe("Bearer async-token");

    client.disconnect();
    await closeServer(server);
  });

  it("sends custom headers alongside auth", async () => {
    const { server, url } = await createServer();
    let receivedHeaders: Record<string, string> = {};

    server.on("connection", (_ws: WsType, req) => {
      receivedHeaders = req.headers as Record<string, string>;
    });

    const client = new ReconnectingWebSocket({
      url,
      auth: { getToken: () => "tok" },
      headers: { "X-Custom": "value" },
    });

    const opened = vi.fn();
    client.on("open", opened);
    client.connect();
    await waitFor(() => opened.mock.calls.length > 0);

    expect(receivedHeaders["authorization"]).toBe("Bearer tok");
    expect(receivedHeaders["x-custom"]).toBe("value");

    client.disconnect();
    await closeServer(server);
  });

  it("reconnect() forces reconnection with fresh token", async () => {
    const { server, url } = await createServer();
    let tokenCounter = 0;
    const getToken = vi.fn(() => {
      tokenCounter++;
      return `token-${tokenCounter}`;
    });

    const client = new ReconnectingWebSocket({
      url,
      auth: { getToken },
    });

    let openCount = 0;
    client.on("open", () => {
      openCount++;
    });

    client.connect();
    await waitFor(() => openCount === 1);

    client.reconnect();
    await waitFor(() => openCount === 2, 3000);

    expect(getToken).toHaveBeenCalledTimes(2);

    client.disconnect();
    await closeServer(server);
  });

  it("emits error and schedules reconnect when getToken throws", async () => {
    const { server, url } = await createServer();
    let callCount = 0;

    const client = new ReconnectingWebSocket({
      url,
      auth: {
        getToken: () => {
          callCount++;
          if (callCount === 1) throw new Error("token fetch failed");
          return "valid-token";
        },
      },
      backoff: { initialDelayMs: 20, maxDelayMs: 100, multiplier: 2 },
    });

    const errors: string[] = [];
    client.on("error", (err) => errors.push(err.message));

    const opened = vi.fn();
    client.on("open", opened);
    client.connect();

    // Should recover on reconnect
    await waitFor(() => opened.mock.calls.length > 0, 3000);

    expect(errors[0]).toBe("token fetch failed");
    expect(callCount).toBeGreaterThanOrEqual(2);

    client.disconnect();
    await closeServer(server);
  });
});
