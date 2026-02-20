# @hardlydifficult/worker-server

A WebSocket-based server for managing remote worker connections with health monitoring, message routing, and load balancing.

## Installation

```bash
npm install @hardlydifficult/worker-server
```

## Quick Start

```typescript
import { WorkerServer } from "@hardlydifficult/worker-server";

// Create and start the server
const server = new WorkerServer({ port: 3000 });

server.start().then(() => {
  console.log("Worker server running on port 3000");
  
  // Listen for worker connections
  server.onWorkerConnected((worker) => {
    console.log(`Worker ${worker.name} (${worker.id}) connected`);
  });

  server.onWorkerDisconnected((worker) => {
    console.log(`Worker ${worker.name} (${worker.id}) disconnected`);
  });

  // Route messages by type
  server.onWorkerMessage("work_complete", (worker, message) => {
    console.log(`Worker ${worker.id} completed request: ${message.requestId}`);
  });
});
```

## Core Concepts

### Worker Registration & Lifecycle

Workers connect via WebSocket and register with authentication (optional). The server tracks their status, heartbeat, and request load.

```typescript
import { WorkerServer } from "@hardlydifficult/worker-server";

const server = new WorkerServer({ 
  port: 3000,
  authToken: "secret-token" // Optional
});

server.start();
server.onWorkerConnected((worker) => {
  console.log("Worker connected:", worker.id, worker.name);
});
```

Workers send a `worker_registration` message:

```json
{
  "type": "worker_registration",
  "workerId": "worker-1",
  "workerName": "GPU Worker",
  "capabilities": {
    "models": [
      {
        "modelId": "gpt-4",
        "displayName": "GPT-4",
        "maxContextTokens": 32768,
        "maxOutputTokens": 4096,
        "supportsStreaming": true
      }
    ],
    "maxConcurrentRequests": 2
  },
  "authToken": "secret-token"
}
```

The server responds with a registration acknowledgment:

```json
{
  "type": "worker_registration_ack",
  "success": true,
  "sessionId": "uuid-here",
  "heartbeatIntervalMs": 15000
}
```

### Message Routing

Messages are routed by the `type` field. Handlers receive the worker info and message payload.

```typescript
server.onWorkerMessage("status_update", (worker, message) => {
  console.log(`Worker ${worker.id} status: ${message.statusText}`);
});

// Send messages to workers
server.send(workerId, {
  type: "execute",
  requestId: "req-1",
  prompt: "Hello, world!"
});

// Broadcast to all workers
server.broadcast({ type: "shutdown" });
```

### Worker Selection & Load Balancing

Select workers by model support or use any available worker. Workers are automatically assigned least-loaded.

```typescript
// Get the least-loaded worker that supports a specific model
const worker = server.getAvailableWorker("gpt-4");
if (worker) {
  server.send(worker.id, { type: "execute", prompt: "..." });
}

// Get any available worker (model-agnostic)
const anyWorker = server.getAnyAvailableWorker();
```

Request tracking ensures accurate load reporting:

```typescript
// Track when a request is assigned
server.trackRequest(worker.id, requestId);

// Release when the response is received (optionally increment completed count)
server.releaseRequest(requestId, { incrementCompleted: true });
```

### Health Monitoring

Workers must send periodic heartbeats. Unresponsive workers are marked unhealthy and eventually removed.

```typescript
// Heartbeat message format (worker → server)
{
  "type": "heartbeat",
  "workerId": "worker-1",
  "timestamp": "2024-01-01T00:00:00.000Z"
}

// Server response
{
  "type": "heartbeat_ack",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "nextHeartbeatDeadline": "2024-01-01T00:01:00.000Z"
}
```

Health checks run automatically at the configured interval (default: 10s). Workers missing heartbeats for >3× timeout are removed.

```typescript
const server = new WorkerServer({
  port: 3000,
  heartbeatTimeoutMs: 60_000,      // 60 seconds before unhealthy
  healthCheckIntervalMs: 10_000,  // Check every 10 seconds
});
```

### Category-Aware Concurrency

Workers can specify per-category concurrency limits for fine-grained control.

