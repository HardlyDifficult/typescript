// Types
export type {
  Command,
  CommandContext,
  ArgShape,
  ParseResult,
  Agent,
  CoreBotState,
} from "./types";

// Registry & Dispatcher
export {
  CommandRegistry,
  type RegisteredCommand,
} from "./CommandRegistry";
export {
  CommandDispatcher,
  type DispatcherOptions,
} from "./CommandDispatcher";

// Job Lifecycle
export {
  setupJobLifecycle,
  type JobLifecycleOptions,
  type JobLifecycleHandle,
  EMOJI_CANCEL,
  EMOJI_DISMISS,
} from "./jobLifecycle";

// Helpers
export {
  formatWorkerError,
  RECOVERABLE_WORKER_ERRORS,
} from "./workerErrors";
