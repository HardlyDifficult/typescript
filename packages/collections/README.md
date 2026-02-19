# @hardlydifficult/collections

Array and collection utilities for batched parallel processing.

## Installation

```bash
npm install @hardlydifficult/collections
```

## Usage

```typescript
import { chunk, groupByDepth } from "@hardlydifficult/collections";

// Process items in batches of 5
const items = Array.from({ length: 12 }, (_, i) => i);
for (const batch of chunk(items, 5)) {
  await Promise.allSettled(batch.map(handleItem));
}

// Handle directories bottom-up
const dirs = ["src/services/auth", "src/services", "src", "src/utils"];
for (const { paths } of groupByDepth(dirs)) {
  await Promise.allSettled(paths.map(deployDir));
}
```

## API Reference

### `chunk<T>(arr: readonly T[], size: number): T[][]`

Split an array into subarrays of a specified maximum size. Useful for limiting concurrency when processing items in parallel.

```typescript
import { chunk } from "@hardlydifficult/collections";

const result = chunk([1, 2, 3, 4, 5, 6, 7], 3);
// [[1, 2, 3], [4, 5, 6], [7]]
```

| Parameter | Type | Description |
|---|---|---|
| `arr` | `readonly T[]` | Input array to chunk |
| `size` | `number` | Maximum size of each chunk (must be > 0) |

### `groupByDepth(paths: readonly string[]): { depth: number; paths: string[] }[]`

Group path strings by their slash-delimited depth (number of segments), sorted deepest-first. Perfect for bottom-up directory operations.

```typescript
import { groupByDepth } from "@hardlydifficult/collections";

const result = groupByDepth(["a/b/c", "a/b", "a", "x/y"]);
// [
//   { depth: 3, paths: ["a/b/c"] },
//   { depth: 2, paths: ["a/b", "x/y"] },
//   { depth: 1, paths: ["a"] }
// ]
```

| Parameter | Type | Description |
|---|---|---|
| `paths` | `readonly string[]` | Array of path strings to group |

**Return value:** Array of objects with `depth` (number of `/`-separated segments) and `paths` (all paths at that depth), sorted by depth descending.