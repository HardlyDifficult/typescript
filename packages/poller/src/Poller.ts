/** Generic polling utility that periodically fetches data and invokes a callback when the result changes. */
export interface PollerOptions<T> {
  fetch: () => Promise<T>;
  onChange: (current: T, previous: T | undefined) => void;
  intervalMs: number;
  onError?: (error: unknown) => void;
  debounceMs?: number;
  comparator?: (current: T, previous: T | undefined) => boolean;
}

/**
 *
 */
export class Poller<T> {
  private readonly fetchFn: () => Promise<T>;
  private readonly onChange: (current: T, previous: T | undefined) => void;
  private readonly intervalMs: number;
  private readonly onError?: (error: unknown) => void;
  private readonly debounceMs: number;
  private readonly comparator: (current: T, previous: T | undefined) => boolean;

  private timer: ReturnType<typeof setInterval> | undefined;
  private previous: T | undefined;
  private running = false;
  private fetching = false;
  private triggerTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(options: PollerOptions<T>);
  /** @deprecated Use `Poller.create(options)` or `new Poller({ ...options })` instead. */
  constructor(
    fetchFn: () => Promise<T>,
    onChange: (current: T, previous: T | undefined) => void,
    intervalMs: number,
    onError?: (error: unknown) => void
  );
  constructor(
    optionsOrFetch: PollerOptions<T> | (() => Promise<T>),
    onChange?: (current: T, previous: T | undefined) => void,
    intervalMs?: number,
    onError?: (error: unknown) => void
  ) {
    const options = Poller.resolveOptions(
      optionsOrFetch,
      onChange,
      intervalMs,
      onError
    );

    this.fetchFn = options.fetch;
    this.onChange = options.onChange;
    this.intervalMs = options.intervalMs;
    this.onError = options.onError;
    this.debounceMs = options.debounceMs ?? 1_000;
    this.comparator = options.comparator ?? defaultIsEqual;
  }

  static create<T>(options: PollerOptions<T>): Poller<T> {
    return new Poller(options);
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
    this.timer.unref();
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

  trigger(debounceMs = this.debounceMs): void {
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
    this.triggerTimeout.unref();
  }

  private async poll(): Promise<void> {
    if (this.fetching) {
      return;
    }
    this.fetching = true;

    try {
      const current = await this.fetchFn();
      if (!this.comparator(current, this.previous)) {
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

  private static resolveOptions<T>(
    optionsOrFetch: PollerOptions<T> | (() => Promise<T>),
    onChange?: (current: T, previous: T | undefined) => void,
    intervalMs?: number,
    onError?: (error: unknown) => void
  ): PollerOptions<T> {
    if (typeof optionsOrFetch !== "function") {
      return optionsOrFetch;
    }

    if (!onChange || intervalMs === undefined) {
      throw new Error(
        "Poller positional constructor requires fetch, onChange, and intervalMs."
      );
    }

    return {
      fetch: optionsOrFetch,
      onChange,
      intervalMs,
      onError,
    };
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

function isPrimitive(
  value: unknown
): value is null | undefined | string | number | boolean | symbol | bigint {
  return (
    value === null || (typeof value !== "object" && typeof value !== "function")
  );
}

function isPlainObjectOrArray(value: unknown): value is object {
  if (Array.isArray(value)) {
    return true;
  }

  if (value === null || typeof value !== "object") {
    return false;
  }

  const prototype: object | null = Object.getPrototypeOf(value) as
    | object
    | null;
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

  const aEntries = Object.entries(a as Record<string, unknown>);
  const bEntries = Object.entries(b as Record<string, unknown>);

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
