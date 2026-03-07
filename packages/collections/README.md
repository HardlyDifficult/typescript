# @hardlydifficult/collections

Opinionated collection helpers for the patterns we actually use: batching work and walking paths bottom-up.

## Installation

```bash
npm install @hardlydifficult/collections
```

## Quick Start

```typescript
import { inBatches, bottomUp } from "@hardlydifficult/collections";

for (const batch of inBatches([1, 2, 3, 4, 5, 6, 7], 3)) {
  console.log(batch);
}
// [1, 2, 3]
// [4, 5, 6]
// [7]

for (const dirsAtDepth of bottomUp([
  "src/components/Button",
  "src/components",
  "src",
])) {
  console.log(dirsAtDepth);
}
// ["src/components/Button"]
// ["src/components"]
// ["src"]
```

## Work Batching

### `inBatches`

Split a readonly array into sequential batches.

```typescript
function inBatches<T>(items: readonly T[], size: number): T[][]
```

Use this when the caller is processing work, not thinking in terms of array chunking.

```typescript
import { inBatches } from "@hardlydifficult/collections";

for (const batch of inBatches(files, 5)) {
  await Promise.all(batch.map(processFile));
}
```

## Bottom-Up Path Processing

### `bottomUp`

Group paths deepest-first for bottom-up processing.

```typescript
function bottomUp(paths: readonly string[]): string[][]
```

Depth is computed from normalized slash-separated segments, so repeated or trailing slashes do not change grouping depth.

```typescript
import { bottomUp } from "@hardlydifficult/collections";

for (const dirsAtDepth of bottomUp(["a/b/c", "a/b", "a", "x/y"])) {
  console.log(dirsAtDepth);
}
// ["a/b/c"]
// ["a/b", "x/y"]
// ["a"]
```

## Compatibility Exports

The lower-level names are still available when they read better in a given call site:

- `chunk(items, size)` is the same behavior as `inBatches(items, size)`.
- `groupByDepth(paths)` returns `{ depth, paths }[]` when you need the numeric depth.
