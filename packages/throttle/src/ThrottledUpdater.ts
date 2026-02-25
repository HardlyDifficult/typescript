/**
 * Throttled message updater
 *
 * Batches rapid updates to avoid rate limits while ensuring
 * the final state is always sent.
 */
export interface ThrottledUpdater {
  /** Queue an update with the latest text */
  update(text: string): void;
  /** Flush any pending update immediately */
  flush(): Promise<void>;
  /** Stop the updater and clear any pending timeouts */
  stop(): void;
}

/**
 * Create a throttled message updater
 *
 * Limits how frequently the update function is called while ensuring
 * the most recent content is always eventually sent.
 *
 * @param updateFn - Async function to call with updated text
 * @param intervalMs - Minimum interval between updates
 * @returns ThrottledUpdater instance
 *
 * @example
 * ```typescript
 * const updater = createThrottledUpdater(
 *   (text) => message.edit(text),
 *   2000
 * );
 *
 * // These rapid updates will be batched
 * updater.update('Step 1...');
 * updater.update('Step 2...');
 * updater.update('Step 3...');
 *
 * // Ensure final state is sent
 * await updater.flush();
 * updater.stop();
 * ```
 */
export function createThrottledUpdater(
  updateFn: (text: string) => Promise<void>,
  intervalMs: number
): ThrottledUpdater {
  let lastUpdateTime = 0;
  let pendingText: string | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const doUpdate = async (text: string): Promise<void> => {
    if (stopped) {
      return;
    }
    lastUpdateTime = Date.now();
    pendingText = null;
    try {
      await updateFn(text);
    } catch {
      // Errors are handled by the caller's updateFn
    }
  };

  const scheduleUpdate = (): void => {
    if (timeoutId || stopped || pendingText === null) {
      return;
    }

    const elapsed = Date.now() - lastUpdateTime;
    const delay = Math.max(0, intervalMs - elapsed);

    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (pendingText !== null && !stopped) {
        void doUpdate(pendingText);
      }
    }, delay);
    (timeoutId as NodeJS.Timeout).unref?.();
  };

  return {
    update(text: string): void {
      if (stopped) {
        return;
      }

      const now = Date.now();
      if (now - lastUpdateTime >= intervalMs) {
        // Enough time has passed, update immediately
        void doUpdate(text);
      } else {
        // Store for later and schedule if needed
        pendingText = text;
        scheduleUpdate();
      }
    },

    async flush(): Promise<void> {
      if (stopped) {
        return;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (pendingText !== null) {
        await doUpdate(pendingText);
      }
    },

    stop(): void {
      stopped = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      pendingText = null;
    },
  };
}

