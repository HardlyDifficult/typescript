# @hardlydifficult/worker-server

WebSocket-based worker server with health monitoring, request routing, and load balancing.

## Installation

```bash
npm install @hardlydifficult/worker-server
```

## Quick Start

```typescript
import { WorkerServer } from "@hardlydifficult/worker-server";

const server = new WorkerServer({
  port: 8080,
  authToken: "my-secret-token", // optional
  logger: console, // optional, defaults to no-op
});

// Handle worker registrations and messages
server.onWorkerConnected((worker) => {
  console.log(`Worker ${worker.name} (${worker.id}) connected`);
});

server.onWorkerDisconnected((worker, pendingRequestIds) => {
  console.log(`Worker ${worker.id} disconnected with ${pendingRequestIds.size} pending requests`);
});

server.onWorkerMessage("work_complete", (worker, message) => {
  console.log(`Work completed: ${message.requestId}`);
});

// Start the server
await server.start();

// Get an available worker supporting a model
const worker = server.getAvailableWorker("gpt-4");
if (worker) {
  server.send(worker.id, { type: "work_request", requestId: "req-1" });
}

// Stop when done
await server.stop();
```

## Core Concepts

### Worker Lifecycle Management

The server handles worker connections, registrations, and disconnections with automatic health monitoring.

#### Registration and Authentication

Workers connect via WebSocket and send a `worker_registration` message with an optional `authToken`. If the server is configured with `authToken`, the worker must provide a matching token.

```typescript
import { WorkerServer } from "@hardlydifficult/worker-server";

const server = new WorkerServer({
  port: 8080,
  authToken: "secret",
});

server.onWorkerConnected((worker) => {
  console.log(`Worker registered: ${worker.id}`);
});

await server.start();
```

#### Heartbeat and Health Monitoring

Workers must send periodic `heartbeat` messages. The server tracks the last heartbeat timestamp and closes connections that miss the timeout.

```typescript
const server = new WorkerServer({
  port: 8080,
  heartbeatTimeoutMs: 60_000,      // Missed for 60s → unhealthy
  healthCheckIntervalMs: 10_000,   // Check every 10s
  heartbeatIntervalMs: 15_000,     // Communicate 15s interval to workers
});
```

| Option | Default | Description |
|--------|---------|-------------|
| `heartbeatTimeoutMs` | 60000 | Time before worker is marked unhealthy |
| `healthCheckIntervalMs` | 10000 | Frequency of health checks |
| `heartbeatIntervalMs` | 15000 | Heartbeat interval communicated to workers |

#### Disconnection Handling

When a worker disconnects, the `onWorkerDisconnected` handler is called with its pending request IDs.

```typescript
server.onWorkerDisconnected((worker, pendingRequestIds) => {
  // Reassign pending requests as needed
  console.log(`Pending: ${[...pendingRequestIds].join(", ")}`);
});
```

### Request Tracking and Load Balancing

Requests are tracked per-worker to avoid overloading and to support category-specific limits.

#### Request Lifecycle

Track a request as assigned to a worker, then release it when complete.

```typescript
// Assign request to worker
const worker = server.getAvailableWorker("gpt-4");
if (worker) {
  server.trackRequest(worker.id, "req-1");
  server.send(worker.id, { type: "work_request", requestId: "req-1" });
}

// Worker sends completion message
server.onWorkerMessage("work_complete", (worker, message) => {
  server.releaseRequest(message.requestId, { incrementCompleted: true });
});
```

#### Available Worker Selection

Workers are selected based on capacity and model support.

```typescript
// Get least-loaded worker supporting a model
const worker = server.getAvailableWorker("gpt-4");
// → least-loaded worker that supports "gpt-4"

// Get any available worker (model-agnostic)
const anyWorker = server.getAnyAvailableWorker();
// → any worker (Available or Busy status)
```

Workers are marked `Busy` when `activeRequests >= maxConcurrentRequests`.

#### Per-Category Concurrency Limits

Workers can define per-category limits in their capabilities. The pool enforces these when `trackRequest` is called with a category.

```typescript
// Worker capabilities include:
{
  models: [{ modelId: "gpt-4", ... }],
  maxConcurrentRequests: 5,
  concurrencyLimits: {
    inference: 2,
    embedding: 4,
  }
}

// Track request in a category
server.trackRequest(worker.id, "req-1", "inference");
```

### Message Routing

Messages are routed by the `type` field to registered handlers.

```typescript
server.onWorkerMessage("work_complete", (worker, message) => {
  console.log(`Worker ${worker.id} completed ${message.requestId}`);
});

server.onWorkerMessage("metrics", (worker, message) => {
  console.log(`Worker ${worker.id} metrics:`, message.metrics);
});
```

Returns an unsubscribe function:

```typescript
const unsubscribe = server.onWorkerMessage("status", handler);
// later...
unsubscribe();
```

### Sending Messages

#### Targeted Send

```typescript
const success = server.send(workerId, { type: "ping" });
// Returns false if worker not found or WebSocket not open
```

#### Broadcast

```typescript
server.broadcast({ type: "shutdown" });
// Sends to all connected workers with open sockets
```

### Server Extensibility

#### Additional WebSocket Endpoints

```typescript
// Create a custom WebSocket endpoint
server.addWebSocketEndpoint("/ws/metrics", (ws) => {
  ws.on("message", (data) => {
    console.log("Metrics client message:", data.toString());
  });
});

// Clients connect to ws://localhost:8080/ws/metrics
```

#### HTTP Handlers

```typescript
server.addHttpHandler(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return true;
  }
  return false; // continue to next handler or 404
});

// Custom HTTP responses take precedence over 404
```

