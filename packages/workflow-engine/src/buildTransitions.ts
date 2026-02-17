/**
 * Pure functions for computing Pipeline transition maps from step definitions.
 */

import type { StepDefinition } from "./pipelineTypes.js";
import type { TransitionMap } from "./types.js";

/**
 * Compute the status string for a step at the given index.
 * Returns "completed" if the index is past the end.
 */
export function statusForStep<T>(
  steps: readonly StepDefinition<T>[],
  index: number
): string {
  if (index >= steps.length) {
    return "completed";
  }
  const step = steps[index];
  return step.gate === true ? `gate:${step.name}` : `running:${step.name}`;
}

/** Build a TransitionMap from step definitions. */
export function buildTransitions<T>(
  steps: readonly StepDefinition<T>[]
): TransitionMap<string> {
  const map: Record<string, readonly string[]> = {};

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const isGate = step.gate === true;
    const nextStatus = statusForStep(steps, i + 1);

    if (isGate) {
      map[`gate:${step.name}`] = [nextStatus, "failed", "cancelled"];
    } else {
      map[`running:${step.name}`] = [nextStatus, "failed", "cancelled"];
    }
  }

  // Terminal states
  map.completed = [];
  map.failed = [];
  map.cancelled = [];

  return map as TransitionMap<string>;
}
