# @hardlydifficult/social

Opinionated social read client for X.

This package is intentionally narrow:

- One factory: `createSocial()`
- One authenticated account: `me`
- Small resource tree: `posts.get()`, `me.timeline()`, `me.likes()`
- Like watching as an async stream

## Installation

```bash
npm install @hardlydifficult/social
```

## Quick Start

```ts
import { createSocial } from "@hardlydifficult/social";

const social = createSocial({
  token: process.env.X_BEARER_TOKEN,
});

const timeline = await social.me.timeline({ limit: 10 });
const liked = await social.me.likes();
const post = await social.posts.get("1234567890");
```

If you omit `token`, the client reads `X_BEARER_TOKEN` from the environment.
`bearerToken` is accepted as a compatibility alias.

## API

### `createSocial(options?)`

Creates the social client.

```ts
const social = createSocial({
  token: process.env.X_BEARER_TOKEN,
  defaultLimit: 25,
});
```

Options:

- `token?: string`
- `bearerToken?: string`
- `defaultLimit?: number`
- `limit?: number`
- `maxResults?: number`
- `type?: "x"`

`bearerToken`, `limit`, and `maxResults` are accepted as compatibility aliases.
`type` is optional because X is the only supported provider.

### `social.posts.get(id)`

Fetch a single post.

```ts
const post = await social.posts.get("123");
```

### `social.me.timeline(options?)`

Fetch the authenticated user timeline.

```ts
const recent = await social.me.timeline();
const firstTen = await social.me.timeline({ limit: 10 });
```

### `social.me.likes(options?)`

Fetch posts liked by the authenticated user.

```ts
const liked = await social.me.likes();
const latestLiked = await social.me.likes({ limit: 20 });
```

### `social.me.watchLikes(options?)`

Returns an async stream of newly liked posts. The first poll seeds the current
likes and emits nothing, so iteration only yields likes discovered after the
stream starts.

```ts
const controller = new AbortController();

for await (const like of social.me.watchLikes({
  everyMs: 30_000,
  signal: controller.signal,
})) {
  console.log(`[${like.seenAt}] ${like.post.url}`);
}
```

Options:

- `everyMs?: number`
- `pollIntervalMs?: number`
- `signal?: AbortSignal`

`pollIntervalMs` is accepted as a compatibility alias for `everyMs`.

## Types

Core types exported by the package:

- `CreateSocialOptions`
- `Provider`
- `XConfig`
- `SocialOptions`
- `SocialConfig`
- `Social`
- `SocialListOptions`
- `SocialPost`
- `SocialAuthor`
- `SocialPostMetrics`
- `LikeNotification`
- `WatchLikesOptions`
- `LikeWatcherOptions`

## Scope

This package is read-only for now:

- Read timeline content
- Read liked posts
- Watch for newly liked posts

Posting, liking, and reposting are intentionally out of scope.
