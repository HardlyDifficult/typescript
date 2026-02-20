# @hardlydifficult/worker-server

A WebSocket-based worker server for managing remote worker connections with health monitoring, request routing, and load balancing.

## Installation

```bash
npm install @hardlydifficult/worker-server
```

## Quick Start

```typescript
import { WorkerServer } from "@hardlydifficult/worker-server";

const server = new WorkerServer({ port: 3000 });

server.onWorkerConnected((worker) => {
  console.log("Worker connected:", worker.id);
});

server.onWorkerMessage("work_request", async (worker, message) => {
  console.log("Received request from", worker.id, message);
  server.send(worker.id, { type: "work_complete", requestId: message.requestId });
});

await server.start();
console.log("Worker server running on port 3000");
```

## Core Concepts

### Worker Registration

Workers connect via WebSocket and register with identity and capabilities. The server supports optional authentication and tracks worker health via heartbeat protocol.

```typescript
server.onWorkerConnected((worker) => {
  // Worker capabilities include supported models and concurrency limits
  console.log(
    `Worker ${worker.name} supports: ${worker.capabilities.models.map(m => m.modelId).join(", ")}`
  );
});
```

### Message Routing

Messages are dispatched by `type` field to registered handlers.

```typescript
server.onWorkerMessage("work_complete", (worker, message) => {
  console.log("Work completed for", message.requestId);
});

server.send(workerId, { type: "work_request", requestId: "req-1" });
server.broadcast({ type: "shutdown" });
```

### Request Tracking & Load Balancing

Track active requests and select the least-loaded available worker.

```typescript
const worker = server.getAvailableWorker("sonnet", "inference");
if (worker) {
  server.trackRequest(worker.id, requestId, "inference");
  server.send(worker.id, { type: "start", requestId });
}

// Later, release the request
server.releaseRequest(requestId, { incrementCompleted: true });
```

## Core Components

### WorkerServer

Main server class managing WebSocket connections, HTTP endpoints, and worker pool.

#### Constructor

| Parameter | Type | Default | Description |
|--|------|---------|-----|
| `port` | `number` | — | HTTP + WebSocket server port |
| `authToken` | `string` (optional) | — | Token required for worker registration |
| `heartbeatTimeoutMs` | `number` | 60000 | Timeout before marking worker unhealthy |
| `healthCheckIntervalMs` | `number` | 10000 | Interval for health checks |
| `heartbeatIntervalMs` | `number` | 15000 | Heartbeat interval communicated to workers |
| `logger` | `WorkerServerLogger` (optional) | No-op | Logger instance |

#### Lifecycle Management

```typescript
const server = new WorkerServer({ port: 8080, authToken: "secret" });

// Start the server
await server.start();

// Stop the server gracefully
await server.stop();
```

#### Registration Handlers

```typescript
// Called when a worker successfully registers
const unsubscribeConnected = server.onWorkerConnected((worker) => {
  console.log(`Worker connected: ${worker.name}`);
});

// Called when a worker disconnects
const unsubscribeDisconnected = server.onWorkerDisconnected((worker, pending) => {
  console.log(`Worker disconnected with ${pending.size} pending requests`);
});
```

#### Message Handling

```typescript
// Register handlers for domain-specific messages by type
server.onWorkerMessage("work_request", (worker, message) => {
  // Process work request from worker
});

server.onWorkerMessage("status_update", (worker, message) => {
  // Handle status updates from worker
});
```

#### Sending Messages

```typescript
// Send to a specific worker
const success = server.send("worker-1", { type: "stop", reason: "shutdown" });

// Broadcast to all connected workers
server.broadcast({ type: "maintenance_start" });
```

#### Pool Queries

```typescript
// Get least-loaded worker supporting a specific model
const worker = server.getAvailableWorker("sonnet-3.5");

// Get any available worker (model-agnostic)
const anyWorker = server.getAnyAvailableWorker();

// Get all worker info
const workers = server.getWorkerInfo(); // Returns WorkerInfo[]
```

#### Request Tracking

```typescript
// Track a request assigned to a worker
server.trackRequest("worker-1", "req-123", "inference");

// Release a completed request
server.releaseRequest("req-123", { incrementCompleted: true });
```

#### Extensibility

| Method | Description |
|--|---|
| `addHttpHandler(handler)` | Add an HTTP handler (called in order until one returns `true`) |
| `addWebSocketEndpoint(path, handler)` | Add a WebSocket endpoint at a custom path |

#### Event Handlers

| Method | Return | Description |
|--|--|---|
| `onWorkerConnected(handler)` | `() => void` | Called when worker registers |
| `onWorkerDisconnected(handler)` | `() => void` | Called when worker disconnects (includes pending requests) |
| `onWorkerMessage(type, handler)` | `() => void` | Register handler for a message type |

### WorkerPool

Internal class managing worker state and selection. Exposed via `WorkerServer`.

