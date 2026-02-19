import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { WebSocketServer, type WebSocket as WSType } from "ws";
import {
  ReconnectingWebSocket,
  getBackoffDelay,
} from "../src/ReconnectingWebSocket.js";
import type { BackoffOptions } from "../src/types.js";

interface TestMessage {
  type: string;
  value?: number;
}

/** Create a WebSocketServer on a random port and return it with the port number. */
function createServer(): Promise<{ server: WebSocketServer; port: number }> {
  return new Promise((resolve) => {
    const server = new WebSocketServer({ port: 0 });
    server.on("listening", () => {
      const addr = server.address();
      const port = typeof addr === "object" ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

/** Wait for the server to receive a new connection. */
function waitForConnection(
  server: WebSocketServer,
): Promise<WSType> {
  return new Promise((resolve) => {
    server.once("connection", resolve);
  });
}

describe("getBackoffDelay", () => {
  const defaults: Required<BackoffOptions> = {
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    multiplier: 2,
  };

  it("returns initialDelayMs on first attempt", () => {
    expect(getBackoffDelay(0, defaults)).toBe(1000);
  });

  it("applies multiplier", () => {
    expect(getBackoffDelay(1, defaults)).toBe(2000);
    expect(getBackoffDelay(2, defaults)).toBe(4000);
    expect(getBackoffDelay(3, defaults)).toBe(8000);
  });

  it("caps at maxDelayMs", () => {
    expect(getBackoffDelay(10, defaults)).toBe(30000);
  });
});

describe("ReconnectingWebSocket", () => {
  let server: WebSocketServer;
  let port: number;

  beforeEach(async () => {
    const created = await createServer();
    server = created.server;
    port = created.port;
  });

  afterEach(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("connects and fires open event", async () => {
    const ws = new ReconnectingWebSocket<TestMessage>({
      url: `ws://127.0.0.1:${port}`,
    });

    const opened = new Promise<void>((resolve) => {
      ws.on("open", resolve);
    });

    ws.connect();
    await opened;
    expect(ws.connected).toBe(true);
    ws.disconnect();
  });

  it("receives and parses JSON messages", async () => {
    const ws = new ReconnectingWebSocket<TestMessage>({
      url: `ws://127.0.0.1:${port}`,
    });

    const connPromise = waitForConnection(server);
    const opened = new Promise<void>((resolve) => {
      ws.on("open", resolve);
    });

    ws.connect();
    const [serverSocket] = await Promise.all([connPromise, opened]);

    const received = new Promise<TestMessage>((resolve) => {
      ws.on("message", resolve);
    });

    serverSocket.send(JSON.stringify({ type: "hello", value: 42 }));

    const msg = await received;
    expect(msg).toEqual({ type: "hello", value: 42 });
    ws.disconnect();
  });

  it("sends JSON messages that server can receive", async () => {
    const ws = new ReconnectingWebSocket<TestMessage>({
      url: `ws://127.0.0.1:${port}`,
    });

    const connPromise = waitForConnection(server);
    const opened = new Promise<void>((resolve) => {
      ws.on("open", resolve);
    });

    ws.connect();
    const [serverSocket] = await Promise.all([connPromise, opened]);

    const received = new Promise<TestMessage>((resolve) => {
      serverSocket.on("message", (data) => {
        resolve(JSON.parse(data.toString()));
      });
    });

    ws.send({ type: "ping", value: 1 });
    const msg = await received;
    expect(msg).toEqual({ type: "ping", value: 1 });
    ws.disconnect();
  });

  it("silently drops send when disconnected", () => {
    const ws = new ReconnectingWebSocket<TestMessage>({
      url: `ws://127.0.0.1:${port}`,
    });
    // Should not throw
    ws.send({ type: "noop" });
    expect(ws.connected).toBe(false);
  });

  it("connect is idempotent", async () => {
    const ws = new ReconnectingWebSocket<TestMessage>({
      url: `ws://127.0.0.1:${port}`,
    });

    const opened = new Promise<void>((resolve) => {
      ws.on("open", resolve);
    });

    ws.connect();
    ws.connect(); // Should be a no-op
    await opened;
    expect(ws.connected).toBe(true);
    ws.disconnect();
  });

  it("disconnect stops reconnection", async () => {
    vi.useFakeTimers();

    const ws = new ReconnectingWebSocket<TestMessage>({
      url: `ws://127.0.0.1:${port}`,
      backoff: { initialDelayMs: 100 },
    });

    const connPromise = waitForConnection(server);
    const opened = new Promise<void>((resolve) => {
      ws.on("open", resolve);
    });

    ws.connect();
    const [serverSocket] = await Promise.all([connPromise, opened]);

    // Disconnect from client side
    ws.disconnect();
    expect(ws.connected).toBe(false);

    // Close server socket to ensure it's fully cleaned
    serverSocket.close();

    // Advance time past any potential reconnect delays
    await vi.advanceTimersByTimeAsync(60000);

    // Should still be disconnected — no reconnection
    expect(ws.connected).toBe(false);

    vi.useRealTimers();
  });

  it("stopReconnecting prevents reconnect but keeps connection alive", async () => {
    const ws = new ReconnectingWebSocket<TestMessage>({
      url: `ws://127.0.0.1:${port}`,
    });

    const connPromise = waitForConnection(server);
    const opened = new Promise<void>((resolve) => {
      ws.on("open", resolve);
    });

    ws.connect();
    const [serverSocket] = await Promise.all([connPromise, opened]);

    ws.stopReconnecting();

    // Connection should still be alive
    expect(ws.connected).toBe(true);

    // Force close from server
    const closed = new Promise<void>((resolve) => {
      ws.on("close", () => resolve());
    });
    serverSocket.close();
    await closed;

    // Should not reconnect
    expect(ws.connected).toBe(false);

    ws.disconnect();
  });

  it("connected getter reflects state", async () => {
    const ws = new ReconnectingWebSocket<TestMessage>({
      url: `ws://127.0.0.1:${port}`,
    });

    expect(ws.connected).toBe(false);

    const opened = new Promise<void>((resolve) => {
      ws.on("open", resolve);
    });

    ws.connect();
    await opened;
    expect(ws.connected).toBe(true);

    ws.disconnect();
    expect(ws.connected).toBe(false);
  });

  it("fires error event for invalid JSON", async () => {
    const ws = new ReconnectingWebSocket<TestMessage>({
      url: `ws://127.0.0.1:${port}`,
    });

    const connPromise = waitForConnection(server);
    const opened = new Promise<void>((resolve) => {
      ws.on("open", resolve);
    });

    ws.connect();
    const [serverSocket] = await Promise.all([connPromise, opened]);

    const errPromise = new Promise<Error>((resolve) => {
      ws.on("error", resolve);
    });

    serverSocket.send("not valid json{{{");
    const err = await errPromise;
    expect(err).toBeInstanceOf(Error);

    ws.disconnect();
  });

  it("on returns working unsubscribe function", async () => {
    const ws = new ReconnectingWebSocket<TestMessage>({
      url: `ws://127.0.0.1:${port}`,
    });

    const listener = vi.fn();
    const unsub = ws.on("open", listener);
    unsub();

    const opened = new Promise<void>((resolve) => {
      ws.on("open", resolve);
    });

    ws.connect();
    await opened;

    expect(listener).not.toHaveBeenCalled();
    ws.disconnect();
  });
});
