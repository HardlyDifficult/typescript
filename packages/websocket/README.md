# @hardlydifficult/websocket

A resilient WebSocket client for Node.js with automatic reconnection, heartbeat-based dead connection detection, and graceful request draining.

## Installation

```bash
npm install @hardlydifficult/websocket
```

Requires Node.js 18+.

## Quick Start

```typescript
import { ReconnectingWebSocket } from "@hardlydifficult/websocket";

interface Message {
  type: string;
  data: unknown;
}

const client = new ReconnectingWebSocket<Message>({
  url: "ws://localhost:8080",
});

client.on("open", () => {
  console.log("Connected");
  client.send({ type: "hello", data: "world" });
});

client.on("message", (msg) => {
  console.log("Received:", msg);
});

client.on("error", (err) => {
  console.error("Error:", err);
});

client.connect();
```

## ReconnectingWebSocket

A generic WebSocket client that automatically reconnects on disconnection, sends protocol-level pings for heartbeats, and parses JSON messages.

### Constructor

```typescript
const client = new ReconnectingWebSocket<T>(options: WebSocketOptions);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | — | WebSocket server URL (required) |
| `backoff.initialDelayMs` | `number` | `1000` | Initial reconnection delay in milliseconds |
| `backoff.maxDelayMs` | `number` | `30000` | Maximum reconnection delay in milliseconds |
| `backoff.multiplier` | `number` | `2` | Multiplier applied per reconnection attempt |
| `heartbeat.intervalMs` | `number` | `30000` | Interval between pings in milliseconds |
| `heartbeat.timeoutMs` | `number` | `10000` | Time to wait for pong before terminating |

### Methods

#### `connect(): void`

Connect to the WebSocket server. Idempotent — calling multiple times has no additional effect. If a reconnect timer is pending, cancels it and connects immediately, resetting the attempt counter.

```typescript
client.connect();
```

#### `disconnect(): void`

Disconnect from the server and stop all reconnection attempts. Closes the socket with code 1000.

```typescript
client.disconnect();
```

#### `send(message: T): void`

Send a message as JSON. No-op if not currently connected.

```typescript
client.send({ type: "ping" });
```

#### `stopReconnecting(): void`

Prevent reconnection without closing the current connection. Useful for graceful shutdown: deliver in-flight results but do not reconnect if the socket drops.

```typescript
client.stopReconnecting();
```

#### `on<K extends keyof WebSocketEvents<T>>(event: K, listener: WebSocketEvents<T>[K]): () => void`

Subscribe to a WebSocket lifecycle event. Multiple listeners per event are supported. Returns an unsubscribe function.

```typescript
const unsubscribe = client.on("message", (msg) => {
  console.log(msg);
});

unsubscribe(); // Stop listening
```

### Events

#### `open`

Fired when the connection is established.

```typescript
client.on("open", () => {
  console.log("Connected");
});
```

#### `close`

Fired when the connection is closed.

```typescript
client.on("close", (code: number, reason: string) => {
  console.log(`Closed with code ${code}: ${reason}`);
});
```

#### `error`

Fired on connection or parse errors.

```typescript
client.on("error", (error: Error) => {
  console.error("Error:", error.message);
});
```

#### `message`

Fired when a message is received and parsed.

```typescript
client.on("message", (data: T) => {
  console.log("Received:", data);
});
```

### Properties

#### `connected: boolean`

Whether the socket is currently open.

```typescript
if (client.connected) {
  client.send({ type: "ping" });
}
```

### Exponential Backoff

The client uses exponential backoff for reconnection delays. The delay for attempt `n` is calculated as:

```
delay = min(initialDelayMs × multiplier^n, maxDelayMs)
```

For example, with default settings (initial: 1000ms, max: 30000ms, multiplier: 2):
- Attempt 0: 1000ms
- Attempt 1: 2000ms
- Attempt 2: 4000ms
- Attempt 3: 8000ms
- Attempt 4+: 30000ms (capped)

You can access this calculation directly:

```typescript
import { getBackoffDelay } from "@hardlydifficult/websocket";

const delay = getBackoffDelay(2, {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  multiplier: 2,
});
// delay = 4000
```

## RequestTracker

Tracks active requests and manages draining state. Centralizes the pattern of rejecting new work during shutdown and notifying listeners when the last request completes.

### Constructor

```typescript
const tracker = new RequestTracker();
```

### Methods

#### `tryAccept(): boolean`

Try to accept a new request. Returns `false` if draining — caller should send a rejection response.

```typescript
if (tracker.tryAccept()) {
  // Process request
  tracker.complete();
} else {
  // Send rejection (service is shutting down)
}
```

#### `complete(): void`

Mark a request as complete. Decrements the active count and emits `drained` when the last request finishes during a drain.

```typescript
tracker.complete();
```

#### `startDraining(reason: string): void`

Enter draining mode — no new requests will be accepted. Idempotent: subsequent calls are ignored. Emits `draining` immediately and `drained` when active reaches zero.

```typescript
tracker.startDraining("server shutting down");
```

#### `on<K extends keyof RequestTrackerEvents>(event: K, listener: RequestTrackerEvents[K]): () => void`

Subscribe to a RequestTracker event. Returns an unsubscribe function.

```typescript
const unsubscribe = tracker.on("drained", () => {
  console.log("All requests completed");
});
```

### Events

#### `draining`

Fired when draining mode is entered.

```typescript
tracker.on("draining", (reason: string) => {
  console.log(`Draining: ${reason}`);
});
```

#### `drained`

Fired when all active requests complete during drain.

```typescript
tracker.on("drained", () => {
  console.log("Ready to shut down");
});
```

### Properties

#### `draining: boolean`

Whether the tracker is in draining mode.

```typescript
if (tracker.draining) {
  console.log("Not accepting new requests");
}
```

#### `active: number`

Number of currently active requests.

```typescript
console.log(`${tracker.active} requests in flight`);
```

### Example: Graceful Shutdown

```typescript
import { ReconnectingWebSocket, RequestTracker } from "@hardlydifficult/websocket";

const client = new ReconnectingWebSocket({ url: "ws://localhost:8080" });
const tracker = new RequestTracker();

client.on("message", (msg) => {
  if (!tracker.tryAccept()) {
    // Reject new requests during shutdown
    return;
  }

  // Process message
  processMessage(msg);
  tracker.complete();
});

// Initiate graceful shutdown
async function shutdown() {
  client.stopReconnecting();
  tracker.startDraining("server shutting down");

  // Wait for all in-flight requests to complete
  await new Promise<void>((resolve) => {
    tracker.on("drained", () => {
      resolve();
    });
  });

  client.disconnect();
}
```