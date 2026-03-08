import type { WatchThrottle } from "./types.js";

/**
 * Run a task directly or through the provided throttle when available.
 */
export async function runWithThrottle<T>(
  throttle: WatchThrottle | undefined,
  task: () => Promise<T> | T,
  weight = 1
): Promise<T> {
  if (throttle === undefined) {
    return task();
  }

  return throttle.run(task, weight);
}
