/**
 * Shared utilities for graceful shutdown and continuous loop execution.
 *
 * This module provides interruptible sleep and continuous loop functionality with proper signal handling for
 * SIGINT/SIGTERM.
 */

/** Delay directive returned by runCycle/getNextDelayMs. */
export type ContinuousLoopDelay = number | "immediate";

/** Context provided to each cycle and delay resolver. */
export interface ContinuousLoopCycleContext {
  /** 1-based cycle number for the current loop iteration */
  cycleNumber: number;
  /** Function to check if shutdown has been requested */
  isShutdownRequested: () => boolean;
}

/** Context provided to cycle error handling callbacks. */
export type ContinuousLoopErrorContext = ContinuousLoopCycleContext;

/** Action returned by onCycleError to control loop behavior. */
export type ContinuousLoopErrorAction = "continue" | "stop";

type ContinuousLoopErrorDecision = ContinuousLoopErrorAction | undefined;

/** Callback used to process cycle errors and decide loop policy. */
export type ContinuousLoopErrorHandler = (
  error: unknown,
  context: ContinuousLoopErrorContext
) =>
  | ContinuousLoopErrorDecision
  | Promise<ContinuousLoopErrorDecision>;

/** Optional control directives that can be returned from runCycle. */
export interface ContinuousLoopCycleControl {
  /** Stop the loop after this cycle completes. */
  stop?: boolean;
  /** Override delay before the next cycle. */
  nextDelayMs?: ContinuousLoopDelay;
}

/** Minimal logger interface compatible with @hardlydifficult/logger. */
export interface ContinuousLoopLogger {
  warn(message: string, context?: Readonly<Record<string, unknown>>): void;
  error(message: string, context?: Readonly<Record<string, unknown>>): void;
}

/** Supported return shape from runCycle. */
export type ContinuousLoopRunCycleResult<TResult = unknown> =
  | TResult
  | ContinuousLoopDelay
  | ContinuousLoopCycleControl;

/** Options for running a continuous loop */
export interface ContinuousLoopOptions<TResult = unknown> {
  /** Interval between cycles in seconds */
  intervalSeconds: number;
  /**
   * Callback to run on each cycle.
   *
   * @param isShutdownRequested - Function to check if shutdown has been requested during the cycle
   * @returns Promise resolving to cycle result and optional control directives
   */
  runCycle: (
    isShutdownRequested: () => boolean
  ) => Promise<ContinuousLoopRunCycleResult<TResult>>;
  /**
   * Optional hook to derive the next delay from a runCycle result.
   * Used only when runCycle does not directly return a delay directive.
   */
  getNextDelayMs?: (
    result: ContinuousLoopRunCycleResult<TResult>,
    context: ContinuousLoopCycleContext
  ) => ContinuousLoopDelay | undefined;
  /**
   * Optional error callback for cycle failures.
   *
   * Return "stop" to end the loop, otherwise it will continue.
   */
  onCycleError?: ContinuousLoopErrorHandler;
  /** Optional callback for cleanup on shutdown */
  onShutdown?: () => void | Promise<void>;
  /** Optional logger (defaults to console warn/error) */
  logger?: ContinuousLoopLogger;
}

const defaultLogger: ContinuousLoopLogger = {
  warn(message, context) {
    if (context === undefined) {
      console.warn(message);
      return;
    }
    console.warn(message, context);
  },
  error(message, context) {
    if (context === undefined) {
      console.error(message);
      return;
    }
    console.error(message, context);
  },
};

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

function normalizeDelayMs(
  delayMs: ContinuousLoopDelay,
  source: "intervalSeconds" | "runCycle" | "getNextDelayMs"
): ContinuousLoopDelay {
  if (delayMs === "immediate") {
    return delayMs;
  }
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    if (source === "intervalSeconds") {
      throw new Error(
        "intervalSeconds must be a non-negative finite number"
      );
    }
    throw new Error(
      `${source} must return a non-negative finite number or "immediate"`
    );
  }
  return delayMs;
}

