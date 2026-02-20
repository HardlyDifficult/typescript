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
  let sleepResolve: (() => void) | null = null;
  let sleepTimeout: ReturnType<typeof setTimeout> | null = null;

  const handleShutdown = (signal: string): void => {
    console.warn(`Received ${signal}, shutting down gracefully...`);
    shutdownRequested = true;
    if (sleepTimeout !== null) {
      clearTimeout(sleepTimeout);
      sleepTimeout = null;
    }
    if (sleepResolve !== null) {
      sleepResolve();
      sleepResolve = null;
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

  try {
    while (!shutdownRequested) {
      try {
        await runCycle(isShutdownRequested);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error(`Cycle error: ${errorMessage}`);
      }

      if (shutdownRequested) {
        break;
      }

      await interruptibleSleep(intervalSeconds * 1000, () => {
        return new Promise<void>((resolve) => {
          sleepResolve = resolve;
          sleepTimeout = setTimeout(() => {
            sleepTimeout = null;
            sleepResolve = null;
            resolve();
          }, intervalSeconds * 1000);
        });
      });
    }
  } finally {
    process.off("SIGINT", sigintHandler);
    process.off("SIGTERM", sigtermHandler);
    if (onShutdown !== undefined) {
      await onShutdown();
    }
  }
}

async function interruptibleSleep(
  _durationMs: number,
  createSleepPromise: () => Promise<void>,
): Promise<void> {
  await createSleepPromise();
}
