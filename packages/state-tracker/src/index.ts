/** Persistent state with auto-save to disk or custom storage adapter. */
export {
  StateTracker,
  createFileStorage,
  defineStateMigration,
  type FileStateStorageOptions,
  type StorageAdapter,
  type StateStorage,
  type StateTrackerOptions,
  type StateTrackerEvent,
  type StateTrackerEventLevel,
  type StateTrackerLoadOrDefaultOptions,
  type StateTrackerMigration,
  type StateTrackerOpenOptions,
  type StateTrackerSaveMeta,
} from "./StateTracker.js";

/** Persistent boolean flag that auto-expires after a configurable duration. */
export {
  TimedFlag,
  type TimedFlagOptions,
  type TimedFlagState,
} from "./TimedFlag.js";
