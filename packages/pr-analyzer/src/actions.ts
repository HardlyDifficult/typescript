/**
 * PR Action Resolution
 *
 * Determines which actions are available for a PR based on its status.
 * This is the single source of truth for core action definitions — clients
 * (web, Discord, voice) render from these descriptors.
 *
 * Consumers can provide extra actions via ActionDefinition[].
 */

import type { ActionDefinition, ScannedPR } from "./types.js";

/**
 * Core action types built into the package.
 * Consumers can define additional action types via ActionDefinition.
 */
export type CorePRActionType = "merge" | "mark_ready" | "enable_auto_merge";

/**
 * Describes an available action for a PR.
 * `type` is `string` to allow custom action types from consumers.
 */
export interface PRActionDescriptor {
  readonly type: string;
  readonly label: string;
  readonly description: string;
}

/**
 * Core action registry — maps each core action type to its metadata.
 */
export const PR_ACTIONS: Record<
  CorePRActionType,
  Omit<PRActionDescriptor, "type">
> = {
  merge: { label: "Merge", description: "Squash and merge this PR" },
  mark_ready: {
    label: "Mark Ready",
    description: "Mark this draft PR as ready for review",
  },
  enable_auto_merge: {
    label: "Enable Auto-Merge",
    description: "Enable GitHub auto-merge when checks pass",
  },
};

/**
 * Determine which actions are available for a given PR.
 *
 * @param pr - The scanned PR object
 * @param extraActions - Additional actions provided by consumers
 * @param context - Key-value context for evaluating extra action conditions
 * @returns Array of available action descriptors
 */
export function getAvailableActions(
  pr: ScannedPR,
  extraActions?: readonly ActionDefinition[],
  context?: Record<string, boolean>
): PRActionDescriptor[] {
  const actions: PRActionDescriptor[] = [];
  const { status } = pr;

  // Core actions based on status
  switch (status) {
    case "ready_to_merge":
    case "approved":
      actions.push({ type: "merge", ...PR_ACTIONS.merge });
      break;
    case "draft":
      if (pr.ciStatus.allPassed && !pr.hasConflicts) {
        actions.push({ type: "mark_ready", ...PR_ACTIONS.mark_ready });
      }
      break;
    case "ci_running":
    case "needs_review":
      if (!pr.pr.draft && !pr.hasConflicts && pr.pr.merged_at === null) {
        actions.push({
          type: "enable_auto_merge",
          ...PR_ACTIONS.enable_auto_merge,
        });
      }
      break;
    default:
      break;
  }

  // Evaluate extra actions from consumers
  if (extraActions) {
    const ctx = context ?? {};
    for (const action of extraActions) {
      if (action.when(pr, ctx)) {
        actions.push({
          type: action.type,
          label: action.label,
          description: action.description,
        });
      }
    }
  }

  return actions;
}
