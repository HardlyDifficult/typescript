# @hardlydifficult/collections

A TypeScript utility library providing array chunking and path depth grouping functions.

## Installation

```bash
npm install @hardlydifficult/collections
```

## Quick Start

```typescript
import { chunk, groupByDepth } from "@hardlydifficult/collections";

// Split an array into chunks
const items = [1, 2, 3, 4, 5];
console.log(chunk(items, 2)); 
// → [[1, 2], [3, 4], [5]]

// Group filesystem paths by directory depth
const paths = ["src/app", "src", "src/utils/helper"];
console.log(groupByDepth(paths));
// → [{ depth: 3, paths: ["src/app"] }, { depth: 2, paths: ["src"] }, { depth: 1, paths: ["src/utils/helper"] }]
```

## Chunk Arrays

Split an array into fixed-size subarrays.

### `chunk`

Splits an array into chunks of a specified maximum size. The last chunk may be smaller than the requested size.

```typescript
import { chunk } from "@hardlydifficult/collections";

const result = chunk([1, 2, 3, 4, 5, 6, 7], 3);
// → [[1, 2, 3], [4, 5, 6], [7]]
```

**Signature**

| Parameter | Type              | Description              |
|-----------|-------------------|--------------------------|
| `arr`     | `readonly T[]`    | Input array to chunk     |
| `size`    | `number`          | Maximum chunk size       |
| **Returns** | `T[][]`         | Array of subarrays       |

## Group Paths by Depth

Organize filesystem paths by slash-delimited depth, sorted deepest-first for bottom-up directory processing.

### `groupByDepth`

Groups an array of path strings by the number of `/`-separated segments. Paths with deeper nesting appear first in the result, enabling bottom-up processing.

```typescript
import { groupByDepth } from "@hardlydifficult/collections";

const paths = ["src/app/index.ts", "src/app", "src", "README.md"];
const result = groupByDepth(paths);
// → [
//   { depth: 3, paths: ["src/app/index.ts"] },
//   { depth: 2, paths: ["src/app"] },
//   { depth: 1, paths: ["src", "README.md"] }
// ]
```

**Signature**

| Parameter | Type               | Description                        |
|-----------|--------------------|------------------------------------|
| `paths`   | `readonly string[]`| Array of path strings              |
| **Returns** | `{ depth: number; paths: string[] }[]` | Groups sorted deepest-first |

**Notes**

- Empty string paths (`""`) are assigned depth `0`.
- Paths are grouped in descending order of depth (deepest first).
- Order of paths within each depth group matches their appearance in the input array.