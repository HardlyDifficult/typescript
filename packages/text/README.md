# @hardlydifficult/text

Text utilities for error formatting, template replacement, and chunking.

## Installation

```bash
npm install @hardlydifficult/text
```

## API

### `getErrorMessage(err: unknown): string`

Extract a message string from an unknown error. Returns `err.message` for `Error` instances, `String(err)` otherwise.

```typescript
import { getErrorMessage } from "@hardlydifficult/text";

try {
  await riskyOperation();
} catch (err) {
  console.error(getErrorMessage(err));
}
```

### `formatError(err: unknown, context?: string): string`

Format an error for user-facing output. Prepends an optional context prefix.

```typescript
import { formatError } from "@hardlydifficult/text";

formatError(new Error("not found"), "User lookup"); // "User lookup: not found"
formatError(new Error("not found")); // "not found"
```

### `formatErrorForLog(err: unknown): string`

Format an error for logging. Returns the message for `Error` instances, `String(err)` otherwise.

### `replaceTemplate(template: string, values: Record<string, string>): string`

Replace `{{variable}}` placeholders with provided values. Unmatched placeholders are left as-is.

```typescript
import { replaceTemplate } from "@hardlydifficult/text";

replaceTemplate("Hello {{name}}, welcome to {{place}}!", {
  name: "Alice",
  place: "Wonderland",
});
// "Hello Alice, welcome to Wonderland!"
```

### `extractPlaceholders(template: string): string[]`

Extract all unique placeholder names from a template.

```typescript
import { extractPlaceholders } from "@hardlydifficult/text";

extractPlaceholders("{{name}} is in {{place}}"); // ["name", "place"]
```

### `chunkText(text: string, maxLength: number): string[]`

Split text into chunks of at most `maxLength` characters. Prefers breaking on newlines, then spaces, and falls back to hard breaks.

```typescript
import { chunkText } from "@hardlydifficult/text";

const chunks = chunkText(longMessage, 2000);
for (const chunk of chunks) {
  await channel.send(chunk);
}
```

### `slugify(input: string, maxLength?: number): string`

Convert a string to a URL/filename-safe slug. Lowercases, replaces non-alphanumeric runs with hyphens, truncates at word boundaries.

```typescript
import { slugify } from "@hardlydifficult/text";

slugify("My Feature Name!"); // "my-feature-name"
slugify("My Feature Name!", 10); // "my-feature"
```

### `formatDuration(ms: number): string`

Format milliseconds as a short human-readable duration. Shows at most two units, skipping trailing zeros.

```typescript
import { formatDuration } from "@hardlydifficult/text";

formatDuration(125_000);   // "2m 5s"
formatDuration(3_600_000); // "1h"
formatDuration(500);       // "<1s"
formatDuration(90_000_000); // "1d 1h"
```
