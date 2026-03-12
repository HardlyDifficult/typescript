function serializeError(
  error: Error,
  seen: WeakSet<object>
): Record<string, unknown> | string {
  if (seen.has(error)) {
    return "[Circular]";
  }

  seen.add(error);
  try {
    const result: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };

    if (typeof error.stack === "string" && error.stack.length > 0) {
      result.stack = error.stack;
    }

    if ("cause" in error && error.cause !== undefined) {
      const cause = serializeValue(error.cause, seen);
      if (cause !== undefined) {
        result.cause = cause;
      }
    }

    for (const [key, value] of Object.entries(error)) {
      const serialized = serializeValue(value, seen);
      if (serialized !== undefined) {
        result[key] = serialized;
      }
    }

    return result;
  } finally {
    seen.delete(error);
  }
}

function serializeRecord(
  value: Record<string, unknown>,
  seen: WeakSet<object>
): Record<string, unknown> | string {
  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);
  try {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      const serialized = serializeValue(item, seen);
      if (serialized !== undefined) {
        result[key] = serialized;
      }
    }

    return result;
  } finally {
    seen.delete(value);
  }
}

function serializeArray(
  value: readonly unknown[],
  seen: WeakSet<object>
): unknown[] | string {
  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);
  try {
    return value.map((item) => serializeValue(item, seen) ?? null);
  } finally {
    seen.delete(value);
  }
}

function serializeMap(
  value: ReadonlyMap<unknown, unknown>,
  seen: WeakSet<object>
): [unknown, unknown][] | string {
  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);
  try {
    return Array.from(value.entries(), ([key, item]) => [
      serializeValue(key, seen) ?? null,
      serializeValue(item, seen) ?? null,
    ]);
  } finally {
    seen.delete(value);
  }
}

function serializeSet(
  value: ReadonlySet<unknown>,
  seen: WeakSet<object>
): unknown[] | string {
  if (seen.has(value)) {
    return "[Circular]";
  }

  seen.add(value);
  try {
    return Array.from(
      value.values(),
      (item) => serializeValue(item, seen) ?? null
    );
  } finally {
    seen.delete(value);
  }
}

function serializeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null) {
    return null;
  }

  switch (typeof value) {
    case "bigint":
      return value.toString();
    case "boolean":
    case "number":
    case "string":
      return value;
    case "function":
      return `[Function${value.name ? ` ${value.name}` : ""}]`;
    case "symbol":
      return value.toString();
    case "undefined":
      return undefined;
    case "object":
      break;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  }

  if (value instanceof Error) {
    return serializeError(value, seen);
  }

  if (Array.isArray(value)) {
    return serializeArray(value, seen);
  }

  if (value instanceof Map) {
    return serializeMap(value, seen);
  }

  if (value instanceof Set) {
    return serializeSet(value, seen);
  }

  return serializeRecord(value as Record<string, unknown>, seen);
}

/**
 * Normalize context objects into JSON-safe values.
 */
export function normalizeContext(
  context: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  const normalized = serializeRecord(
    context as Record<string, unknown>,
    new WeakSet()
  );

  return typeof normalized === "string" ? { value: normalized } : normalized;
}

/**
 * Safely stringify unknown values while preserving non-JSON primitives.
 */
export function safeJsonStringify(value: unknown, space?: number): string {
  const serialized = serializeValue(value, new WeakSet());
  if (serialized === undefined) {
    return "null";
  }
  return JSON.stringify(serialized, null, space);
}
