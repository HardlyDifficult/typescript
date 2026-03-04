/** Persistent state with auto-save to disk or custom storage adapter. */
export {
  StateTracker,
  defineStateMigration,
  type StorageAdapter,
  type StateTrackerOptions,
  type StateTrackerEvent,
  type StateTrackerEventLevel,
  type StateTrackerLoadOrDefaultOptions,
  type StateTrackerMigration,
  type StateTrackerSaveMeta,
} from "./StateTracker.js";
