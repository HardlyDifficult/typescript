# @hardlydifficult/http

HTTP utilities for safe request/response handling, including constant-time string comparison, body reading with size limits, and JSON responses with CORS headers.

## Installation

```bash
npm install @hardlydifficult/http
```

## Quick Start

```typescript
import { readBody, sendJson, safeCompare } from '@hardlydifficult/http';

// Safe string comparison
const isMatch = safeCompare('secret', 'secret'); // true

// Read request body with 1MB limit
const body = await readBody(req); // max 1MB

// Send JSON response with CORS headers
sendJson(res, { status: 'ok' });
```

## HTTP Utilities

### Safe String Comparison

Performs constant-time comparison of two strings to prevent timing attacks.

```typescript
import { safeCompare } from '@hardlydifficult/http';

const result = safeCompare('abc123', 'abc123'); // true
const fail = safeCompare('abc123', 'abc124');   // false
```

| Parameter | Type   | Description         |
|-----------|--------|---------------------|
| a         | string | First string to compare |
| b         | string | Second string to compare |

### Reading Request Body

Reads and returns the request body as a string, enforcing a maximum size limit of 1 MB.

```typescript
import { readBody, MAX_BODY_BYTES } from '@hardlydifficult/http';

const body = await readBody(req); // max 1,048,576 bytes (1 MB)
// Throws Error if body exceeds MAX_BODY_BYTES
```

| Parameter | Type               | Description                    |
|-----------|--------------------|--------------------------------|
| req       | IncomingMessage    | Node.js HTTP request object    |

### Sending JSON Responses

Sends a JSON response with appropriate `Content-Type` and `Access-Control-Allow-Origin` headers.

```typescript
import { sendJson } from '@hardlydifficult/http';

sendJson(res, { message: 'Hello world' });
// Sends: {"message":"Hello world"} with CORS headers
```

| Parameter | Type     | Description                     |
|-----------|----------|---------------------------------|
| res       | ServerResponse | Node.js HTTP response object |
| data      | unknown  | Data to serialize as JSON       |

## Appendix

### Body Size Limit Behavior

The `readBody` function enforces a strict 1 MB (`MAX_BODY_BYTES = 1024 * 1024`) limit. If the request body exceeds this, it throws an error:

```typescript
if (received > MAX_BODY_BYTES) {
  throw new Error(`Body exceeded maximum size of ${MAX_BODY_BYTES} bytes`);
}
```