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
    this.comparator =
      options.comparator ??
      ((current, previous) =>
        JSON.stringify(current) === JSON.stringify(previous));
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
