# @hardlydifficult/social

Opinionated social read client for X.

This package is intentionally narrow:

- One provider: X
- One factory: `createSocial()`
- Terse methods: `post()`, `timeline()`, `likes()`
- Like watching that starts immediately

## Installation

```bash
npm install @hardlydifficult/social
```

## Quick Start

```ts
import { createSocial } from "@hardlydifficult/social";

const social = createSocial({
  bearerToken: process.env.X_BEARER_TOKEN,
});

const posts = await social.timeline(10);
const liked = await social.likes(10);
const post = await social.post("1234567890");
```

If you omit `bearerToken`, the client reads `X_BEARER_TOKEN` from the environment.

## API

### `createSocial(options?)`

Creates the default client. X is the only supported provider today, so the options are X-specific without extra nesting.

```ts
const social = createSocial({
  bearerToken: process.env.X_BEARER_TOKEN,
  limit: 25,
});
```

Options:

- `bearerToken?: string`
- `limit?: number`

`maxResults` is still accepted as a compatibility alias for `limit`.

### `social.post(id)`

Fetch a single post.

```ts
const post = await social.post("123");
```

### `social.timeline(limitOrOptions?)`

Fetch the authenticated user timeline.

```ts
const recent = await social.timeline();
const firstTen = await social.timeline(10);
const custom = await social.timeline({ limit: 5 });
```

### `social.likes(limitOrOptions?)`

Fetch posts liked by the authenticated user.

```ts
const liked = await social.likes();
const latestLiked = await social.likes(20);
```

### `social.watchLikes(onLike, options?)`

Starts polling immediately and returns a watcher you can stop later.

```ts
const watcher = social.watchLikes(
  ({ post, seenAt }) => {
    console.log(`[${seenAt}] ${post.url}`);
  },
  { everyMs: 30_000 }
);

// later
watcher.stop();
```

Options:

- `everyMs?: number`
- `onError?: (error: Error) => void`

You can also use the object form if you prefer:

```ts
const watcher = social.watchLikes({
  everyMs: 30_000,
  onLike: ({ post }) => {
    console.log(post.text);
  },
});
```

## Watcher

`watchLikes()` returns a `SocialLikeWatcher`.

Methods:

- `start()` starts polling and returns the watcher
- `stop()` stops polling
- `poll()` runs one polling cycle manually

The first poll seeds known likes and does not emit notifications for existing liked posts.

## Types

Core types exported by the package:

- `SocialOptions`
- `SocialListOptions`
- `SocialPost`
- `SocialAuthor`
- `SocialPostMetrics`
- `LikeNotification`
- `WatchLikesOptions`

## Compatibility Aliases

These still exist, but they are no longer the preferred style:

- `createSocialClient()` delegates to `createSocial()`
- `client.getPost()` delegates to `client.post()`
- `client.likedPosts()` delegates to `client.likes()`
- `pollIntervalMs` is accepted as an alias for `everyMs`

## Scope

This package is read-only for now:

- Read timeline content
- Read liked posts
- Watch for newly liked posts

Posting, liking, and reposting are intentionally out of scope.
