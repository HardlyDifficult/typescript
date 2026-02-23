/** Generic polling utility that periodically fetches data and invokes a callback when the result changes. */
export type PollerOptions<T> = {
  onError?: (error: unknown) => void;
  isEqual?: (a: T, b: T | undefined) => boolean;
};

export class Poller<T> {
  private readonly fetchFn: () => Promise<T>;
  private readonly onChange: (current: T, previous: T | undefined) => void;
  private readonly intervalMs: number;
  private readonly onError?: (error: unknown) => void;
  private readonly isEqual: (a: T, b: T | undefined) => boolean;

  private timer: ReturnType<typeof setInterval> | undefined;
  private previous: T | undefined;
  private running = false;
  private fetching = false;
  private triggerTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(
    fetchFn: () => Promise<T>,
    onChange: (current: T, previous: T | undefined) => void,
    intervalMs: number,
    onErrorOrOptions?: ((error: unknown) => void) | PollerOptions<T>
  ) {
    this.fetchFn = fetchFn;
    this.onChange = onChange;
    this.intervalMs = intervalMs;

    const options =
      typeof onErrorOrOptions === "function"
        ? { onError: onErrorOrOptions }
        : onErrorOrOptions;

    this.onError = options?.onError;
    this.isEqual = options?.isEqual ?? defaultIsEqual;
  }

  async start(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    await this.poll();
    this.timer = setInterval(() => {
      void this.poll();
    }, this.intervalMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    if (this.triggerTimeout) {
      clearTimeout(this.triggerTimeout);
      this.triggerTimeout = undefined;
    }
  }

  trigger(debounceMs = 1000): void {
    if (!this.running) {
      return;
    }
    if (this.triggerTimeout) {
      clearTimeout(this.triggerTimeout);
    }
    this.triggerTimeout = setTimeout(() => {
      this.triggerTimeout = undefined;
      void this.poll();
    }, debounceMs);
  }

  private async poll(): Promise<void> {
    if (this.fetching) {
      return;
    }
    this.fetching = true;

    try {
      const current = await this.fetchFn();

      if (!this.isEqual(current, this.previous)) {
        this.onChange(current, this.previous);
        this.previous = current;
      }
    } catch (error: unknown) {
      if (this.onError) {
        this.onError(error);
      }
    } finally {
      this.fetching = false;
    }
  }
}

function defaultIsEqual<T>(a: T, b: T | undefined): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (isPrimitive(a) || isPrimitive(b) || b === undefined) {
    return false;
  }

  if (isPlainObjectOrArray(a) && isPlainObjectOrArray(b)) {
    return deepEqual(a, b);
  }

  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function isPrimitive(value: unknown): value is null | undefined | string | number | boolean | symbol | bigint {
  return value === null || (typeof value !== "object" && typeof value !== "function");
}

function isPlainObjectOrArray(value: unknown): value is object {
  if (Array.isArray(value)) {
    return true;
  }

  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }

    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (!isPlainObjectOrArray(a) || !isPlainObjectOrArray(b)) {
    return false;
  }

  const aEntries = Object.entries(a);
  const bEntries = Object.entries(b);

  if (aEntries.length !== bEntries.length) {
    return false;
  }

  return aEntries.every(([key, value]) => {
    if (!(key in b)) {
      return false;
    }

    return deepEqual(value, (b as Record<string, unknown>)[key]);
  });
}
