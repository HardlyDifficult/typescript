# @hardlydifficult/collections

A TypeScript utility library providing array chunking and path depth grouping utilities for batched parallel processing.

## Installation

```bash
npm install @hardlydifficult/collections
```

## Quick Start

```typescript
import { chunk, groupByDepth } from "@hardlydifficult/collections";

// Split an array into fixed-size chunks
const result = chunk([1, 2, 3, 4, 5], 2);
// → [[1, 2], [3, 4], [5]]

// Group filesystem paths by directory depth (deepest-first)
const paths = ["src/a/b", "src", "src/c"];
const grouped = groupByDepth(paths);
// → [{ depth: 2, paths: ["src/a/b"] }, { depth: 1, paths: ["src", "src/c"] }]
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

## Array Chunking (`chunk`)

Splits an array into sub-arrays of a specified maximum size, preserving order.

```typescript
import { chunk } from "@hardlydifficult/collections";

const numbers = [1, 2, 3, 4, 5, 6, 7];
console.log(chunk(numbers, 3));
// → [[1, 2, 3], [4, 5, 6], [7]]
```

| Parameter | Type | Description |
|---------|------|-------------|
| `arr` | `readonly T[]` | Input array to split (supports readonly arrays) |
| `size` | `number` | Maximum chunk size (must be ≥1) |

Returns `T[][]`: An array of chunks, where the last chunk may be smaller if the input length is not evenly divisible by `size`.

**Examples:**
- **Full-sized chunks only**: `chunk([1,2,3,4,5,6], 2)` → `[[1,2], [3,4], [5,6]]`
- **Final smaller chunk**: `chunk([1,2,3,4,5], 3)` → `[[1,2,3], [4,5]]`
- **Single oversized chunk**: `chunk([1,2,3], 5)` → `[[1,2,3]]`
- **Empty input**: `chunk([], 3)` → `[]`

## Path Depth Grouping (`groupByDepth`)

Groups filesystem paths by slash-delimited depth, sorted deepest-first to support bottom-up directory processing.

```typescript
import { groupByDepth } from "@hardlydifficult/collections";

const paths = ["src/a/b", "src", "src/c", ""];
const result = groupByDepth(paths);
// → [
//      { depth: 3, paths: ["src/a/b"] },
//      { depth: 2, paths: ["src", "src/c"] },
//      { depth: 0, paths: [""] }
//    ]
```

| Parameter | Type | Description |
|---------|------|-------------|
| `paths` | `readonly string[]` | Array of path strings (slashes `/` delimit depth) |

Returns `{ depth: number; paths: string[] }[]`: An array of depth groups sorted in descending order by depth. Empty string `""` is treated as depth `0` (root). Order of paths within each group is preserved from the input.

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