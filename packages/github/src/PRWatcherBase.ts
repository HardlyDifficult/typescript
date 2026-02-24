import type {
  CheckRunEvent,
  CommentEvent,
  PollCompleteEvent,
  PREvent,
  PRUpdatedEvent,
  PRWatcherEvent,
  PushEvent,
  ReviewEvent,
  StatusChangedEvent,
} from "./types.js";

/** Base class providing the event-callback infrastructure for PRWatcher. */
export class PRWatcherBase {
  protected readonly newPRCallbacks = new Set<(event: PREvent) => void>();
  protected readonly commentCallbacks = new Set<
    (event: CommentEvent) => void
  >();
  protected readonly reviewCallbacks = new Set<(event: ReviewEvent) => void>();
  protected readonly checkRunCallbacks = new Set<
    (event: CheckRunEvent) => void
  >();
  protected readonly mergedCallbacks = new Set<(event: PREvent) => void>();
  protected readonly closedCallbacks = new Set<(event: PREvent) => void>();
  protected readonly updatedCallbacks = new Set<
    (event: PRUpdatedEvent) => void
  >();
  protected readonly pollCompleteCallbacks = new Set<
    (event: PollCompleteEvent) => void
  >();
  protected readonly statusChangedCallbacks = new Set<
    (event: StatusChangedEvent) => void
  >();
  protected readonly errorCallbacks = new Set<(error: Error) => void>();
  protected readonly pushCallbacks = new Set<(event: PushEvent) => void>();
  protected readonly eventCallbacks = new Set<
    (event: PRWatcherEvent) => void
  >();

  onNewPR(callback: (event: PREvent) => void): () => void {
    this.newPRCallbacks.add(callback);
    return () => this.newPRCallbacks.delete(callback);
  }

  onComment(callback: (event: CommentEvent) => void): () => void {
    this.commentCallbacks.add(callback);
    return () => this.commentCallbacks.delete(callback);
  }

  onReview(callback: (event: ReviewEvent) => void): () => void {
    this.reviewCallbacks.add(callback);
    return () => this.reviewCallbacks.delete(callback);
  }

  onCheckRun(callback: (event: CheckRunEvent) => void): () => void {
    this.checkRunCallbacks.add(callback);
    return () => this.checkRunCallbacks.delete(callback);
  }

  onMerged(callback: (event: PREvent) => void): () => void {
    this.mergedCallbacks.add(callback);
    return () => this.mergedCallbacks.delete(callback);
  }

  onClosed(callback: (event: PREvent) => void): () => void {
    this.closedCallbacks.add(callback);
    return () => this.closedCallbacks.delete(callback);
  }

  onPRUpdated(callback: (event: PRUpdatedEvent) => void): () => void {
    this.updatedCallbacks.add(callback);
    return () => this.updatedCallbacks.delete(callback);
  }

  onPollComplete(callback: (event: PollCompleteEvent) => void): () => void {
    this.pollCompleteCallbacks.add(callback);
    return () => this.pollCompleteCallbacks.delete(callback);
  }

  onStatusChanged(callback: (event: StatusChangedEvent) => void): () => void {
    this.statusChangedCallbacks.add(callback);
    return () => this.statusChangedCallbacks.delete(callback);
  }

  /** Fires when the HEAD SHA of a watched repository's default branch changes. */
  onPush(callback: (event: PushEvent) => void): () => void {
    this.pushCallbacks.add(callback);
    return () => this.pushCallbacks.delete(callback);
  }

  onEvent(callback: (event: PRWatcherEvent) => void): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  onError(callback: (error: Error) => void): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  protected emitWatcherEvent(event: PRWatcherEvent): void {
    this.emit(this.eventCallbacks, event);

    switch (event.type) {
      case "new_pr":
        this.emit(this.newPRCallbacks, event.payload);
        break;
      case "comment":
        this.emit(this.commentCallbacks, event.payload);
        break;
      case "review":
        this.emit(this.reviewCallbacks, event.payload);
        break;
      case "check_run":
        this.emit(this.checkRunCallbacks, event.payload);
        break;
      case "merged":
        this.emit(this.mergedCallbacks, event.payload);
        break;
      case "closed":
        this.emit(this.closedCallbacks, event.payload);
        break;
      case "pr_updated":
        this.emit(this.updatedCallbacks, event.payload);
        break;
      case "poll_complete":
        this.emit(this.pollCompleteCallbacks, event.payload);
        break;
      case "status_changed":
        this.emit(this.statusChangedCallbacks, event.payload);
        break;
      case "push":
        this.emit(this.pushCallbacks, event.payload);
        break;
      default:
        event satisfies never;
    }
  }

  protected emit<T>(callbacks: Set<(event: T) => void>, event: T): void {
    for (const callback of callbacks) {
      try {
        callback(event);
      } catch (error: unknown) {
        this.emitError(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
  }

  protected emitError(error: Error): void {
    for (const callback of this.errorCallbacks) {
      callback(error);
    }
  }
}
