/**
 * Indicator registry - central lookup for all available indicators.
 */

import type { Indicator } from "./types.js";

const indicatorRegistry = new Map<string, Indicator>();

/** Register an indicator implementation in the global registry. */
export function registerIndicator(indicator: Indicator): void {
  indicatorRegistry.set(indicator.type, indicator);
}

/** Look up an indicator by type name. Throws if not found. */
export function getIndicator(type: string): Indicator {
  const indicator = indicatorRegistry.get(type);
  if (!indicator) {
    throw new Error(`Unknown indicator type: ${type}. Available: ${[...indicatorRegistry.keys()].join(", ")}`);
  }
  return indicator;
}

/** Return the list of all registered indicator type names. */
export function getAvailableIndicators(): string[] {
  return [...indicatorRegistry.keys()];
}
