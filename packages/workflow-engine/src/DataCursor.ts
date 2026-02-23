import { CursorTargetNotFoundError } from "./errors.js";
import type { WorkflowEngine } from "./WorkflowEngine.js";

/**
 * Reusable cursor for safe navigation into nested engine data.
 *
 * Define a selector once, then use `get()` / `find()` / `update()` to
 * interact with the selected item without repeating navigation logic.
 */
export class DataCursor<TStatus extends string, TData, TItem> {
  private readonly engine: WorkflowEngine<TStatus, TData>;
  private readonly selector: (data: TData) => TItem | undefined;

  constructor(
    engine: WorkflowEngine<TStatus, TData>,
    selector: (data: TData) => TItem | undefined
  ) {
    this.engine = engine;
    this.selector = selector;
  }

  /** Get the selected item. Throws if the selector returns undefined. */
  get(): TItem {
    const item = this.selector(this.engine.data as TData);
    if (item === undefined) {
      throw new CursorTargetNotFoundError();
    }
    return item;
  }

  /** Get the selected item, or undefined. */
  find(): TItem | undefined {
    return this.selector(this.engine.data as TData);
  }

  /**
   * Update the selected item (and optionally the parent data).
   * No-op if the selector returns undefined.
   */
  async update(updater: (item: TItem, data: TData) => void): Promise<void> {
    await this.engine.update((d) => {
      const item = this.selector(d);
      if (item !== undefined) {
        updater(item, d);
      }
    });
  }
}
