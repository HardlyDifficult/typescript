# @hardlydifficult/social

Provider-agnostic social read client with an X implementation in this version.

## Current scope (read-first)

This package is intentionally read-only for now:

- Read timeline content
- Read liked content
- Watch for newly liked posts

Write operations (posting, liking, reposting) are intentionally not included yet.

## Install

```bash
npm install @hardlydifficult/social
```

## Usage

```typescript
import { createSocial } from "@hardlydifficult/social";

const social = createSocial(); // defaults to "x"

const timeline = await social.timeline({ maxResults: 10 });
const liked = await social.likedPosts({ maxResults: 10 });

const watcher = social.watchLikes({
  pollIntervalMs: 30_000,
  onLike: ({ post }) => {
    console.log(`New like: ${post.url}`);
  },
});

watcher.start();
```

## X configuration

Set environment variables, or pass explicit config through `createSocialClient`.

- `X_BEARER_TOKEN` (required)

```typescript
import { createSocialClient } from "@hardlydifficult/social";

const social = createSocialClient({
  type: "x",
  bearerToken: process.env.X_BEARER_TOKEN,
});
```