```typescript
const server = new WorkerServer({ port: 3000 });

// Worker registration includes concurrency limits
{
  "capabilities": {
    "models": [.],
    "maxConcurrentRequests": 4,
    "concurrencyLimits": {
      "chat": 2,
      "embedding": 3,
      "tool_use": 1
    }
  }
}

// Track with category
server.trackRequest(worker.id, requestId, "chat");

// Release without specifying category (looked up automatically)
server.releaseRequest(requestId);
```

## HTTP & WebSocket Extensibility

### Custom HTTP Endpoints

Add HTTP handlers that return `true` when they handle the request.

```typescript
server.addHttpHandler(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return true;
  }
  return false;
});
```

### Additional WebSocket Endpoints

Register additional WebSocket paths for non-worker connections.

```typescript
server.addWebSocketEndpoint("/ws/admin", (ws) => {
  ws.on("message", (data) => {
    // Handle admin messages
  });
});
```

### Worker Info

Public worker info (without WebSocket reference):

```typescript
const worker = server.getAvailableWorker("gpt-4");
if (worker) {
  console.log("Active requests:", worker.activeRequests);
  console.log("Completed requests:", worker.completedRequests);
  console.log("Pending request IDs:", [...worker.pendingRequestIds]);
  console.log("Per-category active requests:", worker.categoryActiveRequests);
}
```

## Core Components

### WorkerServer

Main server class managing WebSocket connections, HTTP endpoints, and worker pool.

#### Constructor

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
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
|--------|-------------|
| `addHttpHandler(handler)` | Add an HTTP handler (called in order until one returns `true`) |
| `addWebSocketEndpoint(path, handler)` | Add a WebSocket endpoint at a custom path |

#### Event Handlers

| Method | Return | Description |
|--------|--------|-------------|
| `onWorkerConnected(handler)` | `() => void` | Called when worker registers |
| `onWorkerDisconnected(handler)` | `() => void` | Called when worker disconnects (includes pending requests) |
| `onWorkerMessage(type, handler)` | `() => void` | Register handler for a message type |

### WorkerPool

Internal class managing worker state and selection. Exposed via `WorkerServer`.

| Method | Description |
|--------|-------------|
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

## Type Definitions

### WorkerStatus

| Value | Description |
|-------|-------------|
| `available` | Worker can accept new requests |
| `busy` | Worker is at max concurrent requests |
| `draining` | Worker is shutting down |
| `unhealthy` | Worker heartbeat has timed out |

### ModelInfo

```typescript
interface ModelInfo {
  modelId: string;
  displayName: string;
  maxContextTokens: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsVision?: boolean;
  supportsTools?: boolean;
}
```

### WorkerCapabilities

```typescript
interface WorkerCapabilities {
  models: ModelInfo[];
  maxConcurrentRequests: number;
  metadata?: Record<string, unknown>;
  concurrencyLimits?: Record<string, number>;
}
```

### WorkerInfo

```typescript
interface WorkerInfo {
  id: string;
  name: string;
  status: WorkerStatus;
  capabilities: WorkerCapabilities;
  sessionId: string;
  connectedAt: Date;
  lastHeartbeat: Date;
  activeRequests: number;
  completedRequests: number;
  pendingRequestIds: ReadonlySet<string>;
  categoryActiveRequests: ReadonlyMap<string, number>;
}
```

## Logging

The server accepts a logger implementing `WorkerServerLogger`:

```typescript
interface WorkerServerLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}
```

Default is a no-op logger. To use a custom logger:

```typescript
const server = new WorkerServer({
  port: 3000,
  logger: {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  },
});
```

## Appendix

### Protocol Messages

**Worker Registration (worker → server)**

```json
{
  "type": "worker_registration",
  "workerId": "string",
  "workerName": "string",
  "capabilities": WorkerCapabilities,
  "authToken?": "string"
}
```

**Registration Acknowledgment (server → worker)**

```json
{
  "type": "worker_registration_ack",
  "success": "boolean",
  "error?": "string",
  "sessionId?": "string",
  "heartbeatIntervalMs?": "number"
}
```

**Heartbeat (worker → server)**

```json
{
  "type": "heartbeat",
  "workerId": "string",
  "timestamp": "string"
}
```

**Heartbeat Acknowledgment (server → worker)**

```json
{
  "type": "heartbeat_ack",
  "timestamp": "string",
  "nextHeartbeatDeadline": "string"
}
```