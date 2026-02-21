# @hardlydifficult/websocket

A resilient WebSocket client with automatic reconnection (exponential backoff), heartbeat monitoring, proactive token refresh, and request tracking — fully typed in TypeScript.

## Installation

```bash
npm install @hardlydifficult/websocket
```

## Quick Start

```typescript
import { ReconnectingWebSocket } from "@hardlydifficult/websocket";

const ws = new ReconnectingWebSocket({
  url: "wss://api.example.com/ws",
  auth: {
    getToken: () => "Bearer token",
  },
  heartbeat: {
    intervalMs: 30000, // ping every 30s
    timeoutMs: 10000,  // terminate if no pong in 10s
  },
});

ws.on("open", () => console.log("Connected"));
ws.on("message", (data) => console.log("Received:", data));
ws.on("close", (code, reason) => console.log("Closed:", code, reason));

ws.connect();
ws.send({ type: "hello" }); // sends as JSON
```

## Auto-Reconnecting WebSocket

`ReconnectingWebSocket` maintains a persistent connection with exponential backoff on disconnect, JSON message parsing, and optional authentication.

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `url` | `string` | — | WebSocket server URL |
| `backoff` | `BackoffOptions` | `{ initialDelayMs: 1000, maxDelayMs: 30000, multiplier: 2 }` | Reconnection backoff config |
| `heartbeat` | `HeartbeatOptions` | `{ intervalMs: 30000, timeoutMs: 10000 }` | Ping/pong monitoring |
| `auth` | `AuthOptions` | — | Authentication (token fetched on each connect) |
| `protocols` | `string[]` | — | WebSocket subprotocols |
| `headers` | `Record<string, string>` | — | Additional handshake headers |

### Core Methods

```typescript
ws.connect(); // Connect or reconnect (idempotent)
ws.disconnect(); // Stop and prevent future reconnects
ws.reconnect(); // Force reconnect with fresh auth token
ws.send(message); // Send JSON-serializable message
ws.stopReconnecting(); // Allow in-flight work but prevent reconnection
ws.connected; // Read-only: true if socket is open
ws.on(event, listener); // Register event listener (returns unsubscribe function)
```

### Event Types

```typescript
ws.on("open", () => { /* connected */ });
ws.on("close", (code, reason) => { /* disconnected */ });
ws.on("error", (error) => { /* connection or parse error */ });
ws.on("message", (data) => { /* message received & parsed */ });
```

### Backoff Behavior

```typescript
import { getBackoffDelay } from "@hardlydifficult/websocket";

const opts = { initialDelayMs: 1000, maxDelayMs: 30000, multiplier: 2 };

getBackoffDelay(0, opts); // 1000 ms
getBackoffDelay(1, opts); // 2000 ms
getBackoffDelay(2, opts); // 4000 ms
getBackoffDelay(10, opts); // capped at 30000 ms
```

## Proactive Token Refresh

`calculateTokenRefreshTime` schedules token refresh before expiry, using either 50% lifetime (short tokens) or a 2-minute buffer (longer tokens):

```typescript
import { calculateTokenRefreshTime } from "@hardlydifficult/websocket";

// 60s token → refresh at 30s (50% wins)
calculateTokenRefreshTime(Date.now(), Date.now() + 60_000);

// 5min token → refresh at 3min (2min buffer wins)
calculateTokenRefreshTime(Date.now(), Date.now() + 5 * 60_000);

// Reconnect to refresh token
ws.reconnect(); // fetches fresh token from auth
```

### Token Refresh Strategy

| Token lifetime | Refresh strategy | Example (60s token) | Example (5min token) |
|----------------|----------------|---------------------|----------------------|
| Short (≤4min) | 50% lifetime | 30s after issue | N/A |
| Long (>4min) | 2min before expiry | N/A | 3min after issue |

## Request Tracker

`RequestTracker` helps manage graceful shutdown by rejecting new requests during drain and notifying when all active requests complete.

### Methods

```typescript
const tracker = new RequestTracker();

tracker.tryAccept(); // false if draining, otherwise increments active & returns true
tracker.complete(); // decrements active; emits 'drained' when active reaches 0
tracker.startDraining("reason"); // enter drain mode; rejects new requests

tracker.draining; // true if draining
tracker.active; // number of in-flight requests

tracker.on("draining", (reason) => { /* draining started */ });
tracker.on("drained", () => { /* all requests complete */ });
```

### Example Usage

```typescript
const tracker = new RequestTracker();
let activeRequests = 0;

tracker.on("draining", (reason) => console.log("Draining:", reason));
tracker.on("drained", () => console.log("All requests complete"));

// Accept a request
if (tracker.tryAccept()) {
  processRequest().finally(() => tracker.complete());
}

// On shutdown signal
tracker.startDraining("Server shutdown");
```