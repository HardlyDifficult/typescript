// Types
export type {
  Command,
  CommandContext,
  ArgShape,
  ParseResult,
  Agent,
  CoreBotState,
} from "./types.js";

// Registry & Dispatcher
export { CommandRegistry, type RegisteredCommand } from "./CommandRegistry.js";
export { CommandDispatcher, type DispatcherOptions } from "./CommandDispatcher.js";

// Job Lifecycle
export {
  setupJobLifecycle,
  type JobLifecycleOptions,
  type JobLifecycleHandle,
  EMOJI_CANCEL,
  EMOJI_DISMISS,
} from "./jobLifecycle.js";

// Helpers
export { formatWorkerError, RECOVERABLE_WORKER_ERRORS } from "./workerErrors.js";
export { createPrefixParser } from "./createPrefixParser.js";
