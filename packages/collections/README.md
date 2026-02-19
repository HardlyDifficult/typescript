# @hardlydifficult/collections

Array and collection utilities for batched parallel processing.

## Installation

```bash
npm install @hardlydifficult/collections
```

## Quick Start

Split an array into chunks for parallel batch processing:

```typescript
import { chunk } from "@hardlydifficult/collections";

const items = [1, 2, 3, 4, 5, 6, 7];
const batches = chunk(items, 3);
// [[1, 2, 3], [4, 5, 6], [7]]

for (const batch of batches) {
  await Promise.allSettled(batch.map(processItem));
}
```

## Chunking Arrays

### `chunk<T>(arr: readonly T[], size: number): T[][]`

Split an array into chunks of a given size. The final chunk may be smaller than the specified size. Useful for processing items in parallel batches with a concurrency limit.

```typescript
import { chunk } from "@hardlydifficult/collections";

const items = [1, 2, 3, 4, 5, 6, 7];
const batches = chunk(items, 3);
// [[1, 2, 3], [4, 5, 6], [7]]

// Process in parallel batches
for (const batch of batches) {
  await Promise.allSettled(batch.map(processItem));
}
```

## Grouping by Depth

### `groupByDepth(paths: readonly string[]): { depth: number; paths: string[] }[]`

Group `/`-separated path strings by their depth, sorted deepest-first. Useful for bottom-up directory processing where children must be handled before parents.

```typescript
import { groupByDepth } from "@hardlydifficult/collections";

const dirs = ["src/services/summarize", "src/services", "src", "src/utils"];
const grouped = groupByDepth(dirs);
// [
//   { depth: 3, paths: ["src/services/summarize"] },
//   { depth: 2, paths: ["src/services", "src/utils"] },
//   { depth: 1, paths: ["src"] },
// ]

// Process directories bottom-up, parallelizing within each depth level
for (const { paths: dirsAtDepth } of grouped) {
  await Promise.allSettled(dirsAtDepth.map(summarizeDir));
}
```

Depth is calculated by counting `/`-separated segments. An empty string is treated as depth 0 (root).

```typescript
groupByDepth(["a/b/c", "a/b", "a", ""]);
// [
//   { depth: 3, paths: ["a/b/c"] },
//   { depth: 2, paths: ["a/b"] },
//   { depth: 1, paths: ["a"] },
//   { depth: 0, paths: [""] },
// ]
```