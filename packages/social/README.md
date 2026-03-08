# @hardlydifficult/social

Opinionated social read client for X.

This package is intentionally narrow:

- One factory: `createSocial()`
- One authenticated account
- Flat verbs: `post()`, `timeline()`, `likes()`, `watchLikes()`
- Like watching as an async stream

## Installation

```bash
npm install @hardlydifficult/social
```

## Quick Start

```ts
import { createSocial } from "@hardlydifficult/social";

const social = createSocial(process.env.X_BEARER_TOKEN);

const timeline = await social.timeline(10);
const liked = await social.likes();
const post = await social.post("1234567890");
```

If you omit the token, the client reads `X_BEARER_TOKEN` from the environment.

## API

### `createSocial(options?)`

Creates the social client.

```ts
const social = createSocial({
  token: process.env.X_BEARER_TOKEN,
  limit: 25,
});
```

You can also pass the token directly:

```ts
const social = createSocial(process.env.X_BEARER_TOKEN);
```

Options:

- `token?: string`
- `limit?: number`

### `social.post(id)`

Fetch a single post.

```ts
const post = await social.post("123");
```

### `social.timeline(limit?)`

Fetch the authenticated user timeline.

```ts
const recent = await social.timeline();
const firstTen = await social.timeline(10);
```

### `social.likes(limit?)`

Fetch posts liked by the authenticated user.

```ts
const liked = await social.likes();
const latestLiked = await social.likes(20);
```

### `social.watchLikes(options?)`

Returns an async stream of newly liked posts. The first poll seeds the current
likes and emits nothing, so iteration only yields likes discovered after the
stream starts.

```ts
const controller = new AbortController();

for await (const like of social.watchLikes({
  everyMs: 30_000,
  signal: controller.signal,
})) {
  console.log(`[${like.seenAt}] ${like.post.url}`);
}
```

You can also pass the interval directly:

```ts
for await (const like of social.watchLikes(30_000)) {
  console.log(like.post.url);
}
```

Options:

- `everyMs?: number`
- `signal?: AbortSignal`

## Types

Core types exported by the package:

- `CreateSocialInput`
- `CreateSocialOptions`
- `Social`
- `SocialPost`
- `SocialAuthor`
- `SocialPostMetrics`
- `LikeNotification`
- `WatchLikesInput`
- `WatchLikesOptions`

## Scope

This package is read-only for now:

- Read timeline content
- Read liked posts
- Watch for newly liked posts

Posting, liking, and reposting are intentionally out of scope.
