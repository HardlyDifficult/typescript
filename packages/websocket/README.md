# @hardlydifficult/websocket

A resilient WebSocket client with automatic reconnection (exponential backoff), heartbeat monitoring, proactive token refresh, and request tracking — fully typed in TypeScript.

## Installation

```bash
npm install @hardlydifficult/websocket
```

## Quick Start

```typescript
import { ReconnectingWebSocket } from "@hardlydifficult/websocket";

const client = new ReconnectingWebSocket({
  url: "wss://api.example.com/ws",
  auth: {
    getToken: () => "Bearer token",
  },
});

client.on("open", () => console.log("Connected!"));
client.on("message", (data) => console.log("Received:", data));

client.connect();
client.send({ type: "ping" });
```

## Auto-Reconnecting WebSocket

`ReconnectingWebSocket` maintains a persistent connection with exponential backoff on disconnect, JSON message parsing, and optional authentication.

### Constructor Options

| Option | Type | Description |
|--------|------|-------------|
| `url` | `string` | WebSocket server URL |
| `backoff`? | `BackoffOptions` | Exponential backoff configuration (defaults: `initialDelayMs=1000`, `maxDelayMs=30000`, `multiplier=2`) |
| `heartbeat`? | `HeartbeatOptions` | Heartbeat ping configuration (defaults: `intervalMs=30000`, `timeoutMs=10000`) |
| `auth`? | `AuthOptions` | Auth configuration with a `getToken` function |
| `protocols`? | `string[]` | WebSocket subprotocols |
| `headers`? | `Record<string, string>` | Additional headers for the WebSocket handshake |

### Core Methods

```typescript
client.connect(); // Connect or reconnect (idempotent)
client.disconnect(); // Stop and prevent future reconnects
client.reconnect(); // Force reconnect with fresh auth token
client.send(message); // Send JSON-serializable message
client.stopReconnecting(); // Allow in-flight work but prevent reconnection
client.connected; // Read-only: true if socket is open
client.on(event, listener); // Register event listener (returns unsubscribe function)
```

Each `on()` call returns an unsubscribe function.

### Event Types

```typescript
client.on("open", () => { /* connected */ });
client.on("close", (code, reason) => { /* disconnected */ });
client.on("error", (error) => { /* connection or parse error */ });
client.on("message", (data) => { /* message received & parsed */ });
```

### Backoff Behavior

Use `getBackoffDelay` to compute delays for custom reconnection strategies:

```typescript
import { getBackoffDelay } from "@hardlydifficult/websocket";

const delay = getBackoffDelay(3, {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  multiplier: 2,
});
// delay = 8000 (1000 * 2^3)
```

| Attempt | Delay |
|---------|-------|
| 0 | 1000 ms |
| 1 | 2000 ms |
| 2 | 4000 ms |
| 10 | capped at 30000 ms |

## Proactive Token Refresh

`calculateTokenRefreshTime` schedules token refresh before expiry, using either 50% lifetime (short tokens) or a 2-minute buffer (longer tokens):

```typescript
import { calculateTokenRefreshTime } from "@hardlydifficult/websocket";

const issuedAt = Date.now();
const expiresAt = issuedAt + 10 * 60_000; // 10-minute token

const refreshAt = calculateTokenRefreshTime(issuedAt, expiresAt);
// refreshAt = expiresAt - 2 * 60_000 (2-min buffer)
```

### Token Refresh Strategy

| Token lifetime | Refresh strategy | Example (60s token) | Example (5min token) |
|----------------|------------------|---------------------|----------------------|
| Short (≤4min) | 50% lifetime | 30s after issue | N/A |
| Long (>4min) | 2min before expiry | N/A | 3min after issue |

## Request Tracker

`RequestTracker` helps manage graceful shutdown by rejecting new requests during drain and notifying when all active requests complete.

### Methods

- `tryAccept(): boolean` — Accept a new request; returns `false` if draining
- `complete(): void` — Mark request as complete
- `startDraining(reason: string): void` — Enter draining mode; idempotent
- `draining: boolean` — Read-only draining state
- `active: number` — Active request count

### Events

```typescript
tracker.on("draining", (reason) => console.log("Draining:", reason));
tracker.on("drained", () => console.log("All requests complete"));
```

### Example Usage

```typescript
import { RequestTracker } from "@hardlydifficult/websocket";

const tracker = new RequestTracker();
tracker.on("draining", (reason) => console.log("Draining:", reason));
tracker.on("drained", () => console.log("All requests complete"));

// In an HTTP request handler:
if (!tracker.tryAccept()) {
  return res.status(503).send("Server shutting down");
}

// Do work...

tracker.complete();
```

## Public API Reference

### Exports

- `ReconnectingWebSocket<T>`: Auto-reconnecting WebSocket client class
- `RequestTracker`: Request tracking class for graceful shutdown
- `calculateTokenRefreshTime(issuedAt: number, expiresAt: number): number`: Calculate refresh time
- `getBackoffDelay(attempt: number, options: Required<BackoffOptions>): number`: Calculate exponential backoff delay
- `AuthOptions`: Type for auth configuration
- `BackoffOptions`: Type for backoff configuration
- `HeartbeatOptions`: Type for heartbeat configuration
- `WebSocketOptions<T>`: Type for WebSocket client options

### Types

- `WebSocketEvents<T>`: Event callback types for `ReconnectingWebSocket`
- `RequestTrackerEvents`: Event callback types for `RequestTracker`