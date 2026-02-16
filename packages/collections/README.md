# @hardlydifficult/collections

Array and collection utilities for batched parallel processing.

## Installation

```bash
npm install @hardlydifficult/collections
```

## API

### `chunk<T>(arr: readonly T[], size: number): T[][]`

Split an array into chunks of a given size. Useful for processing items in parallel batches with a concurrency limit.

```typescript
import { chunk } from "@hardlydifficult/collections";

const items = [1, 2, 3, 4, 5, 6, 7];
const batches = chunk(items, 3);
// [[1, 2, 3], [4, 5, 6], [7]]

for (const batch of batches) {
  await Promise.allSettled(batch.map(processItem));
}
```

### `groupByDepth(paths: readonly string[]): { depth: number; paths: string[] }[]`

Group `/`-separated path strings by their depth, sorted deepest-first. Useful for bottom-up directory processing where children must be handled before parents.

```typescript
import { groupByDepth } from "@hardlydifficult/collections";

const dirs = ["src/services/summarize", "src/services", "src", "src/utils"];
groupByDepth(dirs);
// [
//   { depth: 3, paths: ["src/services/summarize"] },
//   { depth: 2, paths: ["src/services", "src/utils"] },
//   { depth: 1, paths: ["src"] },
// ]

// Process directories bottom-up, parallelizing within each depth level
for (const { paths: dirsAtDepth } of groupByDepth(dirs)) {
  await Promise.allSettled(dirsAtDepth.map(summarizeDir));
}
```
