import { StateTracker, type StateTrackerEvent } from "@hardlydifficult/state-tracker";

export interface RepoWatcherConfig<TResult> {
  /** Key used for persisting state to disk. */
  stateKey: string;
  /** Directory where state is persisted. */
  stateDirectory: string;
  /** Auto-save interval in milliseconds. Default 5000. */
  autoSaveMs?: number;
  /** The work to run for a repo. */
  run: (owner: string, name: string) => Promise<TResult>;
  /** Called after a successful run. */
  onComplete?: (
    owner: string,
    name: string,
    result: TResult,
    sha: string
  ) => void;
  /** Called when a run fails. */
  onError?: (owner: string, name: string, error: unknown) => void;
  /** Logger/event callback. */
  onEvent?: (event: StateTrackerEvent) => void;
  /** Number of attempts (initial + retries). Default 1 (no retry). */
  maxAttempts?: number;
}

interface WatcherState {
  lastProcessedSha: Record<string, string>;
}

/**
 * Watches for SHA changes on GitHub repos and triggers processing.
 *
 * Handles state persistence (last-processed SHA per repo), concurrent run
 * prevention, pending SHA re-triggers, and manual triggers. Consumers
 * provide the `run` callback containing domain-specific logic.
 */
export class RepoWatcher<TResult = void> {
  private readonly stateTracker: StateTracker<WatcherState>;
  private readonly running = new Set<string>();
  private readonly pendingSha = new Map<string, string>();
  private readonly config: RepoWatcherConfig<TResult>;
  private readonly maxAttempts: number;

  constructor(config: RepoWatcherConfig<TResult>) {
    this.config = config;
    this.maxAttempts = config.maxAttempts ?? 1;

    this.stateTracker = new StateTracker<WatcherState>({
      key: config.stateKey,
      default: { lastProcessedSha: {} },
      stateDirectory: config.stateDirectory,
      autoSaveMs: config.autoSaveMs ?? 5000,
      onEvent: config.onEvent,
    });
  }

  /** Load persisted state from disk. */
  async init(): Promise<void> {
    await this.stateTracker.loadAsync();
  }

  /**
   * Handle a push event. Compares the SHA against tracked state,
   * queues processing if changed, stores as pending if already running.
   */
  handlePush(owner: string, name: string, sha: string): void {
    const key = `${owner}/${name}`;
    const lastSha = this.stateTracker.state.lastProcessedSha[key];
    if (lastSha === sha) {
      return;
    }

    if (this.running.has(key)) {
      this.pendingSha.set(key, sha);
      return;
    }

    this.queueRun(owner, name, sha);
  }

  /**
   * Queue a run unconditionally (no SHA comparison).
   * Skips if already running. Returns false if skipped.
   */
  trigger(owner: string, name: string): boolean {
    const key = `${owner}/${name}`;
    if (this.running.has(key)) {
      return false;
    }
    this.queueRun(owner, name, "");
    return true;
  }

  /**
   * Run processing synchronously (blocks until complete).
   * Returns an error if already running.
   */
  async triggerManual(
    owner: string,
    name: string
  ): Promise<
    { success: true; result: TResult } | { success: false; reason: string }
  > {
    const key = `${owner}/${name}`;
    if (this.running.has(key)) {
      return {
        success: false,
        reason: `Already running for ${key}`,
      };
    }

    this.running.add(key);
    try {
      const result = await this.executeWithRetry(owner, name);
      return { success: true, result };
    } catch (error) {
      this.config.onError?.(owner, name, error);
      const message =
        error instanceof Error ? error.message : String(error);
      return { success: false, reason: message };
    } finally {
      this.running.delete(key);
    }
  }

  /** Check if a repo is currently being processed. */
  isRunning(owner: string, name: string): boolean {
    return this.running.has(`${owner}/${name}`);
  }

  /** Get the last processed SHA for a repo key. */
  getLastSha(key: string): string | undefined {
    return this.stateTracker.state.lastProcessedSha[key];
  }

  /** Persist a processed SHA for a repo key. */
  setLastSha(key: string, sha: string): void {
    this.stateTracker.set({
      ...this.stateTracker.state,
      lastProcessedSha: {
        ...this.stateTracker.state.lastProcessedSha,
        [key]: sha,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private queueRun(owner: string, name: string, sha: string): void {
    const key = `${owner}/${name}`;
    this.running.add(key);

    this.executeWithRetry(owner, name)
      .then((result) => {
        if (sha) {
          this.setLastSha(key, sha);
        }
        this.config.onComplete?.(owner, name, result, sha);
      })
      .catch((error: unknown) => {
        this.config.onError?.(owner, name, error);
      })
      .finally(() => {
        this.running.delete(key);

        const pending = this.pendingSha.get(key);
        if (pending !== undefined) {
          this.pendingSha.delete(key);
          this.handlePush(owner, name, pending);
        }
      });
  }

  private async executeWithRetry(
    owner: string,
    name: string
  ): Promise<TResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.config.run(owner, name);
      } catch (error) {
        lastError = error;
        if (attempt < this.maxAttempts) {
          this.config.onEvent?.({
            level: "warn",
            message: `Run failed (attempt ${String(attempt)}/${String(this.maxAttempts)}), retrying`,
            context: {
              repo: `${owner}/${name}`,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }
    }

    throw lastError;
  }
}
