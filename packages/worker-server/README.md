# @hardlydifficult/worker-server

WebSocket-based remote worker server with health monitoring, message routing, and load balancing.

## Installation

```bash
npm install @hardlydifficult/worker-server
```

## Quick Start

```typescript
import { WorkerServer } from "@hardlydifficult/worker-server";

const server = new WorkerServer({
  port: 19100,
  authToken: "secret-token", // optional
});

server.onWorkerConnected((worker) => {
  console.log(`Worker ${worker.name} connected`);
});

server.onWorkerMessage("work_complete", (worker, message) => {
  console.log(`Worker ${worker.id} completed:`, message);
});

await server.start();
console.log("Server listening on port", server.port);

// Send a message to a worker
const worker = server.getAvailableWorker("sonnet");
if (worker) {
  server.send(worker.id, { type: "work_request", requestId: "req-123" });
}
```

## Core Concepts

### WorkerServer

Main entry point for managing worker connections via WebSocket.

```typescript
import { WorkerServer, WorkerStatus } from "@hardlydifficult/worker-server";

const server = new WorkerServer({
  port: 19100,
  heartbeatTimeoutMs: 60_000,
  healthCheckIntervalMs: 10_000,
  heartbeatIntervalMs: 15_000,
});

await server.start();
await server.stop();
```

#### Lifecycle Events

| Method | Description |
|--------|-------------|
| `onWorkerConnected(handler)` | Called when a worker registers successfully |
| `onWorkerDisconnected(handler)` | Called when a worker disconnects; includes pending request IDs |

```typescript
server.onWorkerConnected((worker) => {
  console.log(`Connected: ${worker.id} (${worker.name})`);
});

server.onWorkerDisconnected((worker, pendingRequestIds) => {
  console.log(`Disconnected: ${worker.id} with ${pendingRequestIds.size} pending requests`);
});
```

#### Message Routing

Register handlers for message types sent by workers:

```typescript
server.onWorkerMessage("work_complete", (worker, message) => {
  const { requestId, result } = message;
  console.log(`Worker ${worker.id} completed ${requestId}`);
});

// Send messages to workers
const success = server.send(workerId, { type: "work_request", requestId: "req-1" });
server.broadcast({ type: "shutdown" });
```

#### Worker Selection & Pool Queries

| Method | Description |
|--------|-------------|
| `getAvailableWorker(model, category?)` | Least-loaded worker supporting the model |
| `getAnyAvailableWorker()` | Any available or busy worker (model-agnostic) |
| `getAvailableSlotCount(model, category?)` | Total free slots across all available workers |
| `getWorkerCount()` | Total connected workers |
| `getAvailableWorkerCount()` | Available workers count |
| `getWorkerInfo()` | Public info for all workers |

```typescript
// Get least-loaded worker supporting a model
const worker = server.getAvailableWorker("sonnet");
if (worker) {
  server.trackRequest(worker.id, "req-123", "local");
}

// Slot counts with category-aware limits
console.log("Available slots:", server.getAvailableSlotCount("sonnet", "local"));

// View all workers
for (const info of server.getWorkerInfo()) {
  console.log(`${info.name}: ${info.status} (${info.activeRequests}/${info.capabilities.maxConcurrentRequests})`);
}
```

#### Request Tracking

Track and release requests for accurate availability:

```typescript
// When assigning a request to a worker
server.trackRequest(workerId, requestId, "local");

// When the request completes
server.releaseRequest(requestId, { incrementCompleted: true });
```

#### Extensibility

Add HTTP endpoints and custom WebSocket paths:

```typescript
// HTTP handler
server.addHttpHandler(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }
  return false;
});

// Custom WebSocket endpoint
server.addWebSocketEndpoint("/ws/dashboard", (ws) => {
  ws.send(JSON.stringify({ type: "hello" }));
});
```

### WorkerPool

Low-level pool manager for worker state and selection.

