# @hardlydifficult/http

HTTP utilities for safe request/response handling: body reading with size limits, constant-time comparison, and JSON responses with CORS.

## Installation

```bash
npm install @hardlydifficult/http
```

## Quick Start

```typescript
import { readBody, sendJson, safeCompare } from "@hardlydifficult/http";
import { createServer } from "http";

const server = createServer(async (req, res) => {
  // Read request body safely (max 1MB by default)
  const body = await readBody(req);
  if (!safeCompare(body, "secret")) {
    sendJson(res, 401, { error: "Unauthorized" }, "*");
    return;
  }

  // Send JSON response with CORS headers
  sendJson(res, 200, { message: "Access granted" }, "https://example.com");
});

server.listen(3000);
```

## Request Handling

### `readBody`

Reads the full request body as a string, rejecting if it exceeds the size limit.

```typescript
import { readBody, MAX_BODY_BYTES } from "@hardlydifficult/http";

// Default max: 1 MB
const body = await readBody(req);

// Custom limit (e.g., 500 KB)
const body = await readBody(req, 500 * 1024);
```

| Parameter | Type            | Default       | Description                          |
|-----------|-----------------|---------------|--------------------------------------|
| `req`     | `IncomingMessage` | —             | Node.js HTTP request object          |
| `maxBytes`| `number`          | `MAX_BODY_BYTES` (1 MB) | Maximum body size in bytes |

Throws `Error` with message `"Payload too large"` if body exceeds limit.

### `MAX_BODY_BYTES`

Constant defining the default maximum body size (1 MB = 1024 * 1024 bytes).

```typescript
import { MAX_BODY_BYTES } from "@hardlydifficult/http";

console.log(MAX_BODY_BYTES); // 1048576
```

## Response Handling

### `sendJson`

Sends a JSON response with CORS headers.

```typescript
import { sendJson } from "@hardlydifficult/http";

sendJson(res, 200, { data: "value" }, "https://example.com");
```

| Parameter      | Type       | Description                                      |
|----------------|------------|--------------------------------------------------|
| `res`          | `ServerResponse` | Node.js HTTP response object                   |
| `status`       | `number`     | HTTP status code (e.g., `200`, `404`)           |
| `body`         | `unknown`    | Data to serialize as JSON (e.g., object, array) |
| `corsOrigin`   | `string`     | CORS `Access-Control-Allow-Origin` value (e.g., `"*"`, `"https://example.com"`) |

Includes these headers:
- `Content-Type: application/json`
- `Access-Control-Allow-Origin: <corsOrigin>`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`

## Security

### `safeCompare`

Constant-time string comparison to prevent timing attacks.

```typescript
import { safeCompare } from "@hardharddifficult/http";

if (safeCompare(userInput, "expected")) {
  // Safe comparison (timing-independent)
}
```

Valid for:
- Equal strings (including empty strings)
- Different strings of same/different length
- Unicode strings (e.g., `"héllo"`)

Returns `false` for unequal strings regardless of length difference.