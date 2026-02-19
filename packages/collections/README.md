# @hardlydifficult/collections

Array and path-manipulation utilities for batched parallel processing.

## Installation

```bash
npm install @hardlydifficult/collections
```

## Quick Start

Process items in parallel batches using chunking:

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

Split an array into subarrays of a specified maximum size. The final chunk may be smaller than the specified size. Useful for limiting concurrency in batched operations.

```typescript
import { chunk } from "@hardlydifficult/collections";

const items = [1, 2, 3, 4, 5, 6, 7];
const batches = chunk(items, 3);
// [[1, 2, 3], [4, 5, 6], [7]]

for (const batch of batches) {
  await Promise.allSettled(batch.map(processItem));
}
```

#### Examples

- **Full-sized chunks only**: `chunk([1,2,3,4,5,6], 2)` → `[[1,2], [3,4], [5,6]]`
- **Final smaller chunk**: `chunk([1,2,3,4,5], 3)` → `[[1,2,3], [4,5]]`
- **Single oversized chunk**: `chunk([1,2,3], 5)` → `[[1,2,3]]`
- **Empty input**: `chunk([], 3)` → `[]`

## Grouping by Depth

### `groupByDepth(paths: readonly string[]): { depth: number; paths: string[] }[]`

Group `/`-separated path strings by their directory depth (number of `/`-separated segments), sorted deepest-first. Useful for bottom-up directory processing where child directories must be handled before parents.

```typescript
import { groupByDepth } from "@hardlydifficult/collections";

const dirs = ["src/services/summarize", "src/services", "src", "src/utils"];
const grouped = groupByDepth(dirs);
// [
//   { depth: 3, paths: ["src/services/summarize"] },
//   { depth: 2, paths: ["src/services", "src/utils"] },
//   { depth: 1, paths: ["src"] },
// ]

for (const { paths: dirsAtDepth } of grouped) {
  await Promise.allSettled(dirsAtDepth.map(summarizeDir));
}
```

#### Depth Rules

- An empty string (`""`) is treated as depth `0` (root)
- Each `/` increases depth by 1
- Paths are grouped by depth, and groups are sorted deepest-first

#### Examples

- **Mixed depths**:
  ```typescript
  groupByDepth(["a/b/c", "a/b", "a", ""]);
  // [
  //   { depth: 3, paths: ["a/b/c"] },
  //   { depth: 2, paths: ["a/b"] },
  //   { depth: 1, paths: ["a"] },
  //   { depth: 0, paths: [""] },
  // ]
  ```

- **Same depth grouping**:
  ```typescript
  groupByDepth(["x/y", "a/b", "m/n"]);
  // [{ depth: 2, paths: ["x/y", "a/b", "m/n"] }]
  ```

- **Empty input**: `groupByDepth([])` → `[]`