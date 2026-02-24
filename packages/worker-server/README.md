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

server.onWorkerDisconnected((worker, pendingRequestIds) => {
  console.log(`Worker ${worker.id} disconnected with ${pendingRequestIds.size} pending requests`);
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

## Worker Lifecycle

### Registration

Workers register by sending a `worker_registration` message with `workerId`, `workerName`, and `capabilities`. Optionally include an `authToken` if authentication is enabled.

```typescript
// Worker-side registration example
const ws = new WebSocket("ws://localhost:19100/ws");

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: "worker_registration",
    workerId: "worker-1",
    workerName: "My Worker",
    capabilities: {
      models: [{
        modelId: "gpt-4",
        displayName: "GPT-4",
        maxContextTokens: 32768,
        maxOutputTokens: 8192,
        supportsStreaming: true
      }],
      maxConcurrentRequests: 4,
      concurrencyLimits: {
        local: 2,
        remote: 4
      }
    },
    authToken: "secret-token"
  }));
};
```

### Heartbeat Monitoring

Workers must send periodic heartbeats to remain healthy. The server automatically marks workers unhealthy if heartbeats are missed and disconnects them after `3x` the timeout period.

## Message Operations

### Sending Messages to Workers

```typescript
// Send a message to a specific worker
const success = server.send(workerId, {
  type: "work_request",
  requestId: "req-123",
  input: "Process this data"
});

// Broadcast to all connected workers
server.broadcast({ type: "shutdown" });
```

### Registering Message Handlers

```typescript
server.onWorkerMessage("work_complete", (worker, message) => {
  console.log(`Result for request ${message.requestId}`);
});
```

## Worker Pool Queries

### Get Available Workers

```typescript
// Get least-loaded worker supporting a specific model
const worker = server.getAvailableWorker("gpt-4");
if (worker) {
  server.trackRequest(worker.id, "req-123", "local");
  server.send(worker.id, { type: "work_request", data: "..." });
}

// Get any available worker (model-agnostic)
const anyWorker = server.getAnyAvailableWorker();
```

### Slot Counting

```typescript
// Total free slots for a model
const slots = server.getAvailableSlotCount("gpt-4");
console.log(`Can accept ${slots} more requests`);

// With category-based limits
const categorySlots = server.getAvailableSlotCount("gpt-4", "local");
```

## Request Tracking

Track requests to maintain accurate worker load statistics.

```typescript
// Mark a request as in-progress
server.trackRequest(workerId, requestId, "local");

// Release the request when complete
server.releaseRequest(requestId, { incrementCompleted: true });
```

## Authentication

Configure an authentication token to require workers to provide credentials during registration.

```typescript
const server = new WorkerServer({
  port: 19100,
  authToken: "my-secret-token"
});

// Worker registration must include matching token
ws.send(JSON.stringify({
  type: "worker_registration",
  workerId: "worker-1",
  workerName: "My Worker",
  capabilities: { ... },
  authToken: "my-secret-token"
}));
```

## Event Handlers

### Connection Events

```typescript
server.onWorkerConnected((worker) => {
  console.log(`Worker connected: ${worker.id} (${worker.name})`);
});

server.onWorkerDisconnected((worker, pendingRequestIds) => {
  console.log(`Worker ${worker.id} disconnected`);
  if (pendingRequestIds.size > 0) {
    console.log(`Pending requests: ${[...pendingRequestIds].join(", ")}`);
  }
});
```

## HTTP Endpoints

### Custom HTTP Handlers

```typescript
server.addHttpHandler(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return true;
  }
  return false; // Continue to next handler or return 404
});
```

### Custom WebSocket Endpoints

```typescript
server.addWebSocketEndpoint("/ws/metrics", (ws) => {
  ws.on("message", (msg) => {
    // Handle metrics-specific messages
  });
});
```

## Server Lifecycle

```typescript
// Start the server
await server.start();

// Stop gracefully
await server.stop();
```

## Types and Interfaces

### WorkerStatus

Worker states:

- `available`: Ready to accept new work
- `busy`: At capacity, no new requests
- `draining`: Rejecting new requests, finishing existing
- `unhealthy`: Heartbeat timeout exceeded

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

### WorkerCapabilities

```typescript
interface WorkerCapabilities {
  models: ModelInfo[];
  maxConcurrentRequests: number;
  metadata?: Record<string, unknown>;
  concurrencyLimits?: Record<string, number>;
}
```

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

## Advanced: Category-Based Concurrency

Workers can define per-category concurrency limits:

```typescript
capabilities: {
  models: [{ modelId: "gpt-4", ... }],
  maxConcurrentRequests: 10,
  concurrencyLimits: {
    local: 2,
    remote: 4
  }
}
```

When tracking requests with a category:

```typescript
server.trackRequest(workerId, requestId, "local");
server.releaseRequest(requestId);
```

Slot counting respects category limits:

```typescript
server.getAvailableSlotCount("gpt-4", "local");
```