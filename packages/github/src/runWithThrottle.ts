import type { WatchThrottle } from "./types.js";

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