## Public API

### `WorkerServer`

Main server class for managing worker connections.

| Method | Description |
|--------|-------------|
| `onWorkerConnected(handler)` | Register handler for worker registration events |
| `onWorkerDisconnected(handler)` | Register handler for worker disconnection events |
| `onWorkerMessage(type, handler)` | Register handler for a specific message type |
| `send(workerId, message)` | Send a JSON message to a specific worker |
| `broadcast(message)` | Broadcast a JSON message to all workers |
| `getAvailableWorker(model, category?)` | Get least-loaded worker supporting model |
| `getAnyAvailableWorker()` | Get any available/Busy worker |
| `getWorkerCount()` | Total connected worker count |
| `getAvailableWorkerCount()` | Available worker count |
| `getWorkerInfo()` | Get public info about all workers |
| `trackRequest(workerId, requestId, category?)` | Track request as in-progress |
| `releaseRequest(requestId, options?)` | Release tracked request |
| `addHttpHandler(handler)` | Add HTTP request handler |
| `addWebSocketEndpoint(path, handler)` | Add custom WebSocket endpoint |
| `start()` | Start HTTP + WebSocket server |
| `stop()` | Stop server and close all connections |

### `WorkerPool`

Internal pool manager with public helpers.

| Method | Description |
|--------|-------------|
| `add(worker)` | Add a connected worker to the pool |
| `remove(id)` | Remove worker by ID |
| `get(id)` | Get worker by ID |
| `has(id)` | Check if worker is in pool |
| `getAvailableWorker(model, category?)` | Get available worker by model |
| `getAnyAvailableWorker()` | Get any available/Busy worker |
| `getCount()` | Total worker count |
| `getAvailableCount()` | Available worker count |
| `getWorkerInfoList()` | Get public info for all workers |
| `checkHealth(timeoutMs)` | Check worker health and return dead IDs |
| `send(workerId, message)` | Send message to worker |
| `broadcast(message)` | Broadcast to all workers |
| `closeAll()` | Close all worker connections |

### `toWorkerInfo(worker)`

Converts internal `ConnectedWorker` to public `WorkerInfo`.

```typescript
import { toWorkerInfo, type ConnectedWorker } from "@hardlydifficult/worker-server";

const internal: ConnectedWorker = /* ... */;
const publicInfo = toWorkerInfo(internal);
// No websocket reference in publicInfo
```

### Types

| Type | Description |
|------|-------------|
| `WorkerStatus` | `available`, `busy`, `draining`, `unhealthy` |
| `ModelInfo` | Model capabilities and metadata |
| `WorkerCapabilities` | Worker capacity, models, and concurrency limits |
| `WorkerInfo` | Public worker state |
| `ConnectedWorker` | Internal state (includes WebSocket) |
| `WorkerServerOptions` | Configuration for `WorkerServer` |
| `WorkerServerLogger` | Logger interface |
| `HttpRequestHandler` | HTTP request handler type |
| `WorkerMessageHandler<T>` | Typed message handler |
| `WorkerConnectedHandler` | Worker connected event handler |
| `WorkerDisconnectedHandler` | Worker disconnected event handler |
| `WebSocketConnectionHandler` | Custom WebSocket endpoint handler |

### Constants and Defaults

Default timeouts (milliseconds):

```typescript
{
  heartbeatTimeoutMs: 60_000,
  healthCheckIntervalMs: 10_000,
  heartbeatIntervalMs: 15_000,
}
```

### Utility Functions

#### `safeCompare(a, b)`

Timing-safe string comparison.

```typescript
import { safeCompare } from "@hardlydifficult/worker-server";

const isValid = safeCompare(inputToken, secretToken);
```

## Appendix

### Worker Registration Protocol

Workers send:

```json
{
  "type": "worker_registration",
  "workerId": "worker-1",
  "workerName": "My Worker",
  "capabilities": {
    "models": [{
      "modelId": "gpt-4",
      "displayName": "GPT-4",
      "maxContextTokens": 8192,
      "maxOutputTokens": 4096,
      "supportsStreaming": true
    }],
    "maxConcurrentRequests": 5,
    "concurrencyLimits": {
      "inference": 2,
      "embedding": 4
    }
  },
  "authToken": "optional"
}
```

Server responds:

```json
{
  "type": "worker_registration_ack",
  "success": true,
  "sessionId": "uuid",
  "heartbeatIntervalMs": 15000
}
```

### Worker Heartbeat Protocol

Workers send:

```json
{
  "type": "heartbeat",
  "workerId": "worker-1",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

Server responds:

```json
{
  "type": "heartbeat_ack",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "nextHeartbeatDeadline": "2024-01-01T00:01:00.000Z"
}
```

### Status Transitions

- `Available` → `Busy` when `activeRequests >= maxConcurrentRequests`
- `Busy` → `Available` when `activeRequests < maxConcurrentRequests`
- Any → `Unhealthy` on heartbeat timeout
- `Unhealthy` → `Available/Busy` on heartbeat recovery

### Concurrent Request Tracking

The pool tracks requests per-worker and per-category (if provided). It automatically decrements the category count when releasing a tracked request.

### Worker Protocol Summary

Workers communicate using JSON messages with a `type` field:

| Message | Direction | Description |
|---------|-----------|-------------|
| `worker_registration` | Worker → Server | Register with capabilities |
| `worker_registration_ack` | Server → Worker | Acknowledgment with session ID |
| `heartbeat` | Worker → Server | Periodic health check |
| `heartbeat_ack` | Server → Worker | Acknowledgment with next deadline |

All other message types are routed to registered handlers via `onWorkerMessage()`.