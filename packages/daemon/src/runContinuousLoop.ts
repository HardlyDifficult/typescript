/**
 * Shared utilities for graceful shutdown and continuous loop execution.
 *
 * This module provides interruptible sleep and continuous loop functionality with proper signal handling for
 * SIGINT/SIGTERM.
 */

/** Options for running a continuous loop */
export interface ContinuousLoopOptions {
  /** Interval between cycles in seconds */
  intervalSeconds: number;
  /**
   * Callback to run on each cycle.
   *
   * @param isShutdownRequested - Function to check if shutdown has been requested during the cycle
   * @returns Promise that resolves when the cycle is complete (return value is ignored)
   */
  runCycle: (isShutdownRequested: () => boolean) => Promise<unknown>;
  /** Optional callback for cleanup on shutdown */
  onShutdown?: () => Promise<void>;
}

/**
 * Creates an interruptible sleep that can be woken early by calling the returned cancel function.
 *
 * @returns An object with a promise that resolves after durationMs or when cancel() is called
 */
function createInterruptibleSleep(durationMs: number): {
  promise: Promise<void>;
  cancel: () => void;
} {
  let resolve: (() => void) | null = null;
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const promise = new Promise<void>((r) => {
    resolve = r;
    timeout = setTimeout(() => {
      timeout = null;
      resolve = null;
      r();
    }, durationMs);
  });

  const cancel = (): void => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (resolve !== null) {
      resolve();
      resolve = null;
    }
  };

  return { promise, cancel };
}

/**
 * Run a function in a continuous loop with graceful shutdown support.
 *
 * Features:
 *
 * - Interruptible sleep that responds immediately to SIGINT/SIGTERM
 * - Proper signal handler cleanup to prevent listener accumulation
 * - Continues to next cycle even if current cycle fails
 * - Passes shutdown check callback to runCycle for in-cycle interruption
 *
 * @param options - Configuration for the continuous loop
 */
export async function runContinuousLoop(
  options: ContinuousLoopOptions,
): Promise<void> {
  const { intervalSeconds, runCycle, onShutdown } = options;

  let shutdownRequested = false;
  let cancelCurrentSleep: (() => void) | null = null;

  const handleShutdown = (signal: string): void => {
    console.warn(`Received ${signal}, shutting down gracefully...`);
    shutdownRequested = true;
    if (cancelCurrentSleep !== null) {
      cancelCurrentSleep();
      cancelCurrentSleep = null;
    }
  };

  const sigintHandler = (): void => {
    handleShutdown("SIGINT");
  };
  const sigtermHandler = (): void => {
    handleShutdown("SIGTERM");
  };

  process.on("SIGINT", sigintHandler);
  process.on("SIGTERM", sigtermHandler);

  const isShutdownRequested = (): boolean => shutdownRequested;

  const shouldContinue = (): boolean => !shutdownRequested;

  try {
    while (shouldContinue()) {
      try {
        await runCycle(isShutdownRequested);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Cycle error: ${errorMessage}`);
      }

      if (!shouldContinue()) {
        break;
      }

      const sleep = createInterruptibleSleep(intervalSeconds * 1000);
      cancelCurrentSleep = sleep.cancel;
      await sleep.promise;
      cancelCurrentSleep = null;
    }
  } finally {
    process.off("SIGINT", sigintHandler);
    process.off("SIGTERM", sigtermHandler);
    if (onShutdown !== undefined) {
      await onShutdown();
    }
  }
}
