# @hardlydifficult/http

HTTP utilities for safe request/response handling: constant-time string comparison, body reading with 1MB limit, and JSON responses with CORS.

## Installation

```bash
npm install @hardlydifficult/http
```

## Quick Start

```typescript
import { safeCompare, readBody, sendJson, MAX_BODY_BYTES } from "@hardlydifficult/http";
import http from "http";

const server = http.createServer(async (req, res) => {
  // Read request body with default 1MB limit
  const body = await readBody(req);

  // Example: compare secrets safely
  const isValid = safeCompare(body, "secret");

  // Send JSON response with CORS support
  sendJson(res, isValid ? 200 : 401, { valid: isValid }, "https://example.com");
});

server.listen(3000);
```

## Constant-Time String Comparison

Protects against timing attacks by using `crypto.timingSafeEqual` internally.

### `safeCompare(a: string, b: string): boolean`

Compares two strings in constant time.

```typescript
import { safeCompare } from "@hardlydifficult/http";

safeCompare("hello", "hello");     // true
safeCompare("hello", "world");     // false
safeCompare("", "something");      // false
safeCompare("héllo", "héllo");     // true (unicode-safe)
```

## Request Body Reading

Reads full request body as string with configurable size limit.

### `readBody(req: IncomingMessage, maxBytes?: number): Promise<string>`

Parses incoming request body up to `maxBytes` (default: `MAX_BODY_BYTES`).

```typescript
import { readBody, MAX_BODY_BYTES } from "@hardlydifficult/http";
import type { IncomingMessage } from "http";

// Use default limit (1MB)
const body1 = await readBody(req);

// Use custom limit (e.g., 512KB)
const body2 = await readBody(req, 512 * 1024);
```

## JSON Response with CORS

Sends JSON responses with CORS headers enabled.

### `sendJson(res: ServerResponse, status: number, body: unknown, corsOrigin: string): void`

Writes JSON response with proper headers and CORS support.

```typescript
import { sendJson } from "@hardlydifficult/http";
import type { ServerResponse } from "http";

sendJson(res, 200, { message: "OK" }, "https://example.com");
// Sends:
//   Content-Type: application/json
//   Access-Control-Allow-Origin: https://example.com
//   Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
//   Access-Control-Allow-Headers: Content-Type, Authorization
// Body: {"message":"OK"}
```

## Constants

### `MAX_BODY_BYTES`

Default maximum body size in bytes (1 MB = 1048576).

```typescript
import { MAX_BODY_BYTES } from "@hardlydifficult/http";

MAX_BODY_BYTES; // 1048576
```