import { describe, it, expect, vi } from "vitest";
import { WebSocketServer } from "ws";
import {
  ReconnectingWebSocket,
  getBackoffDelay,
} from "../src/ReconnectingWebSocket.js";

/** Start a WebSocketServer on a random port, return it and its URL. */
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

/** Close a server and wait for it to finish. */
function closeServer(server: WebSocketServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

/** Wait for a condition to become true, polling every 10ms. */
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

describe("ReconnectingWebSocket", () => {
  describe("getBackoffDelay", () => {
    const opts = { initialDelayMs: 1000, maxDelayMs: 30000, multiplier: 2 };

    it("returns initial delay for attempt 0", () => {
      expect(getBackoffDelay(0, opts)).toBe(1000);
    });

    it("doubles on each attempt", () => {
      expect(getBackoffDelay(1, opts)).toBe(2000);
      expect(getBackoffDelay(2, opts)).toBe(4000);
    });

    it("caps at maxDelayMs", () => {
      expect(getBackoffDelay(10, opts)).toBe(30000);
    });
  });

  describe("connect / open event", () => {
    it("fires open when connected", async () => {
      const { server, url } = await createServer();
      const client = new ReconnectingWebSocket({ url });
      const opened = vi.fn();
      client.on("open", opened);

      client.connect();
      await waitFor(() => opened.mock.calls.length > 0);

      expect(opened).toHaveBeenCalledOnce();
      client.disconnect();
      await closeServer(server);
    });
  });

  describe("message parsing", () => {
    it("receives and parses JSON messages", async () => {
      const { server, url } = await createServer();
      const client = new ReconnectingWebSocket<{ foo: string }>({ url });
      const received = vi.fn();
      client.on("message", received);

      server.on("connection", (ws) => {
        ws.send(JSON.stringify({ foo: "bar" }));
      });

      client.connect();
      await waitFor(() => received.mock.calls.length > 0);

      expect(received).toHaveBeenCalledWith({ foo: "bar" });
      client.disconnect();
      await closeServer(server);
    });
  });

  describe("send", () => {
    it("sends JSON messages to the server", async () => {
      const { server, url } = await createServer();
      const client = new ReconnectingWebSocket<{ ping: boolean }>({ url });
      const serverReceived = vi.fn();

      server.on("connection", (ws) => {
        ws.on("message", (data) => {
          serverReceived(JSON.parse(data.toString()));
        });
      });

      const opened = vi.fn();
      client.on("open", opened);
      client.connect();
      await waitFor(() => opened.mock.calls.length > 0);

      client.send({ ping: true });
      await waitFor(() => serverReceived.mock.calls.length > 0);

      expect(serverReceived).toHaveBeenCalledWith({ ping: true });
      client.disconnect();
      await closeServer(server);
    });

    it("silently drops send when disconnected", () => {
      const client = new ReconnectingWebSocket({ url: "ws://127.0.0.1:0" });
      expect(() => client.send({ any: "message" })).not.toThrow();
    });
  });

  describe("reconnection", () => {
    it("reconnects on server-initiated close", async () => {
      const { server, url } = await createServer();
      const client = new ReconnectingWebSocket({
        url,
        backoff: { initialDelayMs: 20, maxDelayMs: 200, multiplier: 2 },
      });

      let openCount = 0;
      client.on("open", () => {
        openCount++;
      });

      client.connect();
      await waitFor(() => openCount === 1);

      for (const ws of server.clients) ws.terminate();
      await waitFor(() => openCount >= 2, 3000);
      expect(openCount).toBeGreaterThanOrEqual(2);

      client.disconnect();
      await closeServer(server);
    });

    it("disconnect() stops reconnection after server close", async () => {
      const { server, url } = await createServer();
      const client = new ReconnectingWebSocket({
        url,
        backoff: { initialDelayMs: 20, maxDelayMs: 200, multiplier: 2 },
      });

      let openCount = 0;
      client.on("open", () => {
        openCount++;
      });

      client.connect();
      await waitFor(() => openCount === 1);

      client.disconnect();
      for (const ws of server.clients) ws.terminate();

      // Wait longer than the backoff to confirm no reconnect
      await new Promise((r) => setTimeout(r, 200));
      expect(openCount).toBe(1);

      await closeServer(server);
    });

    it("stopReconnecting() keeps connection alive but prevents reconnect", async () => {
      const { server, url } = await createServer();
      const client = new ReconnectingWebSocket({
        url,
        backoff: { initialDelayMs: 50, maxDelayMs: 500, multiplier: 2 },
      });

      let openCount = 0;
      client.on("open", () => {
        openCount++;
      });

      client.connect();
      await waitFor(() => openCount === 1);
      expect(client.connected).toBe(true);

      client.stopReconnecting();
      expect(client.connected).toBe(true);

      // Terminate to confirm no reconnect
      for (const ws of server.clients) ws.terminate();
      await new Promise((r) => setTimeout(r, 200));
      expect(openCount).toBe(1);

      await closeServer(server);
    });
  });

  describe("connect() idempotency", () => {
    it("calling connect() twice creates only one connection", async () => {
      const { server, url } = await createServer();
      const client = new ReconnectingWebSocket({ url });

      let openCount = 0;
      client.on("open", () => {
        openCount++;
      });

      client.connect();
      client.connect();
      await waitFor(() => openCount > 0);

      // Allow time for a second open that should NOT fire
      await new Promise((r) => setTimeout(r, 100));
      expect(openCount).toBe(1);
      expect(server.clients.size).toBe(1);

      client.disconnect();
      await closeServer(server);
    });
  });

  describe("heartbeat", () => {
    it("heartbeat timeout triggers terminate and reconnect", async () => {
      // autoPong: false prevents the ws server from auto-replying to pings,
      // which lets us test that our timeout fires when no pong arrives.
      const server = new WebSocketServer({ port: 0, autoPong: false });
      const url = await new Promise<string>((resolve) => {
        server.on("listening", () => {
          const addr = server.address() as { port: number };
          resolve(`ws://127.0.0.1:${addr.port}`);
        });
      });

      const client = new ReconnectingWebSocket({
        url,
        heartbeat: { intervalMs: 50, timeoutMs: 30 },
        backoff: { initialDelayMs: 10, maxDelayMs: 100, multiplier: 2 },
      });

      let openCount = 0;
      client.on("open", () => {
        openCount++;
      });

      client.connect();
      await waitFor(() => openCount === 1);

      // Wait for: heartbeat interval (50ms) + timeout (30ms) + reconnect (10ms) + buffer
      await waitFor(() => openCount >= 2, 5000);
      expect(openCount).toBeGreaterThanOrEqual(2);

      client.disconnect();
      await closeServer(server);
    }, 10000);
  });
});
