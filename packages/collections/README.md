# @hardlydifficult/collections

Array chunking and path depth grouping utilities for batched parallel processing.

## Installation

```bash
npm install @hardlydifficult/collections
```

## Quick Start

```typescript
import { chunk, groupByDepth } from "@hardlydifficult/collections";

// Split an array into fixed-size chunks
const items = [1, 2, 3, 4, 5];
const chunks = chunk(items, 2);
// => [[1, 2], [3, 4], [5]]

// Group filesystem paths by directory depth (deepest first)
const paths = ["src/app", "src", "src/utils/helper"];
const grouped = groupByDepth(paths);
// => [
//      { depth: 3, paths: ["src/app"] },
//      { depth: 1, paths: ["src"] }
//    ]
```

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

## Array Utilities

### chunk

Splits an array into sub-arrays of a specified maximum size.

```typescript
chunk<T>(arr: readonly T[], size: number): T[][]
```

| Parameter | Type              | Description                         |
|-----------|-------------------|-------------------------------------|
| `arr`     | `readonly T[]`    | The array to split                  |
| `size`    | `number`          | Maximum size of each sub-array      |

The final chunk may be smaller than the specified size. Useful for limiting concurrency in batched operations.

**Examples:**
- **Full-sized chunks only**: `chunk([1,2,3,4,5,6], 2)` → `[[1,2], [3,4], [5,6]]`
- **Final smaller chunk**: `chunk([1,2,3,4,5], 3)` → `[[1,2,3], [4,5]]`
- **Single oversized chunk**: `chunk([1,2,3], 5)` → `[[1,2,3]]`
- **Empty input**: `chunk([], 3)` → `[]`

```typescript
import { chunk } from "@hardlydifficult/collections";

const result = chunk([1, 2, 3, 4, 5, 6, 7], 3);
// => [[1, 2, 3], [4, 5, 6], [7]]
```

## Path Utilities

### groupByDepth

Groups path strings by their slash-separated depth, sorted deepest-first for bottom-up directory processing.

```typescript
groupByDepth(paths: readonly string[]): { depth: number; paths: string[] }[]
```

| Parameter | Type              | Description                        |
|-----------|-------------------|------------------------------------|
| `paths`   | `readonly string[]` | Filesystem paths to group         |

The depth is determined by counting slash-separated segments (e.g., `"a/b/c"` has depth `3`). Empty string `""` is treated as depth `0`.

**Rules:**
- An empty string (`""`) is treated as depth `0` (root)
- Each `/` increases depth by 1
- Paths are grouped by depth, and groups are sorted deepest-first

**Examples:**

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