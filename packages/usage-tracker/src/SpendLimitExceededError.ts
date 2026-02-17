import type { SpendStatus } from "./types.js";

export class SpendLimitExceededError extends Error {
  readonly status: SpendStatus;

  constructor(status: SpendStatus) {
    const spent = status.spentUsd.toFixed(2);
    const max = status.limit.maxSpendUsd.toFixed(2);
    super(
      `Spend limit exceeded: $${spent} spent in trailing ${status.limit.label} (limit: $${max})`,
    );
    this.name = "SpendLimitExceededError";
    this.status = status;
  }
}
