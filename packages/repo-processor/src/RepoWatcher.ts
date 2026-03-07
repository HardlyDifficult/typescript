import { StateTracker } from "@hardlydifficult/state-tracker";

import type { RepoProcessor } from "./RepoProcessor.js";
import type { RepoProcessorRunResult, RepoWatcherOptions } from "./types.js";

interface WatcherState {
  lastProcessedSha?: string;
}

function getDefaultStateKey(repo: string): string {
  return `repo-processor-${repo.replace(/[^A-Za-z0-9_-]/gu, "-")}`;
}

/** Watches for repository updates and schedules processor runs with retries. */
export class RepoWatcher<TFileResult = unknown, TDirResult = never> {
  static async open<TFileResult, TDirResult>(
    processor: RepoProcessor<TFileResult, TDirResult>,
    options: RepoWatcherOptions = {}
  ): Promise<RepoWatcher<TFileResult, TDirResult>> {
    const stateTracker = await StateTracker.open<WatcherState>({
      key: options.stateKey ?? getDefaultStateKey(processor.repo),
      default: {},
      stateDirectory: options.stateDirectory,
      autoSaveMs: options.autoSaveMs ?? 5000,
      onEvent: options.onEvent,
    });

    return new RepoWatcher(processor, stateTracker, options);
  }

  private readonly processor: RepoProcessor<TFileResult, TDirResult>;
  private readonly stateTracker: StateTracker<WatcherState>;
  private readonly onComplete:
    | ((result: RepoProcessorRunResult, sha: string) => void)
    | undefined;
  private readonly onError: ((error: unknown) => void) | undefined;
  private readonly onEvent: RepoWatcherOptions["onEvent"];
  private readonly maxAttempts: number;
  private running = false;
  private pendingSha: string | undefined;

  private constructor(
    processor: RepoProcessor<TFileResult, TDirResult>,
    stateTracker: StateTracker<WatcherState>,
    options: RepoWatcherOptions
  ) {
    this.processor = processor;
    this.stateTracker = stateTracker;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
    this.onEvent = options.onEvent;
    this.maxAttempts = options.maxAttempts ?? 1;
  }

  handlePush(sha: string): void {
    if (this.getLastSha() === sha) {
      return;
    }

    if (this.running) {
      this.pendingSha = sha;
      return;
    }

    this.queueRun();
  }

  async runNow(): Promise<RepoProcessorRunResult> {
    if (this.running) {
      throw new Error(`Already running for ${this.processor.repo}`);
    }

    this.running = true;
    try {
      const result = await this.executeWithRetry();
      this.completeRun(result);
      return result;
    } catch (error) {
      this.onError?.(error);
      throw error;
    } finally {
      this.running = false;
      this.flushPendingRun();
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  getLastSha(): string | undefined {
    return this.stateTracker.state.lastProcessedSha;
  }

  setLastSha(sha: string): void {
    this.stateTracker.set({ lastProcessedSha: sha });
  }

  private queueRun(): void {
    this.running = true;

    this.executeWithRetry()
      .then((result) => {
        this.completeRun(result);
      })
      .catch((error: unknown) => {
        this.onError?.(error);
      })
      .finally(() => {
        this.running = false;
        this.flushPendingRun();
      });
  }

  private completeRun(result: RepoProcessorRunResult): void {
    this.setLastSha(result.sourceSha);
    this.onComplete?.(result, result.sourceSha);
  }

  private flushPendingRun(): void {
    const { pendingSha } = this;
    this.pendingSha = undefined;

    if (
      pendingSha === undefined ||
      pendingSha === this.getLastSha() ||
      this.running
    ) {
      return;
    }

    this.queueRun();
  }

  private async executeWithRetry(): Promise<RepoProcessorRunResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.processor.run();
      } catch (error) {
        lastError = error;
        if (attempt < this.maxAttempts) {
          this.onEvent?.({
            level: "warn",
            message: `Run failed (attempt ${String(attempt)}/${String(this.maxAttempts)}), retrying`,
            context: {
              repo: this.processor.repo,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }
    }

    throw lastError;
  }
}
