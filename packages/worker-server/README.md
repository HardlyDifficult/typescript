# @hardlydifficult/worker-server

WebSocket-based remote worker server with health monitoring, message routing, and an opinionated dispatch-first API.

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
  console.log(`Worker connected: ${worker.name}`);
});

server.onWorkerDisconnected((worker) => {
  console.log(
    `Worker ${worker.id} disconnected with ${worker.requests.pendingIds.length} pending requests`
  );
});

server.onWorkerMessage<{
  type: "work_complete";
  requestId: string;
  output: string;
}>("work_complete", (event) => {
  event.complete();
  console.log(`Worker ${event.worker.id} completed ${event.requestId}`);
});

await server.start();
console.log("Server listening on port", server.port);

const dispatched = server.dispatch({
  model: "sonnet",
  category: "local",
  message: {
    type: "work_request",
    requestId: "req-123",
    input: "Process this data",
  },
});

if (dispatched === null) {
  throw new Error("No worker available");
}

console.log(`Dispatched ${dispatched.requestId} to ${dispatched.worker.name}`);
```

## Dispatch Work

`dispatch()` is the main API. It picks an eligible worker, sends the message, tracks the request, and returns a handle that owns completion.

```typescript
const dispatched = server.dispatch({
  model: "gpt-4",
  category: "remote",
  message: {
    type: "work_request",
    requestId: "req-42",
    prompt: "Summarize this document",
  },
});

if (dispatched === null) {
  console.log("No worker can accept this request");
} else {
  console.log(dispatched.worker.id);

  // Explicit success / failure accounting
  dispatched.complete();
  // or dispatched.fail();
}
```

If `model` is omitted, the server picks any worker with capacity.

## Handle Worker Messages

`onWorkerMessage()` receives a single event object. If the message carries a `requestId`, `event.complete()` and `event.fail()` settle the tracked request.

```typescript
server.onWorkerMessage<{
  type: "work_complete";
  requestId: string;
  result: string;
}>("work_complete", (event) => {
  console.log(event.message.result);
  event.complete();
});

server.onWorkerMessage<{
  type: "worker_status";
  status: string;
}>("worker_status", (event) => {
  console.log(event.message.status);

  // Safe no-op because this message has no requestId
  event.complete();
});
```

## Inspect Worker State

`listWorkers()` returns immutable snapshots. Pending request ids and category counts are plain arrays/objects, not live `Set`/`Map` references.

```typescript
for (const worker of server.listWorkers()) {
  console.log(worker.id, worker.requests.active);
  console.log(worker.requests.pendingIds);
  console.log(worker.requests.activeByCategory);
}
```

Use `availableSlots()` to answer capacity questions.

```typescript
const totalSlots = server.availableSlots("gpt-4");
const localSlots = server.availableSlots("gpt-4", "local");
```

## Worker Lifecycle

### Registration

Workers register by sending a `worker_registration` message with `workerId`, `workerName`, and `capabilities`. Include `authToken` when authentication is enabled.

```typescript
const ws = new WebSocket("ws://localhost:19100/ws");

ws.onopen = () => {
  ws.send(
    JSON.stringify({
      type: "worker_registration",
      workerId: "worker-1",
      workerName: "My Worker",
      capabilities: {
        models: [
          {
            modelId: "gpt-4",
            displayName: "GPT-4",
            maxContextTokens: 32768,
            maxOutputTokens: 8192,
            supportsStreaming: true,
          },
        ],
        maxConcurrentRequests: 4,
        concurrencyLimits: {
          local: 2,
          remote: 4,
        },
      },
      authToken: "secret-token",
    })
  );
};
```

### Heartbeat Monitoring

Workers must send periodic heartbeats to remain healthy. The server marks workers unhealthy when heartbeats are missed and disconnects them after `3x` the timeout period.

## Broadcast Messages

```typescript
server.broadcast({ type: "shutdown" });
```

## Authentication

```typescript
const server = new WorkerServer({
  port: 19100,
  authToken: "my-secret-token",
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

  return false;
});
```

### Custom WebSocket Endpoints

```typescript
server.addWebSocketEndpoint("/ws/metrics", (ws) => {
  ws.on("message", (msg) => {
    console.log(msg.toString());
  });
});
```

## Server Lifecycle

```typescript
await server.start();
await server.stop();
```

## Types

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
  requests: {
    active: number;
    completed: number;
    pendingIds: readonly string[];
    activeByCategory: Readonly<Record<string, number>>;
  };
}
```

### DispatchedRequest

```typescript
interface DispatchedRequest<T extends WorkerMessage & { requestId: string }> {
  worker: WorkerInfo;
  message: T;
  requestId: string;
  complete(): void;
  fail(): void;
}
```

### WorkerMessageEvent

```typescript
interface WorkerMessageEvent<T extends WorkerMessage = WorkerMessage> {
  worker: WorkerInfo;
  message: T;
  requestId: string | null;
  complete(): void;
  fail(): void;
}
```
