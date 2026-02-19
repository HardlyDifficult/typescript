/**
 * PR Action Resolution
 *
 * Determines which actions are available for a PR based on its status.
 * This is the single source of truth for action definitions — clients
 * (web, Discord, voice) render from these descriptors.
 */

import type { ScannedPR } from "./types.js";

/**
 * Unique identifier for each action type.
 * Add new actions here — clients render based on this discriminator.
 */
export type PRActionType =
  | "merge"
  | "fix_ci"
  | "recreate"
  | "mark_ready"
  | "enable_auto_merge";

/**
 * Describes an available action for a PR.
 */
export interface PRActionDescriptor {
  readonly type: PRActionType;
  readonly label: string;
  readonly description: string;
}

/**
 * Action registry — maps each action type to its metadata.
 * Single source of truth; new actions are added here.
 */
export const PR_ACTIONS: Record<
  PRActionType,
  Omit<PRActionDescriptor, "type">
> = {
  merge: { label: "Merge", description: "Squash and merge this PR" },
  fix_ci: { label: "Fix CI", description: "Post @cursor fix CI comment" },
  recreate: {
    label: "Recreate",
    description: "Post @dependabot recreate comment",
  },
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
 * @param options - Additional context needed for conditional actions
 * @returns Array of available action descriptors
 */
export function getAvailableActions(
  pr: ScannedPR,
  options: {
    isDependabot: boolean;
    isWorkPR: boolean;
  }
): PRActionDescriptor[] {
  const actions: PRActionDescriptor[] = [];
  const { status } = pr;

  switch (status) {
    case "ready_to_merge":
    case "approved":
    case "needs_human_review":
      actions.push({ type: "merge", ...PR_ACTIONS.merge });
      break;
    case "ci_failed":
      if (options.isWorkPR) {
        actions.push({ type: "fix_ci", ...PR_ACTIONS.fix_ci });
      }
      if (options.isDependabot) {
        actions.push({ type: "recreate", ...PR_ACTIONS.recreate });
      }
      break;
    case "has_conflicts":
      if (options.isDependabot) {
        actions.push({ type: "recreate", ...PR_ACTIONS.recreate });
      }
      break;
    case "draft":
      if (pr.ciStatus.allPassed && !pr.hasConflicts) {
        actions.push({ type: "mark_ready", ...PR_ACTIONS.mark_ready });
      }
      break;
    case "ci_running":
    case "needs_review":
      // Enable auto-merge for PRs waiting on CI or review
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

  return actions;
}
