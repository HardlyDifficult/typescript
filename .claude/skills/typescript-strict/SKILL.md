---
name: typescript-strict
description: Strict typing and readability guidelines for TypeScript code. Use when writing or reviewing TypeScript, handling type errors, or when strict typing is mentioned.
---

# TypeScript: Strict Typing and Readability

## Core Principles

1. **Avoid `any` and `unknown`** — Use precise, explicit types
2. **Never silence type errors** — Don't use `as any` to make it compile
3. **Optimize for maintainability** — Prefer clear code over clever types
4. **Fail fast** — Validate inputs immediately, don't use placeholders

## Preferred Patterns

- **Type guards** over type assertions: `function isMyType(v: unknown): v is MyType`
- **Typed generics** over untyped arrays: `function transform<T>(items: HasValue<T>[]): T[]`
- **`instanceof` checks** in catch blocks: `if (error instanceof Error)`
- **Explicit return types** on public functions

## Type Safety

### Bad: Using `any` or `unknown`

```typescript
function processData(data: any) {
  return data.someProperty;
}

const result = apiCall() as any;
```

### Good: Explicit types

```typescript
interface DataStructure {
  someProperty: string;
  otherProperty: number;
}

function processData(data: DataStructure): string {
  return data.someProperty;
}

interface ApiResponse {
  status: number;
  data: DataStructure;
}

const result: ApiResponse = await apiCall();
```

## When You Think You Need `any`/`unknown`

Investigate and fix the root cause:

| Problem | Solution |
|---------|----------|
| Upstream types missing/incorrect | Add or fix them |
| Invalid usage or design | Correct the code |
| Third-party types wrong | Augment types or contribute a fix |

**Last resort only**: Use `any`/`unknown` when avoiding them requires disproportionate effort. Keep usage minimal and documented.

## Type Assertions

### Bad: Broad assertions

```typescript
const value = (someFunction() as any).property;
const data = response as unknown as MyType;
```

### Good: Type guards and validation

```typescript
function isMyType(value: unknown): value is MyType {
  return (
    typeof value === 'object' &&
    value !== null &&
    'expectedProperty' in value
  );
}

const data = someFunction();
if (isMyType(data)) {
  console.log(data.expectedProperty);
} else {
  throw new Error('Invalid data structure');
}
```

## Generic Types

### Bad: Untyped generics

```typescript
function transform(items: any[]) {
  return items.map(item => item.value);
}
```

### Good: Typed generics

```typescript
interface HasValue<T> {
  value: T;
}

function transform<T>(items: HasValue<T>[]): T[] {
  return items.map(item => item.value);
}
```

## Error Handling

### Bad: Catching without typing

```typescript
try {
  await someOperation();
} catch (error) {
  console.log(error.message); // error is any
}
```

### Good: Typed error handling

```typescript
try {
  await someOperation();
} catch (error) {
  if (error instanceof Error) {
    console.log(error.message);
  } else {
    console.log('Unknown error occurred');
  }
}
```

## When Blocked

If the root cause of a type issue can't be fixed:
1. Stop and document why
2. Ask for guidance rather than using `as any`

## Verification

After TypeScript changes:

1. Run `tsc --noEmit` to check for type errors
2. Fix all type errors before considering work complete
3. Ensure all type assertions are justified and minimal
