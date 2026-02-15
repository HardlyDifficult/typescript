/**
 * Idempotent resource teardown with signal trapping
 *
 * Register cleanup functions once at resource creation time.
 * All exit paths call a single `run()` — no duplication, no missed resources.
 */
export interface Teardown {
  /** Register a teardown function. Returns an unregister function. */
  add(fn: () => void | Promise<void>): () => void;
  /** Run all teardown functions in LIFO order. Idempotent: second call is a no-op. */
  run(): Promise<void>;
  /** Wire SIGTERM/SIGINT to run() then process.exit(0). Returns an untrap function. */
  trapSignals(): () => void;
}

interface Entry {
  fn: () => void | Promise<void>;
  removed: boolean;
}

/**
 * Create a teardown registry
 *
 * @example
 * ```typescript
 * const teardown = createTeardown();
 * teardown.add(() => server.stop());
 * teardown.add(() => db.close());
 * teardown.trapSignals();
 *
 * // Any manual exit path:
 * await teardown.run();
 * ```
 */
export function createTeardown(): Teardown {
  const entries: Entry[] = [];
  let hasRun = false;

  const run = async (): Promise<void> => {
    if (hasRun) {
      return;
    }
    hasRun = true;

    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.removed) {
        continue;
      }
      try {
        await entry.fn();
      } catch {
        // Swallow errors per-fn so remaining teardowns still run
      }
    }
  };

  return {
    add(fn: () => void | Promise<void>): () => void {
      if (hasRun) {
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        return () => {};
      }

      const entry: Entry = { fn, removed: false };
      entries.push(entry);

      return () => {
        entry.removed = true;
      };
    },

    run,

    trapSignals(): () => void {
      const onSignal = (): void => {
        void run().then(() => process.exit(0));
      };

      process.on("SIGTERM", onSignal);
      process.on("SIGINT", onSignal);

      return () => {
        process.off("SIGTERM", onSignal);
        process.off("SIGINT", onSignal);
      };
    },
  };
}
