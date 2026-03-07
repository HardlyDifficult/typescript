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
