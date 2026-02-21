# @hardlydifficult/collections

A TypeScript utility library for array chunking and path depth grouping.

## Installation

```bash
npm install @hardlydifficult/collections
```

## Quick Start

```typescript
import { chunk, groupByDepth } from "@hardlydifficult/collections";

// Split an array into chunks of fixed size
const numbers = [1, 2, 3, 4, 5, 6, 7];
console.log(chunk(numbers, 3));
// Output: [[1, 2, 3], [4, 5, 6], [7]]

// Group file paths by directory depth (deepest-first)
const paths = ["src/components", "src", "src/components/Button"];
console.log(groupByDepth(paths));
// Output: [
//   { depth: 2, paths: ["src/components", "src/components/Button"] },
//   { depth: 1, paths: ["src"] }
// ]
```

## Array Chunking

Splits arrays into subarrays of a specified maximum size.

### `chunk`

Splits a readonly array into chunks of the given size.

**Signature:**
```typescript
function chunk<T>(arr: readonly T[], size: number): T[][]
```

| Parameter | Type              | Description                   |
|-----------|-------------------|-------------------------------|
| `arr`     | `readonly T[]`    | The array to split            |
| `size`    | `number`          | Maximum size of each chunk    |

**Example:**
```typescript
import { chunk } from "@hardlydifficult/collections";

const items = ["a", "b", "c", "d", "e"];
console.log(chunk(items, 2));
// Output: [["a", "b"], ["c", "d"], ["e"]]

console.log(chunk([1, 2, 3], 5));
// Output: [[1, 2, 3]]
```

## Path Depth Grouping

Groups file paths by their slash-separated depth, sorted deepest-first.

### `groupByDepth`

Groups path strings by the number of `/`-separated segments, returning results in descending depth order.

**Signature:**
```typescript
function groupByDepth(paths: readonly string[]): { depth: number; paths: string[] }[]
```

| Parameter | Type               | Description                          |
|-----------|--------------------|--------------------------------------|
| `paths`   | `readonly string[]`| Array of path strings to group       |

Returns an array of objects with:
- `depth`: number of slash-separated segments (empty string has depth 0)
- `paths`: array of paths at that depth, in original order

**Example:**
```typescript
import { groupByDepth } from "@hardlydifficult/collections";

const paths = ["a/b/c", "a/b", "a", "", "x/y"];
console.log(groupByDepth(paths));
// Output: [
//   { depth: 3, paths: ["a/b/c"] },
//   { depth: 2, paths: ["a/b", "x/y"] },
//   { depth: 1, paths: ["a"] },
//   { depth: 0, paths: [""] }
// ]
```