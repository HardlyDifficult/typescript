/** Small opinionated polling utility that reads periodically and emits only when the value changes. */
export interface WatchOptions<T> {
  readonly read: () => Promise<T>;
  readonly onChange: (current: T, previous: T | undefined) => void;
  readonly everyMs: number;
  readonly isEqual?: (current: T, previous: T | undefined) => boolean;
  readonly onError?: (error: Error) => void;
}

/** Live watcher handle returned by {@link watch}. */
export interface WatchHandle<T> {
  readonly current: T | undefined;
  stop(): void;
  refresh(): Promise<T | undefined>;
}

class Watcher<T> implements WatchHandle<T> {
  private readonly readFn: () => Promise<T>;
  private readonly onChange: (current: T, previous: T | undefined) => void;
  private readonly everyMs: number;
  private readonly isEqual: (current: T, previous: T | undefined) => boolean;
  private readonly onError?: (error: Error) => void;

  private timer: ReturnType<typeof setInterval> | undefined;
  private currentValue: T | undefined;
  private stopped = false;
  private inFlight: Promise<T | undefined> | undefined;

  constructor(options: WatchOptions<T>) {
    this.readFn = options.read;
    this.onChange = options.onChange;
    this.everyMs = options.everyMs;
    this.isEqual = options.isEqual ?? defaultIsEqual;
    this.onError = options.onError;
  }

  get current(): T | undefined {
    return this.currentValue;
  }

  async start(): Promise<this> {
    await this.refresh();

    if (!this.stopped) {
      this.timer = setInterval(() => {
        void this.refresh();
      }, this.everyMs);
      this.timer.unref();
    }

    return this;
  }

  stop(): void {
    this.stopped = true;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  refresh(): Promise<T | undefined> {
    if (this.stopped) {
      return Promise.resolve(this.currentValue);
    }

    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = this.readCurrentValue().finally(() => {
      this.inFlight = undefined;
    });

    return this.inFlight;
  }

  private async readCurrentValue(): Promise<T | undefined> {
    try {
      const current = await this.readFn();

      if (this.stopped) {
        return this.currentValue;
      }

      if (!this.isEqual(current, this.currentValue)) {
        const previous = this.currentValue;
        this.onChange(current, previous);
        this.currentValue = current;
      }
    } catch (error: unknown) {
      this.handleError(error);
    }

    return this.currentValue;
  }

  private handleError(error: unknown): void {
    const normalizedError = normalizeError(error);

    if (this.onError) {
      this.onError(normalizedError);
      return;
    }

    console.error("watch() read failed:", normalizedError);
  }
}

/** Starts watching immediately and resolves after the first read attempt completes. */
export async function watch<T>(
  options: WatchOptions<T>
): Promise<WatchHandle<T>> {
  return new Watcher(options).start();
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
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
