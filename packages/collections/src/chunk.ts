import { inBatches } from "./inBatches.js";

/**
 * Split an array into chunks of a given size.
 */
export function chunk<T>(items: readonly T[], size: number): T[][] {
  return inBatches(items, size);
}
