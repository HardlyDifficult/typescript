# @hardlydifficult/http

HTTP utilities for safe request/response handling: constant-time string comparison, body reading with size limits, and JSON responses with CORS headers.

## Installation

```bash
npm install @hardlydifficult/http
```

## Quick Start

```typescript
import { createServer } from "http";
import { readBody, sendJson, safeCompare } from "@hardlydifficult/http";

const server = createServer(async (req, res) => {
  // Read request body safely
  const body = await readBody(req);
  const token = JSON.parse(body).token;

  // Compare tokens securely
  const isMatch = safeCompare(token, process.env.SECRET_TOKEN ?? "");
  if (!isMatch) {
    sendJson(res, 401, { error: "Unauthorized" }, "https://example.com");
    return;
  }

  // Send JSON response with CORS headers
  sendJson(res, 200, { message: "Access granted" }, "https://example.com");
});

server.listen(3000);
```

## Request Handling

### `readBody`

Reads the full request body as a string, rejecting if it exceeds `maxBytes`.

```typescript
import { readBody } from "@hardlydifficult/http";

// Default limit is 1 MB
const body = await readBody(req);

// Custom limit (e.g., 500 KB)
const body = await readBody(req, 500 * 1024);
```

| Parameter | Type | Description |
|---------|------|-------------|
| `req` | `IncomingMessage` | Node.js HTTP request |
| `maxBytes?` | `number` | Maximum body size in bytes (default: `1048576`) |

Throws `"Payload too large"` error when body exceeds limit.

### `MAX_BODY_BYTES`

Default maximum body size: `1024 * 1024` (1 MB).

```typescript
import { MAX_BODY_BYTES } from "@hardlydifficult/http";

console.log(MAX_BODY_BYTES); // 1048576
```

## Response Handling

### `sendJson`

Sends a JSON response with CORS headers.

```typescript
import { sendJson } from "@hardlydifficult/http";

sendJson(res, 200, { data: "example" }, "https://example.com");
```

| Parameter | Type | Description |
|---------|------|-------------|
| `res` | `ServerResponse` | Node.js HTTP response |
| `status` | `number` | HTTP status code |
| `body` | `unknown` | Serializable data to send |
| `corsOrigin` | `string` | `Access-Control-Allow-Origin` value |

Sets headers:
- `Content-Type: application/json`
- `Access-Control-Allow-Origin: corsOrigin`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Security

### `safeCompare`

Constant-time string comparison to prevent timing attacks.

```typescript
import { safeCompare } from "@hardlydifficult/http";

const isValid = safeCompare(userInput, secretToken);
```

Returns `true` for identical strings (including empty strings) and `false` otherwise, regardless of string length or content differences.

Handles:
- Equal/unequal strings
- Different-length strings
- Unicode characters
- Empty strings

All comparisons run in time proportional to the first string's length.