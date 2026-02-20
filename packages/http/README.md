# @hardlydifficult/http

HTTP utilities for safe request/response handling: body reading with size limits, constant-time comparison, and JSON responses with CORS.

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

## Core HTTP Utilities

### Reading Request Body

Safely reads request body with a configurable size limit (default 1 MB) to prevent memory exhaustion.

```typescript
import { readBody, MAX_BODY_BYTES } from '@hardlydifficult/http';
import { IncomingMessage } from 'http';

// Default: 1,048,576 bytes (1 MB)
const body = await readBody(req as IncomingMessage);
const text = body.toString();

// Explicit limit
const body2 = await readBody(req as IncomingMessage, 500_000); // 500 KB limit
```

| Parameter | Type | Description |
|---|---|---|
| req | `IncomingMessage` | HTTP request stream |
| maxBytes? | `number` | Maximum body size in bytes (default: `MAX_BODY_BYTES`) |

**Throws:** `Error` if body exceeds `maxBytes`.

### Sending JSON Responses

Sends JSON with `Content-Type: application/json` and CORS headers.

```typescript
import { sendJson } from '@hardlydifficult/http';
import { ServerResponse } from 'http';

sendJson(res as ServerResponse, { success: true });
// Sets headers: Content-Type: application/json, Access-Control-Allow-Origin: *
```

| Parameter | Type | Description |
|---|---|---|
| res | `ServerResponse` | HTTP response object |
| data | `any` | Serializable data to send as JSON |

## Response Handling

### `sendJson`

Sends a JSON response with CORS headers.

```typescript
import { sendJson } from "@hardlydifficult/http";

sendJson(res, 200, { data: "example" }, "https://example.com");
```

| Parameter | Type | Description |
|---|---|---|
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

```typescript
import { safeCompare } from '@hardlydifficult/http';

// True (same content)
const match1 = safeCompare('abc', 'abc'); // => true

// False (different content)
const match2 = safeCompare('abc', 'abd'); // => false

// False (different length)
const match3 = safeCompare('abc', 'abcd'); // => false

// Works with unicode
const match4 = safeCompare('你好', '你好'); // => true
```

| Parameters | Type | Description |
|---|---|---|
| a | `string` | First string |
| b | `string` | Second string |

**Returns:** `boolean` — `true` if strings are identical, `false` otherwise.

## Constants

### `MAX_BODY_BYTES`

Default maximum body size in bytes (1,048,576 = 1 MB).

```typescript
import { MAX_BODY_BYTES } from '@hardlydifficult/http';

// MAX_BODY_BYTES === 1024 * 1024
console.log(MAX_BODY_BYTES); // 1048576
```