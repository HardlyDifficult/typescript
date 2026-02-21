# @hardlydifficult/http

HTTP utilities for safe request/response handling: body reading with size limits, constant-time comparison, and JSON responses with CORS.

## Installation

```bash
npm install @hardlydifficult/http
```

## Quick Start

```typescript
import http from "http";
import { readBody, sendJson, safeCompare } from "@hardlydifficult/http";

const server = http.createServer(async (req, res) => {
  const body = await readBody(req);
  
  // Compare tokens safely
  if (!safeCompare(body, "secret-token")) {
    sendJson(res, 401, { error: "Unauthorized" }, "*");
    return;
  }
  
  sendJson(res, 200, { success: true }, "https://example.com");
});

server.listen(3000);
```

## Request Handling

### `readBody`

Reads the full HTTP request body as a string, with an optional size limit.

```typescript
function readBody(req: IncomingMessage, maxBytes?: number): Promise<string>
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `req` | `IncomingMessage` | Node.js HTTP incoming message |
| `maxBytes` | `number` | Maximum body size in bytes (default: `MAX_BODY_BYTES`, 1 MB) |

Throws `"Payload too large"` error if the body exceeds the limit.

```typescript
import { readBody, MAX_BODY_BYTES } from "@hardlydifficult/http";

// Default 1MB limit
const body = await readBody(req);

// Custom limit (500 KB)
const smallBody = await readBody(req, 500 * 1024);
```

### `MAX_BODY_BYTES`

The default maximum body size (1 MB).

```typescript
import { MAX_BODY_BYTES } from "@hardlydifficult/http";
console.log(MAX_BODY_BYTES); // 1048576
```

## Response Handling

### `sendJson`

Sends a JSON response with CORS headers.

```typescript
function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  corsOrigin: string
): void
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `res` | `ServerResponse` | Node.js HTTP server response |
| `status` | `number` | HTTP status code |
| `body` | `unknown` | JSON-serializable data |
| `corsOrigin` | `string` | CORS `Access-Control-Allow-Origin` value |

Headers sent:
- `Content-Type: application/json`
- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

```typescript
import { sendJson } from "@hardlydifficult/http";

sendJson(res, 200, { id: 1, name: "Alice" }, "https://trusted.com");
```

## Security

### `safeCompare`

Constant-time string comparison to prevent timing attacks.

```typescript
function safeCompare(a: string, b: string): boolean
```

Uses `crypto.timingSafeEqual` internally. Handles length differences safely.

```typescript
import { safeCompare } from "@hardlydifficult/http";

// Safe comparison of auth tokens
if (safeCompare(storedToken, requestToken)) {
  // Grant access
}
```