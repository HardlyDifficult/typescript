# @hardlydifficult/agent-tools

A utility package providing configuration-driven limits, path parsing for GitHub-style file references, and error-handling helpers for safe, predictable agent tool execution.

## Installation

```bash
npm install @hardlydifficult/agent-tools
```

## Quick Start

```typescript
import {
  parsePath,
  MAX_READ_BYTES,
  executeWithErrorHandling,
  toArray,
} from "@hardlydifficult/agent-tools";

// Parse a GitHub-style path with line range
const result = parsePath("src/index.ts#L10-L20");
// { filePath: "src/index.ts", startLine: 10, endLine: 20 }

// Normalize inputs to arrays
const items = toArray("single"); // ["single"]
const itemsArray = toArray(["a", "b"]); // ["a", "b"]

// Safely handle async operations with error messages
const safeRead = await executeWithErrorHandling(
  () => Promise.resolve("data"),
  "read_file failed"
);
// "data"
```

## Path Parsing

Parses GitHub-style file paths with optional line ranges into structured objects.

### `parsePath(path: string): ParsedPath`

Parses paths like `file.ts`, `file.ts#L10`, or `file.ts#L10-L20`.

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `path` | `string` | GitHub-style file path with optional `#L...` line range |

**Returns:**

| Name | Type | Description |
|------|------|-------------|
| `filePath` | `string` | The path to the file |
| `startLine?` | `number` | Starting line (1-indexed) |
| `endLine?` | `number` | Ending line (inclusive) |

```typescript
import { parsePath } from "@hardlydifficult/agent-tools";

parsePath("src/index.ts"); // { filePath: "src/index.ts" }
parsePath("src/index.ts#L5"); // { filePath: "src/index.ts", startLine: 5, endLine: 5 }
parsePath("src/index.ts#L5-L15"); // { filePath: "src/index.ts", startLine: 5, endLine: 15 }
```

## Configuration Constants

Configuration values used to enforce safe limits in agent tool operations.

| Constant | Type | Default | Description |
|----------|------|---------|-------------|
| `MAX_READ_BYTES` | `number` | `100_000` | Max bytes to return from read operations before truncation |
| `MAX_GREP_FILE_SIZE` | `number` | `102_400` | Max file size (bytes) to scan during content search |
| `MAX_SEARCH_RESULTS` | `number` | `100` | Max total matches returned by search operations |
| `MAX_CONTEXT_LINES` | `number` | `3` | Lines of context to show around each edit in write output |
| `VERIFY_TIMEOUT` | `number` | `120_000` | Timeout (ms) for verify tool commands |

```typescript
import {
  MAX_READ_BYTES,
  MAX_GREP_FILE_SIZE,
} from "@hardlydifficult/agent-tools";

// Max readable file size
console.log(MAX_READ_BYTES); // 100000

// Skip scanning files larger than this
console.log(MAX_GREP_FILE_SIZE); // 102400
```

## Utility Helpers

Support functions for input normalization, error handling, and result formatting.

### `toArray<T>(input: T | T[]): T[]`

Normalizes a value (single item or array) into an array.

```typescript
import { toArray } from "@hardlydifficult/agent-tools";

toArray("single"); // ["single"]
toArray(["a", "b"]); // ["a", "b"]
```

### `executeWithErrorHandling<T>(operation: () => Promise<T>, errorPrefix: string): Promise<T \| string>`

Wraps async operations in try-catch and returns either the result or an error string.

```typescript
import { executeWithErrorHandling } from "@hardlydifficult/agent-tools";

const result = await executeWithErrorHandling(
  () => Promise.resolve("success"),
  "Operation failed"
);
// "success"

const errorResult = await executeWithErrorHandling(
  () => Promise.reject(new Error("Boom")),
  "Operation failed"
);
// "Operation failed: Boom"
```

### `formatArrayResult(items: string[], emptyMessage: string): string`

Formats array results: joins items with newlines or returns a custom message if empty.

```typescript
import { formatArrayResult } from "@hardlydifficult/agent-tools";

formatArrayResult(["a", "b"], "No items"); // "a\nb"
formatArrayResult([], "No items"); // "No items"
```