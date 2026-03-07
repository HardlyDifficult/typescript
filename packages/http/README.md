# @hardlydifficult/http

Opinionated HTTP helpers for small Node servers. The API is intentionally narrow:
- request bodies default to a 1 MB limit
- JSON responses default to `200` with CORS open to `*`
- constant-time comparison accepts nullable values and fails closed on missing tokens

## Installation

```bash
npm install @hardlydifficult/http
```

## Quick Start

```typescript
import http from "http";
import { json, readJson, safeCompare } from "@hardlydifficult/http";

const server = http.createServer(async (req, res) => {
  const body = await readJson<{ token?: string }>(req);

  if (!safeCompare(body.token, "secret-token")) {
    json(res, { error: "Unauthorized" }, { status: 401 });
    return;
  }

  json(res, { success: true });
});

server.listen(3000);
```

## Request Helpers

### `readBody`

Reads the full HTTP request body as a string.

```typescript
function readBody(
  req: IncomingMessage,
  options?: { maxBytes?: number }
): Promise<string>
```

```typescript
import { readBody } from "@hardlydifficult/http";

const body = await readBody(req);
const smallBody = await readBody(req, { maxBytes: 500 * 1024 });
```

### `readJson`

Reads and parses a JSON request body.

```typescript
function readJson<T>(
  req: IncomingMessage,
  options?: { maxBytes?: number }
): Promise<T>
```

Throws `"Invalid JSON body"` when parsing fails.

```typescript
import { readJson } from "@hardlydifficult/http";

const payload = await readJson<{ name: string }>(req);
```

### `MAX_BODY_BYTES`

The default maximum body size.

```typescript
import { MAX_BODY_BYTES } from "@hardlydifficult/http";

console.log(MAX_BODY_BYTES); // 1048576
```

## Response Helpers

### `json`

Short alias for sending a JSON response.

```typescript
function json(
  res: ServerResponse,
  body: unknown,
  options?: { status?: number; corsOrigin?: string }
): void
```

```typescript
import { json } from "@hardlydifficult/http";

json(res, { ok: true });
json(res, { error: "Unauthorized" }, { status: 401 });
json(res, { id: 1 }, { corsOrigin: "https://trusted.com" });
```

### `sendJson`

Identical to `json` if you prefer the longer name.

## Security

### `safeCompare`

Constant-time string comparison for secrets and tokens.
Missing values never match.

```typescript
function safeCompare(
  a: string | null | undefined,
  b: string | null | undefined
): boolean
```

```typescript
import { safeCompare } from "@hardlydifficult/http";

if (safeCompare(request.headers.authorization, process.env.API_TOKEN)) {
  // Grant access
}
```
