import type { TaskContext } from "./types.js";

type ContextResolvers = Pick<
  TaskContext,
  | "labels"
  | "statuses"
  | "resolveStatusId"
  | "resolveStatusName"
  | "resolveLabelId"
>;

/**
 * Build the shared resolver portion of a TaskContext.
 * These resolvers are identical across all providers — case-insensitive
 * partial matching for names, exact matching for IDs.
 */
export function buildContextResolvers(
  statuses: readonly { id: string; name: string }[],
  labels: readonly { id: string; name: string; color: string }[]
): ContextResolvers {
  return {
    labels: labels.map((l) => ({ id: l.id, name: l.name, color: l.color })),
    statuses: statuses.map((s) => ({ id: s.id, name: s.name })),

    resolveStatusId(name: string): string {
      const lower = name.toLowerCase();
      const status = statuses.find((s) => s.name.toLowerCase().includes(lower));
      if (!status) {
        throw new Error(`Status "${name}" not found`);
      }
      return status.id;
    },

    resolveStatusName(id: string): string {
      const status = statuses.find((s) => s.id === id);
      if (!status) {
        throw new Error(`Status with ID "${id}" not found`);
      }
      return status.name;
    },

    resolveLabelId(name: string): string {
      const lower = name.toLowerCase();
      const label = labels.find((l) => l.name.toLowerCase().includes(lower));
      if (!label) {
        throw new Error(`Label "${name}" not found`);
      }
      return label.id;
    },
  };
}