function getControlFromCycleResult(
  result: ContinuousLoopRunCycleResult<unknown>
): ContinuousLoopCycleControl {
  if (typeof result === "number" || result === "immediate") {
    return { nextDelayMs: result };
  }
  if (typeof result !== "object" || result === null) {
    return {};
  }

  const value = result as Record<string, unknown>;
  const nextDelayMs = value.nextDelayMs;
  return {
    stop: value.stop === true,
    nextDelayMs:
      typeof nextDelayMs === "number" || nextDelayMs === "immediate"
        ? nextDelayMs
        : undefined,
  };
}

async function handleCycleError(
  error: unknown,
  context: ContinuousLoopErrorContext,
  onCycleError: ContinuousLoopErrorHandler | undefined,
  logger: ContinuousLoopLogger
): Promise<ContinuousLoopErrorAction> {
  if (onCycleError !== undefined) {
    try {
      const action = await onCycleError(error, context);
      return action === "stop" ? "stop" : "continue";
    } catch (handlerError) {
      logger.error("onCycleError handler failed", {
        cycleNumber: context.cycleNumber,
        cycleError:
          error instanceof Error
            ? error.message
            : String(error),
        handlerError:
          handlerError instanceof Error
            ? handlerError.message
            : String(handlerError),
      });
      return "continue";
    }
  }

  logger.error("Cycle error", {
    cycleNumber: context.cycleNumber,
    error: error instanceof Error ? error.message : String(error),
  });
  return "continue";
}

/**
 * Run a function in a continuous loop with graceful shutdown support.
 *
 * Features:
 *
 * - Interruptible sleep that responds immediately to SIGINT/SIGTERM
 * - Proper signal handler cleanup to prevent listener accumulation
 * - Per-cycle delay control via return value or getNextDelayMs
 * - Graceful stop signaling from runCycle ({ stop: true })
 * - Configurable error policy via onCycleError
 * - Passes shutdown check callback to runCycle for in-cycle interruption
 *
 * @param options - Configuration for the continuous loop
 */
export async function runContinuousLoop<TResult = unknown>(
  options: ContinuousLoopOptions<TResult>
): Promise<void> {
  const {
    intervalSeconds,
    runCycle,
    getNextDelayMs,
    onCycleError,
    onShutdown,
    logger = defaultLogger,
  } = options;

  const defaultDelayMs = normalizeDelayMs(
    intervalSeconds * 1000,
    "intervalSeconds"
  );

  let shutdownRequested = false;
  let cancelCurrentSleep: (() => void) | null = null;
  let cycleNumber = 0;

  const handleShutdown = (signal: string): void => {
    logger.warn(`Received ${signal}, shutting down gracefully...`);
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
      cycleNumber += 1;
      const cycleContext: ContinuousLoopCycleContext = {
        cycleNumber,
        isShutdownRequested,
      };
      let nextDelayMs: ContinuousLoopDelay = defaultDelayMs;

      try {
        const cycleResult = await runCycle(isShutdownRequested);
        if (!shouldContinue()) {
          continue;
        }

        const cycleControl = getControlFromCycleResult(cycleResult);
        if (cycleControl.stop === true) {
          shutdownRequested = true;
          continue;
        }

        if (cycleControl.nextDelayMs !== undefined) {
          nextDelayMs = normalizeDelayMs(cycleControl.nextDelayMs, "runCycle");
        } else if (getNextDelayMs !== undefined) {
          const derivedDelay = getNextDelayMs(cycleResult, cycleContext);
          if (derivedDelay !== undefined) {
            nextDelayMs = normalizeDelayMs(derivedDelay, "getNextDelayMs");
          }
        }
      } catch (error) {
        const action = await handleCycleError(
          error,
          cycleContext,
          onCycleError,
          logger
        );
        if (action === "stop") {
          shutdownRequested = true;
          continue;
        }
      }

      if (!shouldContinue()) {
        break;
      }

      if (nextDelayMs === "immediate") {
        continue;
      }

      const sleep = createInterruptibleSleep(nextDelayMs);
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
