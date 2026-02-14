/** Generic polling utility that periodically fetches data and invokes a callback when the result changes. */
export class Poller<T> {
  private readonly fetchFn: () => Promise<T>;
  private readonly onChange: (current: T, previous: T | undefined) => void;
  private readonly intervalMs: number;
  private readonly onError?: (error: unknown) => void;

  private timer: ReturnType<typeof setInterval> | undefined;
  private previous: T | undefined;
  private running = false;
  private fetching = false;
  private triggerTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor(
    fetchFn: () => Promise<T>,
    onChange: (current: T, previous: T | undefined) => void,
    intervalMs: number,
    onError?: (error: unknown) => void
  ) {
    this.fetchFn = fetchFn;
    this.onChange = onChange;
    this.intervalMs = intervalMs;
    this.onError = onError;
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
      const currentJson = JSON.stringify(current);
      const previousJson = JSON.stringify(this.previous);

      if (currentJson !== previousJson) {
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