| Method | Description |
|--|---|
| `getAvailableWorker(model, category?)` | Get least-loaded available worker supporting model |
| `getAnyAvailableWorker()` | Get any available/busy worker |
| `trackRequest(workerId, requestId, category?)` | Mark request as in-progress |
| `releaseRequest(requestId, { incrementCompleted? })` | Release tracked request |
| `getWorkerInfoList()` | Get public info for all workers |
| `checkHealth(timeoutMs)` | Return IDs of dead workers (heartbeat > 3x timeout) |
| `send(workerId, message)` | Send message to specific worker |
| `broadcast(message)` | Broadcast to all workers |
| `closeAll()` | Close all worker connections |

### ConnectionHandler

Handles WebSocket connection lifecycle and protocol message routing.

#### Message Routing

```typescript
import { ConnectionHandler } from "@hardlydifficult/worker-server";

const handler = new ConnectionHandler(pool, config, logger);

// Register handlers for custom message types
const unregister = handler.onMessage("custom_type", (worker, message) => {
  console.log(`Received from ${worker.id}:`, message);
});
```

#### Event Handlers

```typescript
handler.onWorkerConnected((worker) => {
  console.log("Worker connected:", worker.id);
});

handler.onWorkerDisconnected((worker, pending) => {
  console.log("Worker disconnected with pending:", pending.size);
});
```

## Advanced Features

### HTTP Endpoints

Custom HTTP handlers can be added:

```typescript
server.addHttpHandler(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return true;
  }
  return false; // continue to next handler
});
```

### Custom WebSocket Endpoints

Additional WebSocket paths can be handled:

```typescript
server.addWebSocketEndpoint("/ws/admin", (ws) => {
  ws.on("message", (data) => {
    // Handle admin WebSocket messages
  });
});
```

### Authentication

Optionally require authentication tokens from workers:

```typescript
const server = new WorkerServer({
  port: 8080,
  authToken: "your-secret-token"
});

// Workers must send registration with matching authToken
```

### Load Balancing with Category Limits

Workers can declare per-category concurrency limits:

```typescript
const capabilities = {
  models: [{ modelId: "sonnet", ... }],
  maxConcurrentRequests: 10,
  concurrencyLimits: {
    inference: 5, // max 5 concurrent inference requests
    embeddings: 2 // max 2 concurrent embedding requests
  }
};
```

Requests are then tracked by category:

```typescript
server.trackRequest("worker-1", "req-1", "inference");
server.releaseRequest("req-1"); // category looked up automatically
```

## Types and Interfaces

### WorkerInfo

| Field | Type | Description |
|--|------|---|
| `id` | `string` | Unique worker identifier |
| `name` | `string` | Worker-assigned name |
| `status` | `WorkerStatus` | Current status (`available`, `busy`, `draining`, `unhealthy`) |
| `capabilities` | `WorkerCapabilities` | Supported models and limits |
| `sessionId` | `string` | Unique session identifier |
| `connectedAt` | `Date` | Connection timestamp |
| `lastHeartbeat` | `Date` | Last heartbeat timestamp |
| `activeRequests` | `number` | Currently active requests |
| `completedRequests` | `number` | Completed request count |
| `pendingRequestIds` | `ReadonlySet<string>` | Pending request IDs |
| `categoryActiveRequests` | `ReadonlyMap<string, number>` | Active requests per category |

### WorkerCapabilities

| Field | Type | Description |
|--|------|---|
| `models` | `ModelInfo[]` | Supported models |
| `maxConcurrentRequests` | `number` | Overall concurrency limit |
| `metadata?` | `Record<string, unknown>` | Optional metadata |
| `concurrencyLimits?` | `Record<string, number>` | Per-category concurrency limits |

### ModelInfo

| Field | Type | Description |
|--|------|---|
| `modelId` | `string` | Model identifier |
| `displayName` | `string` | Human-readable name |
| `maxContextTokens` | `number` | Maximum context window |
| `maxOutputTokens` | `number` | Maximum output length |
| `supportsStreaming` | `boolean` | Streaming support |
| `supportsVision?` | `boolean` | Vision support (optional) |
| `supportsTools?` | `boolean` | Tool use support (optional) |

### WorkerStatus

- `"available"` — Worker can accept new requests
- `"busy"` — Worker at max concurrency
- `"draining"` — Worker shutting down, no new requests
- `"unhealthy"` — Missed heartbeats

### Configuration Options

```typescript
interface WorkerServerOptions {
  port: number;
  authToken?: string;
  heartbeatTimeoutMs?: number; // default: 60000
  healthCheckIntervalMs?: number; // default: 10000
  heartbeatIntervalMs?: number; // default: 15000
  logger?: WorkerServerLogger;
}
```

### Logger Interface

```typescript
interface WorkerServerLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
```

## Appendix

### Protocol Messages

**Worker Registration (worker → server)**

```typescript
{
  type: "worker_registration",
  workerId: string,
  workerName: string,
  capabilities: WorkerCapabilities,
  authToken?: string
}
```

**Registration Acknowledgment (server → worker)**

```typescript
{
  type: "worker_registration_ack",
  success: boolean,
  error?: string,
  sessionId?: string,
  heartbeatIntervalMs?: number
}
```

**Heartbeat (worker → server)**

```typescript
{
  type: "heartbeat",
  workerId: string,
  timestamp: string
}
```

**Heartbeat Acknowledgment (server → worker)**

```typescript
{
  type: "heartbeat_ack",
  timestamp: string,
  nextHeartbeatDeadline: string
}
```