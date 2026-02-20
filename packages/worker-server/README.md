# @hardlydifficult/worker-server

WebSocket-based worker server with health monitoring, request routing, and load balancing.

## Installation

```bash
npm install @hardlydifficult/worker-server
```

## Quick Start

```typescript
import { WorkerServer } from "@hardlydifficult/worker-server";

const server = new WorkerServer({ port: 8080 });

server.onWorkerConnected((worker) => {
  console.log(`Worker ${worker.name} connected (${worker.id})`);
});

server.onWorkerDisconnected((worker, pending) => {
  console.log(`Worker ${worker.name} disconnected with ${pending.size} pending requests`);
});

server.onWorkerMessage("work_complete", (worker, message) => {
  console.log(`Worker ${worker.id} completed request ${message.requestId}`);
});

await server.start();
console.log("Server listening on port 8080");
```

## Core Components

### WorkerServer

WebSocket server managing remote worker connections with health checks, message routing, and pool management.

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

### WorkerPool

Manages worker lifecycle, request tracking, health checks, and message routing.

#### Worker Status

Workers transition automatically between states:
- `available`: Ready to accept new requests
- `busy`: At maximum concurrent request capacity
- `draining`: In the process of shutting down
- `unhealthy`: Heartbeat missed beyond timeout threshold

#### Pool Operations

```typescript
import { WorkerPool, WorkerStatus, type ConnectedWorker } from "@hardlydifficult/worker-server";

const pool = new WorkerPool();

// Get the least-loaded available worker supporting a model
const worker = pool.getAvailableWorker("sonnet-3.5", "inference");

// Get any available or busy worker
const anyWorker = pool.getAnyAvailableWorker();

// Get count statistics
const total = pool.getCount();
const available = pool.getAvailableCount();

// Get worker info (without WebSocket reference)
const workers = pool.getWorkerInfoList();

// Track and release requests
pool.trackRequest("worker-1", "req-123");
pool.releaseRequest("req-123");

// Check for unhealthy workers
const deadWorkerIds = pool.checkHealth(60_000); // 60-second timeout

// Send and broadcast messages
pool.send("worker-1", { type: "ping" });
pool.broadcast({ type: "shutdown" });
```

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

## Types and Interfaces

### WorkerInfo

Public worker metadata exposed to consumers:

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

Describes what a worker can do:

```typescript
interface WorkerCapabilities {
  models: ModelInfo[];
  maxConcurrentRequests: number;
  metadata?: Record<string, unknown>;
  concurrencyLimits?: Record<string, number>; // per-category limits
}

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