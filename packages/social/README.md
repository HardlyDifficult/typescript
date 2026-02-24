# @hardlydifficult/social

Provider-agnostic social read client with an X implementation in this version.

## Current scope (read-first)

This package is intentionally read-only for now:

- Read timeline content
- Read liked content
- Watch for newly liked posts

Write operations (posting, liking, reposting) are intentionally not included yet.

## Installation

```bash
npm install @hardlydifficult/social
```

## Quick Start

```typescript
import { createXClient } from '@hardlydifficult/social';

const client = createXClient({
  bearerToken: process.env.X_BEARER_TOKEN!,
});

const timeline = await client.getTimeline();
console.log(`Retrieved ${timeline.length} posts`);
```

## Core Client

### Social Client

The `SocialClient` wraps a `SocialProviderClient` implementation to provide a platform-agnostic interface for social operations.

```typescript
import { createXClient } from '@hardlydifficult/social';

const client = createXClient({ bearerToken: 'your-token' });

// Get timeline posts
const posts = await client.getTimeline();

// Get posts where the user was liked (via polling-like interface)
const likedPosts = await client.getLikedPosts();
```

### Social Provider Interface

All provider implementations must implement `SocialProviderClient`, which requires:

- `getTimeline()`: Fetch recent posts
- `getLikedPosts()`: Fetch posts the authenticated user has liked
- `getPost(postId: string)`: Fetch a specific post

```typescript
import type { SocialProviderClient } from '@hardlydifficult/social';

// Example interface contract
interface MyProvider implements SocialProviderClient {
  getTimeline(): Promise<SocialPost[]>;
  getLikedPosts(): Promise<SocialPost[]>;
  getPost(id: string): Promise<SocialPost | undefined>;
}
```

## Types

### SocialPost

Standardized post type used across platforms:

```typescript
import type { SocialPost } from '@hardlydifficult/social';

interface SocialPost {
  id: string;
  text: string;
  createdAt: Date;
  author: {
    username: string;
    displayName?: string;
    avatarUrl?: string;
  };
  media?: { url: string; type: 'image' | 'video' }[];
}
```

## X (Twitter) Client

The `XSocialClient` implements the provider interface against the X/Twitter API.

### Constructor Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `bearerToken` | `string` | ✅ | Twitter API bearer token |
| `userId` | `string` | ❌ | User ID; falls back to `/2/users/me` if not provided |

### Example Usage

```typescript
import { createXClient } from '@hardlydifficult/social';

const client = createXClient({
  bearerToken: process.env.X_BEARER_TOKEN!,
});

// Fetch timeline
const posts = await client.getTimeline();

// Fetch liked posts for this user
const likedPosts = await client.getLikedPosts();
```

## Like Watching

`SocialLikeWatcher` polls the provider for new liked posts and emits events when new ones are detected.

### Constructor Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `client` | `SocialProviderClient` | ✅ | — | Provider client instance |
| `pollIntervalMs` | `number` | ❌ | `60_000` | Polling interval in milliseconds |
| `initialLikeIds` | `string[]` | ❌ | `[]` | Pre-known liked post IDs (for resume) |

### Event Emitter API

```typescript
import { createXClient, SocialLikeWatcher } from '@hardlydifficult/social';

const client = createXClient({ bearerToken: process.env.X_BEARER_TOKEN! });
const watcher = new SocialLikeWatcher(client, { pollIntervalMs: 30_000 });

watcher.on('newLike', (post) => {
  console.log(`New like detected: ${post.text}`);
});

watcher.on('error', (err) => {
  console.error('Watcher error:', err);
});

watcher.start();
// Wait for likes...
// watcher.stop();
```

## Factory Functions

The package exports convenience factory functions to construct platform-specific clients:

| Function | Returns | Description |
|---------|---------|-------------|
| `createXClient(options)` | `SocialClient` | Constructs X/Twitter client with default implementation |
| `createMastodonClient(options)` | `never` | Currently throws "not implemented" error |

```typescript
import { createXClient } from '@hardlydifficult/social';

// X client
const xClient = createXClient({ bearerToken: '...' });
```

## Usage with High-Level API

For a more opinionated interface, use `createSocial`:

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

### X configuration

Set environment variables, or pass explicit config through `createSocialClient`.

- `X_BEARER_TOKEN` (required)
- Get a bearer token from the X Developer Portal: https://developer.x.com/en/docs/authentication/oauth-2-0/bearer-tokens

```typescript
import { createSocialClient } from "@hardlydifficult/social";

const social = createSocialClient({
  type: "x",
  bearerToken: process.env.X_BEARER_TOKEN,
});
```

## Testing

Unit tests cover:

- Factory initialization
- Timeline retrieval via provider-agnostic interface
- Like watcher polling and stateful detection

Run tests with:

```bash
npm test
```

## Appendix

### Platform Support

| Feature | X (Twitter) | Mastodon |
|---------|-------------|----------|
| Timeline | ✅ | ❌ (stub) |
| Liked Posts | ✅ | ❌ (stub) |
| Like Watching | ✅ | ❌ (stub) |

Mastodon support is currently unimplemented and will throw errors on usage.