```typescript
import { WorkerPool, toWorkerInfo, WorkerStatus } from "@hardlydifficult/worker-server";

const pool = new WorkerPool(logger);

// Add/remove workers
pool.add(worker);
pool.remove(workerId);
const worker = pool.get(workerId);
```

#### Selection Logic

| Method | Description |
|--------|-------------|
| `getAvailableWorker(model, category?)` | Least-loaded worker supporting the model, respecting per-category concurrency limits |
| `getAnyAvailableWorker()` | Any available or busy worker (model-agnostic) |
| `getAvailableSlotCount(model, category?)` | Total free slots across all available workers for the model |
| `getCount()` | Total connected workers |
| `getAvailableCount()` | Available workers count |
| `getWorkerInfoList()` | Public info for all workers |

#### Request Management

| Method | Description |
|--------|-------------|
| `trackRequest(workerId, requestId, category?)` | Marks request as in-flight and updates status |
| `releaseRequest(requestId, options?)` | Decrements active count, optionally increments completed count |

#### Health Monitoring

| Method | Description |
|--------|-------------|
| `checkHealth(timeoutMs)` | Returns IDs of workers exceeding `3x` timeout; marks unhealthy ones |

### ConnectionHandler

Handles WebSocket lifecycle, registration, heartbeats, and message routing. Most consumers use `WorkerServer`, which encapsulates this.

### Message Protocol

Workers send JSON messages with a `type` field:

- `worker_registration` — Register with capabilities and optional `authToken`
- `heartbeat` — Send periodically to confirm liveness

The server responds with:
- `worker_registration_ack` — Success/failure with `sessionId` and `heartbeatIntervalMs`
- `heartbeat_ack` — Acknowledgment with `nextHeartbeatDeadline`

### Types & Interfaces

#### `WorkerStatus`

| Value | Description |
|-------|-------------|
| `available` | Worker can accept new requests |
| `busy` | Worker at capacity, but can accept model-agnostic tasks |
| `draining` | Worker finishing current work before shutdown |
| `unhealthy` | Worker failed heartbeat checks |

#### `WorkerInfo`

Public worker metadata (excludes raw WebSocket):

```typescript
interface WorkerInfo {
  readonly id: string;
  readonly name: string;
  readonly status: WorkerStatus;
  readonly capabilities: WorkerCapabilities;
  readonly sessionId: string;
  readonly connectedAt: Date;
  readonly lastHeartbeat: Date;
  readonly activeRequests: number;
  readonly completedRequests: number;
  readonly pendingRequestIds: ReadonlySet<string>;
  readonly categoryActiveRequests: ReadonlyMap<string, number>;
}
```

#### `WorkerCapabilities`

```typescript
interface WorkerCapabilities {
  models: ModelInfo[];
  maxConcurrentRequests: number;
  metadata?: Record<string, unknown>;
  concurrencyLimits?: Record<string, number>; // per-category limits
}
```

#### `ModelInfo`

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

### Secure Authentication

Authentication tokens are compared using timing-safe comparison to prevent brute-force attacks:

```typescript
import { safeCompare } from "@hardlydifficult/worker-server";
// Internally used by ConnectionHandler; exposed for testing
const valid = safeCompare("a", "b"); // false
```

Workers must send the token in registration:

```json
{
  "type": "worker_registration",
  "workerId": "worker-1",
  "workerName": "My Worker",
  "capabilities": { ... },
  "authToken": "secret-token"
}
```

### Heartbeat Protocol

Workers must send periodic heartbeat messages:

```json
{
  "type": "heartbeat",
  "workerId": "worker-1",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

The server responds with:

```json
{
  "type": "heartbeat_ack",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "nextHeartbeatDeadline": "2024-01-01T00:01:15.000Z"
}
```

A worker is considered unhealthy if its heartbeat exceeds `heartbeatTimeoutMs`. It is marked dead and disconnected after `3x` the timeout.