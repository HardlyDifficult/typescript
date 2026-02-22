import type { Pipeline } from "./Pipeline.js";

/**
 * A generic registry for tracking active Pipeline instances.
 *
 * Consumers attach their own metadata type (e.g. targetRepo, triggeredBy)
 * via the `TMeta` generic parameter.
 *
 * When a pipeline is registered, the registry subscribes to its change events
 * and re-emits a single "changed" event so consumers (e.g. dashboard broadcast)
 * can react to any pipeline state change.
 */
export class PipelineRegistry<
  TMeta = Record<string, unknown>,
> {
  private readonly entries = new Map<
    string,
    { pipeline: Pipeline<Record<string, unknown>>; meta: TMeta; unsubscribe: () => void }
  >();

  private readonly listeners = new Set<() => void>();

  /**
   * Register a pipeline with the given id and metadata.
   * Subscribes to pipeline change events to broadcast updates.
   */
  register(
    id: string,
    pipeline: Pipeline<Record<string, unknown>>,
    meta: TMeta,
  ): void {
    // Unsubscribe from any previously registered pipeline with the same id
    const existing = this.entries.get(id);
    if (existing) {
      existing.unsubscribe();
    }

    const unsubscribe = pipeline.on(() => {
      this.emitChanged();
    });

    this.entries.set(id, { pipeline, meta, unsubscribe });
    this.emitChanged();
  }

  /** Remove a pipeline from the registry. */
  unregister(id: string): void {
    const entry = this.entries.get(id);
    if (entry) {
      entry.unsubscribe();
      this.entries.delete(id);
      this.emitChanged();
    }
  }

  /** Get a single entry by id. */
  get(
    id: string,
  ): { pipeline: Pipeline<Record<string, unknown>>; meta: TMeta } | undefined {
    const entry = this.entries.get(id);
    if (!entry) return undefined;
    return { pipeline: entry.pipeline, meta: entry.meta };
  }

  /** Get all registered entries. */
  getAll(): { id: string; pipeline: Pipeline<Record<string, unknown>>; meta: TMeta }[] {
    return [...this.entries.entries()].map(([id, { pipeline, meta }]) => ({
      id,
      pipeline,
      meta,
    }));
  }

  /** Cancel a pipeline by id. Returns true if the pipeline was found and cancelled. */
  async cancel(id: string): Promise<boolean> {
    const entry = this.entries.get(id);
    if (!entry) return false;
    await entry.pipeline.cancel();
    return true;
  }

  /** Subscribe to change events. Returns an unsubscribe function. */
  onChanged(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Number of registered pipelines. */
  get size(): number {
    return this.entries.size;
  }

  private emitChanged(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
