import { describe, it, expect, vi } from "vitest";
import { WebSocketServer } from "ws";
import { ReconnectingWebSocket } from "../src/ReconnectingWebSocket.js";

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

describe("ReconnectingWebSocket additional coverage", () => {
  describe("on() unsubscribe", () => {
    it("unsubscribe function removes listener so it is not called again", async () => {
      const { server, url } = await createServer();
      const client = new ReconnectingWebSocket<{ v: number }>({ url });
      const received = vi.fn();

      // Register then immediately unsubscribe
      const unsubscribe = client.on("message", received);
      unsubscribe();

      server.on("connection", (ws) => {
        ws.send(JSON.stringify({ v: 1 }));
      });

      client.connect();
      // Wait a bit to ensure any message delivery would have happened
      await new Promise((r) => setTimeout(r, 150));

      expect(received).not.toHaveBeenCalled();
      client.disconnect();
      await closeServer(server);
    });
  });

  describe("disconnect() with pending reconnect timeout", () => {
    it("cancels pending reconnect when disconnect() is called", async () => {
      const { server, url } = await createServer();
      const client = new ReconnectingWebSocket({
        url,
        backoff: { initialDelayMs: 200, maxDelayMs: 1000, multiplier: 2 },
      });

      let openCount = 0;
      client.on("open", () => {
        openCount++;
      });

      client.connect();
      await waitFor(() => openCount === 1);

      // Force disconnect from server to trigger reconnect timer
      for (const ws of server.clients) ws.terminate();

      // Wait briefly so the reconnect timer is scheduled
      await new Promise((r) => setTimeout(r, 30));

      // Now disconnect while reconnect timer is pending (covers lines 172-173)
      client.disconnect();

      // Verify no reconnect happens
      await new Promise((r) => setTimeout(r, 400));
      expect(openCount).toBe(1);

      await closeServer(server);
    });
  });

  describe("connect() cancels pending reconnect", () => {
    it("calling connect() while a reconnect timeout is pending resets and connects immediately", async () => {
      const { server, url } = await createServer();
      const client = new ReconnectingWebSocket({
        url,
        backoff: { initialDelayMs: 500, maxDelayMs: 2000, multiplier: 2 },
      });

      let openCount = 0;
      client.on("open", () => {
        openCount++;
      });

      client.connect();
      await waitFor(() => openCount === 1);

      // Force disconnect from server to trigger slow reconnect
      for (const ws of server.clients) ws.terminate();

      // Wait briefly so reconnect timer is scheduled
      await new Promise((r) => setTimeout(r, 30));

      // Call connect() while reconnect timer is pending (covers lines 113-115)
      client.connect();

      // Should reconnect quickly because connect() cancels timer
      await waitFor(() => openCount >= 2, 2000);
      expect(openCount).toBeGreaterThanOrEqual(2);

      client.disconnect();
      await closeServer(server);
    });
  });

  describe("reconnect() with pending reconnect timeout", () => {
    it("cancels pending reconnect timer when reconnect() is called", async () => {
      const { server, url } = await createServer();
      const client = new ReconnectingWebSocket({
        url,
        backoff: { initialDelayMs: 500, maxDelayMs: 2000, multiplier: 2 },
      });

      let openCount = 0;
      client.on("open", () => {
        openCount++;
      });

      client.connect();
      await waitFor(() => openCount === 1);

      // Force disconnect from server to trigger slow reconnect
      for (const ws of server.clients) ws.terminate();
      await waitFor(() => openCount === 1);

      // Wait briefly so reconnect timer is scheduled
      await new Promise((r) => setTimeout(r, 30));

      // Call reconnect() while reconnect timer is pending (covers lines 191-192)
      client.reconnect();

      // Should reconnect quickly
      await waitFor(() => openCount >= 2, 2000);
      expect(openCount).toBeGreaterThanOrEqual(2);

      client.disconnect();
      await closeServer(server);
    });
  });

  describe("onPong clears heartbeat timeout", () => {
    it("receiving a pong clears the heartbeat timeout", async () => {
      // Use autoPong: true (default) — the server auto-replies to pings
      const { server, url } = await createServer();
      const client = new ReconnectingWebSocket({
        url,
        heartbeat: { intervalMs: 50, timeoutMs: 200 },
        backoff: { initialDelayMs: 50, maxDelayMs: 500, multiplier: 2 },
      });

      let openCount = 0;
      client.on("open", () => {
        openCount++;
      });

      client.connect();
      await waitFor(() => openCount === 1);

      // Wait for at least one heartbeat cycle (ping sent + pong received)
      // The pong should clear the heartbeat timeout (covers lines 246, 250-252)
      await new Promise((r) => setTimeout(r, 120));

      // Connection should still be alive because pong was received
      expect(client.connected).toBe(true);

      client.disconnect();
      await closeServer(server);
    });
  });

  describe("onMessage with different data types", () => {
    it("handles Array<Buffer> message data (directly invoked)", () => {
      const client = new ReconnectingWebSocket<{ x: number }>({
        url: "ws://127.0.0.1:0",
      });
      const received = vi.fn();
      client.on("message", received);

      // Directly invoke the private onMessage with an Array of Buffers
      // This covers lines 261-262 (Array.isArray branch)
      const data = [Buffer.from('{"x":'), Buffer.from("42}")];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).onMessage(data);

      expect(received).toHaveBeenCalledWith({ x: 42 });
    });

    it("handles ArrayBuffer (non-Buffer, non-Array) message data (directly invoked)", () => {
      const client = new ReconnectingWebSocket<{ y: number }>({
        url: "ws://127.0.0.1:0",
      });
      const received = vi.fn();
      client.on("message", received);

      // Use a DataView which is not a Buffer and not an Array - falls to else branch
      // This covers lines 263-264 (else branch using Buffer.from())
      const str = JSON.stringify({ y: 7 });
      const arrayBuffer = new TextEncoder().encode(str).buffer;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).onMessage(arrayBuffer);

      expect(received).toHaveBeenCalledWith({ y: 7 });
    });

    it("emits error on invalid JSON message", async () => {
      const { server, url } = await createServer();
      const client = new ReconnectingWebSocket({ url });
      const errors = vi.fn();
      client.on("error", errors);

      server.on("connection", (ws) => {
        ws.send("not-valid-json");
      });

      client.connect();
      await waitFor(() => errors.mock.calls.length > 0);

      expect(errors).toHaveBeenCalledWith(expect.any(Error));
      client.disconnect();
      await closeServer(server);
    });

    it("emits error on invalid JSON via directly invoked onMessage", () => {
      const client = new ReconnectingWebSocket({ url: "ws://127.0.0.1:0" });
      const errors = vi.fn();
      client.on("error", errors);

      // Directly invoke with invalid JSON to cover line 269
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (client as any).onMessage(Buffer.from("not-valid-json"));

      expect(errors).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe("ws error event", () => {
    it("emits error when WebSocket fires an error event", async () => {
      // Connect to a non-existent server to trigger connection errors
      const client = new ReconnectingWebSocket({
        url: "ws://127.0.0.1:1", // Port 1 is reserved; connect should fail
        backoff: { initialDelayMs: 10000, maxDelayMs: 10000, multiplier: 1 },
      });

      const errors = vi.fn();
      client.on("error", errors);

      client.connect();

      // Wait for the error to be emitted (covers lines 155, 159)
      await waitFor(() => errors.mock.calls.length > 0, 3000);

      expect(errors).toHaveBeenCalledWith(expect.any(Error));
      client.disconnect();
    });
  });

  describe("branch coverage for on() with existing set", () => {
    it("adding a second listener to the same event reuses the existing set", async () => {
      const { server, url } = await createServer();
      const client = new ReconnectingWebSocket({ url });
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      // First call creates the set; second call reuses it (covers else branch of line 85)
      client.on("open", listener1);
      client.on("open", listener2);

      client.connect();
      await waitFor(() => listener1.mock.calls.length > 0);

      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
      client.disconnect();
      await closeServer(server);
    });
  });

  describe("auth: empty token", () => {
    it("does not set Authorization header when getToken returns empty string", async () => {
      const { server, url } = await createServer();
      let receivedHeaders: Record<string, string> = {};

      server.on("connection", (_ws, req) => {
        receivedHeaders = req.headers as Record<string, string>;
      });

      const client = new ReconnectingWebSocket({
        url,
        // Return empty string to cover the token !== "" false branch (line 125)
        auth: { getToken: () => "" },
      });

      const opened = vi.fn();
      client.on("open", opened);
      client.connect();
      await waitFor(() => opened.mock.calls.length > 0);

      expect(receivedHeaders["authorization"]).toBeUndefined();
      client.disconnect();
      await closeServer(server);
    });
  });

  describe("auth: getToken throws non-Error", () => {
    it("wraps non-Error thrown value from getToken as an Error", async () => {
      const { server, url } = await createServer();
      let callCount = 0;

      const client = new ReconnectingWebSocket({
        url,
        auth: {
          getToken: () => {
            callCount++;
            if (callCount === 1) {
              // Throw a non-Error to cover line 129 false branch
              // eslint-disable-next-line @typescript-eslint/no-throw-literal
              throw "string error";
            }
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

      await waitFor(() => opened.mock.calls.length > 0, 3000);

      expect(errors[0]).toBe("string error");
      client.disconnect();
      await closeServer(server);
    });
  });

  describe("onPong when heartbeatTimeout is null", () => {
    it("pong received before any heartbeat is sent does not throw", () => {
      const client = new ReconnectingWebSocket({ url: "ws://127.0.0.1:0" });

      // Directly invoke onPong when heartbeatTimeout is null
      // This covers line 250 false branch (if heartbeatTimeout is falsy)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => (client as any).onPong()).not.toThrow();
    });
  });

  describe("onMessage error with non-Error thrown value", () => {
    it("wraps non-Error thrown from JSON.parse as an Error", () => {
      const client = new ReconnectingWebSocket({ url: "ws://127.0.0.1:0" });
      const errors = vi.fn();
      client.on("error", errors);

      // Patch JSON.parse to throw a non-Error to cover line 269 false branch
      const origParse = JSON.parse;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (JSON as any).parse = () => {
        // eslint-disable-next-line @typescript-eslint/no-throw-literal
        throw "non-error string";
      };

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (client as any).onMessage(Buffer.from("{}"));
      } finally {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (JSON as any).parse = origParse;
      }

      expect(errors).toHaveBeenCalledWith(
        expect.objectContaining({ message: "non-error string" })
      );
    });
  });

  describe("sendHeartbeat when ws is not open", () => {
    it("sendHeartbeat does not crash when ws is not in OPEN state", () => {
      const client = new ReconnectingWebSocket({ url: "ws://127.0.0.1:0" });

      // Directly invoke sendHeartbeat when ws is null (covers line 274 false branch)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(() => (client as any).sendHeartbeat()).not.toThrow();
    });
  });
});
