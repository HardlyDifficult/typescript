import type { BudgetStatus } from "./types.js";

export class BudgetExceededError extends Error {
  readonly status: BudgetStatus;

  constructor(status: BudgetStatus) {
    const spent = status.spentUsd.toFixed(2);
    const limit = status.limitUsd.toFixed(2);
    super(
      `Budget exceeded: $${spent} spent in the last ${status.window} (limit: $${limit})`
    );
    this.name = "BudgetExceededError";
    this.status = status;
  }
}
