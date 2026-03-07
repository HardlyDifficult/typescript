# @hardlydifficult/rest-client

Opinionated REST client helpers for APIs that should feel small and obvious at the call site.

## Installation

```bash
npm install @hardlydifficult/rest-client
```

## Preferred API

```typescript
import { createRestClient, operation } from "@hardlydifficult/rest-client";
import { z } from "zod";

interface User {
  id: string;
  name: string;
}

const api = createRestClient(
  {
    baseUrl: "https://api.example.com/v1",
    auth: {
      type: "oauth2",
      tokenUrl: "https://auth.example.com/oauth/token",
      clientId: "client-id",
      clientSecret: "secret",
    },
  },
  {
    getUser: operation.get<User>({
      params: z.object({ id: z.string() }),
      path: ({ id }) => `/users/${id}`,
    }),
    listUsers: operation.get<User[]>({
      path: "/users",
    }),
    createUser: operation.post<User>({
      params: z.object({ name: z.string().min(1) }),
      path: "/users",
      body: ({ name }) => ({ name }),
    }),
  }
);

const user = await api.getUser({ id: "123" });
const users = await api.listUsers();
await api.createUser({ name: "Alice" });
```

What this gives you:

- No subclass ceremony just to bind a few endpoints.
- Relative `path` values resolve against `baseUrl`.
- Zero-input operations are zero-arg functions.
- `body` derives request payloads from validated params.

## Parsing Responses

Use `parse` when the server shape is not the shape you want in client code.

```typescript
const api = createRestClient(
  { baseUrl: "https://api.example.com" },
  {
    searchUserNames: operation.get<
      string[],
      { q: string },
      { items: Array<{ name: string }> }
    >({
      params: z.object({ q: z.string().min(1) }),
      path: ({ q }) => `/users/search?q=${encodeURIComponent(q)}`,
      parse: (response) => response.items.map((user) => user.name),
    }),
  }
);

const names = await api.searchUserNames({ q: "ali" });
```

## Direct Requests

Direct HTTP helpers also accept relative paths.

```typescript
const api = createRestClient({ baseUrl: "https://api.example.com/v1" }, {});

const health = await api.get<{ ok: boolean }>("/health");
await api.post("/users", { name: "Alice" });
```

## Advanced Usage

`RestClient` is still available if you want a class-based wrapper:

```typescript
import { operation, RestClient } from "@hardlydifficult/rest-client";
import { z } from "zod";

const GetUser = operation.get<User>({
  params: z.object({ id: z.string() }),
  path: ({ id }) => `/users/${id}`,
});

class MyApi extends RestClient {
  getUser = this.bind(GetUser);
}
```

## Authentication

Supported auth config types:

- `none`
- `bearer`
- `generator`
- `oauth2`

`createRestClient` and `RestClient` share the same auth, retry, logging, and error behavior.
