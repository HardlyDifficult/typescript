import {
  LabelNotFoundError,
  StatusIdNotFoundError,
  StatusNotFoundError,
} from "./errors.js";
import type { Label, Status, TaskContext } from "./types.js";

/** Compares two strings case-insensitively. */
export function matchesCaseInsensitive(
  value: string,
  expected: string
): boolean {
  return value.toLowerCase() === expected.toLowerCase();
}

/** Finds the first item whose `name` matches `name` case-insensitively. */
export function findByCaseInsensitiveName<T extends { name: string }>(
  items: readonly T[],
  name: string
): T | undefined {
  return items.find((item) => matchesCaseInsensitive(item.name, name));
}

type ContextResolvers = Pick<
  TaskContext,
  | "labels"
  | "statuses"
  | "resolveStatusId"
  | "resolveStatusName"
  | "resolveLabelId"
>;

/** Builds status/label resolver helpers for task mutation operations. */
export function buildContextResolvers(
  statuses: readonly Status[],
  labels: readonly Label[]
): ContextResolvers {
  return {
    labels: labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
    })),
    statuses: statuses.map((status) => ({
      id: status.id,
      name: status.name,
    })),

    resolveStatusId(name: string): string {
      const status = findByCaseInsensitiveName(statuses, name);
      if (!status) {
        throw new StatusNotFoundError(
          name,
          undefined,
          statuses.map((entry) => entry.name)
        );
      }
      return status.id;
    },

    resolveStatusName(id: string): string {
      const status = statuses.find((entry) => entry.id === id);
      if (!status) {
        throw new StatusIdNotFoundError(
          id,
          statuses.map((entry) => entry.name)
        );
      }
      return status.name;
    },

    resolveLabelId(name: string): string {
      const label = findByCaseInsensitiveName(labels, name);
      if (!label) {
        throw new LabelNotFoundError(
          name,
          undefined,
          labels.map((entry) => entry.name)
        );
      }
      return label.id;
    },
  };
}
