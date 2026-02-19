# @hardlydifficult/worker-server

A WebSocket-based worker server that manages remote worker connections, health monitoring, request routing, and load balancing through a clean TypeScript interface.

## Installation

```bash
npm install @hardlydifficult/worker-server
```

## Quick Start

```typescript
import { WorkerServer } from "@hardlydifficult/worker-server";

const server = new WorkerServer({
  port: 8080,
  heartbeatTimeoutMs: 60000,  // 60 seconds
  healthCheckIntervalMs: 10000,  // 10 seconds
});

server.onWorkerConnected((worker) => {
  console.log(`Worker connected: ${worker.name} (${worker.id})`);
});

server.onWorkerDisconnected((worker, pendingRequests) => {
  console.log(`Worker disconnected: ${worker.name} (${worker.id})`);
  if (pendingRequests.size > 0) {
    console.log(`Rescheduling ${pendingRequests.size} pending requests`);
  }
});

server.onWorkerMessage("work_complete", (worker, message) => {
  console.log(`Work complete: ${message.requestId}`);
});

server.addHttpHandler(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return true;
  }
  return false;
});

await server.start();
console.log("Worker server running on port 8080");
```

## Core Concepts

### Worker Management

Workers connect via WebSocket, register with capabilities (supported models, concurrency limits), and send periodic heartbeats. The server tracks their status (available, busy, draining, unhealthy) and makes routing decisions based on load and model compatibility.

### Request Tracking

Requests are tracked per-worker and can be released when complete. Optional categories enable per-category concurrency limits when workers declare `concurrencyLimits` in their capabilities.

### Load Balancing

Workers are selected based on:
- Model support (exact or substring match)
- Current load (least-loaded algorithm)
- Category-specific limits (when `category` is provided)

## API Reference

### WorkerServer

Main entry point for managing worker connections.

#### Constructor

```typescript
constructor(options: WorkerServerOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `port` | `number` | — | HTTP + WebSocket server port |
| `authToken` | `string` | `undefined` | Optional token required for worker registration |
| `heartbeatTimeoutMs` | `number` | `60000` | Milliseconds before a missed heartbeat marks a worker unhealthy |
| `healthCheckIntervalMs` | `number` | `10000` | Interval (ms) for health checks |
| `heartbeatIntervalMs` | `number` | `15000` | Heartbeat interval communicated to workers |
| `logger` | `WorkerServerLogger` | `undefined` | Logger instance (defaults to no-op) |

#### Lifecycle Events

```typescript
// Called when a worker successfully registers
onWorkerConnected(handler: WorkerConnectedHandler): () => void;

// Called when a worker disconnects with pending request IDs
onWorkerDisconnected(handler: WorkerDisconnectedHandler): () => void;

// Register a handler for a specific message type (dispatched by 'type' field)
onWorkerMessage<T = Record<string, unknown>>(
  type: string,
  handler: WorkerMessageHandler<T>
): () => void;
```

#### Message Operations

```typescript
// Send a JSON message to a specific worker (false if failed)
send(workerId: string, message: Record<string, unknown>): boolean;

// Broadcast to all connected workers
broadcast(message: Record<string, unknown>): void;
```

#### Pool Queries

```typescript
// Get least-loaded worker supporting the given model
getAvailableWorker(model: string, category?: string): WorkerInfo | null;

// Get any available worker (model-agnostic)
getAnyAvailableWorker(): WorkerInfo | null;

// Total connected worker count
getWorkerCount(): number;

// Available worker count
getAvailableWorkerCount(): number;

// Get info about all connected workers
getWorkerInfo(): WorkerInfo[];
```

#### Request Tracking

```typescript
// Track a request assigned to a worker (optional category)
trackRequest(workerId: string, requestId: string, category?: string): void;

// Release a tracked request (optionally increment completed count)
releaseRequest(
  requestId: string,
  options?: { incrementCompleted?: boolean }
): void;
```

#### HTTP & WebSocket Extensibility

```typescript
// Add an HTTP handler (called in order until one returns true)
addHttpHandler(handler: HttpRequestHandler): void;

// Add an additional WebSocket endpoint at a path
addWebSocketEndpoint(
  path: string,
  handler: WebSocketConnectionHandler
): void;
```

#### Server Lifecycle

```typescript
// Start the HTTP + WebSocket server
start(): Promise<void>;

// Stop the server and close all connections
stop(): Promise<void>;
```

### WorkerInfo

Public interface representing a connected worker:

```typescript
interface WorkerInfo {
  readonly id: string;
  readonly name: string;
  readonly status: WorkerStatus;  // "available" | "busy" | "draining" | "unhealthy"
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

### WorkerCapabilities

Describes a worker's capabilities:

```typescript
interface WorkerCapabilities {
  models: ModelInfo[];
  maxConcurrentRequests: number;
  metadata?: Record<string, unknown>;
  concurrencyLimits?: Record<string, number>;
}
```

### ModelInfo

Describes a supported model:

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

### WorkerStatus

Worker state enumeration:

| Status | Description |
|--------|-------------|
| `available` | Worker is idle and can accept new requests |
| `busy` | Worker is at max concurrent requests but may accept model-agnostic tasks |
| `draining` | Worker is being gracefully decommissioned |
| `unhealthy` | Worker has missed heartbeats and is presumed degraded |

## Worker Protocol

Workers communicate using JSON messages with a `type` field:

| Message | Direction | Description |
|---------|-----------|-------------|
| `worker_registration` | Worker → Server | Register with capabilities |
| `worker_registration_ack` | Server → Worker | Acknowledgment with session ID |
| `heartbeat` | Worker → Server | Periodic health check |
| `heartbeat_ack` | Server → Worker | Acknowledgment with next deadline |

All other message types are routed to registered handlers via `onWorkerMessage()`.

## Health Monitoring

- Workers missing heartbeats for `heartbeatTimeoutMs` are marked `unhealthy`
- Workers missing heartbeats for `3 × heartbeatTimeoutMs` are disconnected
- Health checks run every `healthCheckIntervalMs`