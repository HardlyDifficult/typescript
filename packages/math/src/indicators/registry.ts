/**
 * Indicator registry - central lookup for all available indicators.
 */

import type { Indicator } from "./types.js";

const indicatorRegistry = new Map<string, Indicator>();

export function registerIndicator(indicator: Indicator): void {
  indicatorRegistry.set(indicator.type, indicator);
}

export function getIndicator(type: string): Indicator {
  const indicator = indicatorRegistry.get(type);
  if (!indicator) {
    throw new Error(`Unknown indicator type: ${type}. Available: ${[...indicatorRegistry.keys()].join(", ")}`);
  }
  return indicator;
}

export function getAvailableIndicators(): string[] {
  return [...indicatorRegistry.keys()];
}
