# @hardlydifficult/http

HTTP utilities for safe request/response handling: constant-time string comparison, body reading with 1MB limit, and JSON responses with CORS.

## Installation

```bash
npm install @hardlydifficult/http
```

## Quick Start

```typescript
import { readBody, sendJson, safeCompare, MAX_BODY_BYTES } from "@hardlydifficult/http";
import { createServer } from "http";

const server = createServer(async (req, res) => {
  const body = await readBody(req);
  const isValid = safeCompare(body, "expected-secret");
  
  sendJson(res, isValid ? 200 : 403, { authorized: isValid }, "https://example.com");
});

server.listen(3000);
// → Server starts and safely compares incoming request bodies
```

## Body Reading with Size Limit

Reads the full HTTP request body as a string, enforcing a configurable maximum size (default 1 MB). Throws an error if the payload exceeds the limit.

```typescript
import { readBody, MAX_BODY_BYTES } from "@hardlydifficult/http";

// Default limit: 1 MB
const body = await readBody(request);

// Custom limit: 500 KB
const body = await readBody(request, 1024 * 500);
```

### Error Handling

If the body exceeds the specified limit, the promise rejects with an `"Payload too large"` error.

## JSON Response with CORS

Sends a JSON response with CORS headers enabled.

| Parameter | Type | Description |
|---------|------|-------------|
| `res` | `ServerResponse` | Node.js HTTP response object |
| `status` | `number` | HTTP status code |
| `body` | `unknown` | Any serializable data |
| `corsOrigin` | `string` | Allowed origin for CORS (e.g., `"*"` or `"https://example.com"`) |

```typescript
import { sendJson } from "@hardlydifficult/http";

sendJson(
  res,
  201,
  { id: 123, message: "Created" },
  "https://frontend.example.com"
);
// → Sets headers: Content-Type, Access-Control-Allow-Origin, etc.
```

## Constant-Time String Comparison

Performs secure string comparison using `crypto.timingSafeEqual` to prevent timing attacks.

```typescript
import { safeCompare } from "@hardlydifficult/http";

const isMatch = safeCompare(userProvidedToken, storedToken);
// → true if strings are identical, false otherwise
```

### Behavior Details

- Returns `true` only for identical strings (including empty strings).
- Returns `false` for different-length strings, with constant-time behavior.
- Handles Unicode correctly by comparing UTF-8 encoded buffers.

### Example Edge Cases

```typescript
safeCompare("", "");               // true
safeCompare("abc", "abc");         // true
safeCompare("abc", "abd");         // false
safeCompare("short", "longer");    // false
safeCompare("héllo", "héllo");     // true
safeCompare("héllo", "hello");     // false
```