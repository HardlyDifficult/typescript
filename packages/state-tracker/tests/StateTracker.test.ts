import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  defineStateMigration,
  StateTracker,
  type StateTrackerEvent,
} from "../src/StateTracker";

describe("StateTracker", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "state-tracker-test-"));
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("constructor", () => {
    it("should create state directory if not exists", () => {
      const stateDir = path.join(testDir, "nested", "state");
      expect(fs.existsSync(stateDir)).toBe(false);

      new StateTracker({ key: "test", default: 0, stateDirectory: stateDir });

      expect(fs.existsSync(stateDir)).toBe(true);
    });

    it("should reject keys with invalid characters", () => {
      expect(
        () =>
          new StateTracker({
            key: "../evil",
            default: 0,
            stateDirectory: testDir,
          })
      ).toThrow("invalid characters");
      expect(
        () =>
          new StateTracker({
            key: "foo/bar",
            default: 0,
            stateDirectory: testDir,
          })
      ).toThrow("invalid characters");
      expect(
        () =>
          new StateTracker({
            key: "foo\\bar",
            default: 0,
            stateDirectory: testDir,
          })
      ).toThrow("invalid characters");
      expect(
        () =>
          new StateTracker({
            key: "foo.bar",
            default: 0,
            stateDirectory: testDir,
          })
      ).toThrow("invalid characters");
      expect(
        () =>
          new StateTracker({
            key: "foo@bar",
            default: 0,
            stateDirectory: testDir,
          })
      ).toThrow("invalid characters");
    });

    it("should reject empty keys", () => {
      expect(
        () => new StateTracker({ key: "", default: 0, stateDirectory: testDir })
      ).toThrow("non-empty string");
      expect(
        () =>
          new StateTracker({ key: "   ", default: 0, stateDirectory: testDir })
      ).toThrow("non-empty string");
    });
  });

  describe("load", () => {
    it("should return default value when no state file exists", () => {
      const tracker = new StateTracker({
        key: "test",
        default: 42,
        stateDirectory: testDir,
      });
      const value = tracker.load();
      expect(value).toBe(42);
    });

    it("should load saved numeric value", () => {
      const tracker = new StateTracker({
        key: "test",
        default: 0,
        stateDirectory: testDir,
      });
      tracker.save(100);

      const value = tracker.load();
      expect(value).toBe(100);
    });

    it("should always use value property in JSON file", () => {
      const tracker = new StateTracker({
        key: "test",
        default: 0,
        stateDirectory: testDir,
      });
      tracker.save(200);

      const filePath = tracker.getFilePath();
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<
        string,
        unknown
      >;
      expect(content.value).toBe(200);
    });

    it("should return default for corrupted JSON", () => {
      const tracker = new StateTracker({
        key: "test",
        default: 999,
        stateDirectory: testDir,
      });
      const filePath = tracker.getFilePath();
      fs.writeFileSync(filePath, "not valid json{{{", "utf-8");

      const value = tracker.load();
      expect(value).toBe(999);
    });

    it("should return default when value property is missing", () => {
      const tracker = new StateTracker({
        key: "test",
        default: 777,
        stateDirectory: testDir,
      });
      const filePath = tracker.getFilePath();
      fs.writeFileSync(filePath, JSON.stringify({ other: "data" }), "utf-8");

      const value = tracker.load();
      expect(value).toBe(777);
    });
  });

  describe("save", () => {
    it("should save numeric value", () => {
      const tracker = new StateTracker({
        key: "test",
        default: 0,
        stateDirectory: testDir,
      });
      tracker.save(500);

      const filePath = tracker.getFilePath();
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<
        string,
        unknown
      >;
      expect(content.value).toBe(500);
      expect(content.lastUpdated).toBeDefined();
    });

    it("should overwrite previous value", () => {
      const tracker = new StateTracker({
        key: "test",
        default: 0,
        stateDirectory: testDir,
      });
      tracker.save(100);
      tracker.save(200);
      tracker.save(300);

      const value = tracker.load();
      expect(value).toBe(300);
    });
  });

  describe("loadOrDefault", () => {
    it("returns default when file is missing", () => {
      const tracker = new StateTracker({
        key: "load-or-default",
        default: { cursor: 0, done: [] as string[] },
        stateDirectory: testDir,
      });

      const value = tracker.loadOrDefault();
      expect(value).toEqual({ cursor: 0, done: [] });
    });

    it("applies typed migration for legacy raw state files", () => {
      interface LegacySyncState {
        offset: number;
        completedIds: string[];
      }

      const tracker = new StateTracker({
        key: "legacy-raw",
        default: { cursor: 0, done: [] as string[] },
        stateDirectory: testDir,
      });

      fs.writeFileSync(
        tracker.getFilePath(),
        JSON.stringify({ offset: 7, completedIds: ["a", "b"] }),
        "utf-8"
      );

      const migration = defineStateMigration<
        { cursor: number; done: string[] },
        LegacySyncState
      >({
        name: "sync-state-v0",
        isLegacy(input): input is LegacySyncState {
          if (
            input === null ||
            typeof input !== "object" ||
            Array.isArray(input)
          ) {
            return false;
          }
          const record = input as Record<string, unknown>;
          return (
            typeof record.offset === "number" &&
            Array.isArray(record.completedIds)
          );
        },
        migrate(legacy) {
          return {
            cursor: legacy.offset,
            done: legacy.completedIds,
          };
        },
      });

      const value = tracker.loadOrDefault({ migrations: [migration] });
      expect(value).toEqual({ cursor: 7, done: ["a", "b"] });
    });

    it("applies migrations to envelope value payloads", () => {
      interface LegacySyncState {
        offset: number;
      }

      const tracker = new StateTracker({
        key: "legacy-envelope",
        default: { cursor: 0 },
        stateDirectory: testDir,
      });

      fs.writeFileSync(
        tracker.getFilePath(),
        JSON.stringify({
          value: { offset: 22 },
          lastUpdated: new Date().toISOString(),
        }),
        "utf-8"
      );

      const migration = defineStateMigration<
        { cursor: number },
        LegacySyncState
      >({
        name: "sync-state-envelope-v0",
        isLegacy(input): input is LegacySyncState {
          if (
            input === null ||
            typeof input !== "object" ||
            Array.isArray(input)
          ) {
            return false;
          }
          return typeof (input as Record<string, unknown>).offset === "number";
        },
        migrate(legacy) {
          return { cursor: legacy.offset };
        },
      });

      const value = tracker.loadOrDefault({ migrations: [migration] });
      expect(value).toEqual({ cursor: 22 });
    });
  });

  describe("saveWithMeta", () => {
    it("persists metadata in the envelope", () => {
      const tracker = new StateTracker({
        key: "save-with-meta",
        default: { cursor: 0 },
        stateDirectory: testDir,
      });

      tracker.saveWithMeta(
        { cursor: 99 },
        { source: "sync-script", reason: "manual-run" }
      );

      const file = JSON.parse(
        fs.readFileSync(tracker.getFilePath(), "utf-8")
      ) as {
        value: { cursor: number };
        lastUpdated: string;
        meta: Record<string, unknown>;
      };

      expect(file.value).toEqual({ cursor: 99 });
      expect(typeof file.lastUpdated).toBe("string");
      expect(file.meta).toEqual({
        source: "sync-script",
        reason: "manual-run",
      });
      expect(tracker.load()).toEqual({ cursor: 99 });
    });
  });

  describe("type inference from default", () => {
    it("should infer string type from default", () => {
      const tracker = new StateTracker({
        key: "string-test",
        default: "default-value",
        stateDirectory: testDir,
      });
      tracker.save("hello world");

      const value = tracker.load();
      expect(value).toBe("hello world");
    });

    it("should infer object type from default", () => {
      const tracker = new StateTracker({
        key: "object-test",
        default: { count: 0, name: "" },
        stateDirectory: testDir,
      });
      tracker.save({ count: 10, name: "test" });

      const value = tracker.load();
      expect(value).toEqual({ count: 10, name: "test" });
    });

    it("should infer array type from default", () => {
      const tracker = new StateTracker({
        key: "array-test",
        default: [] as number[],
        stateDirectory: testDir,
      });
      tracker.save([1, 2, 3, 4, 5]);

      const value = tracker.load();
      expect(value).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe("state getter defensive copy", () => {
    it("does not allow external mutation of nested objects", () => {
      const tracker = new StateTracker({
        key: "state-clone",
        default: {
          stats: { count: 1 },
          tags: ["a"],
        },
        stateDirectory: testDir,
      });

      const state = tracker.state as {
        stats: { count: number };
        tags: string[];
      };
      state.stats.count = 999;
      state.tags.push("b");

      expect(tracker.state).toEqual({
        stats: { count: 1 },
        tags: ["a"],
      });
    });
  });

  describe("getFilePath", () => {
    it("should return correct file path", () => {
      const tracker = new StateTracker({
        key: "my-key",
        default: 0,
        stateDirectory: testDir,
      });
      const filePath = tracker.getFilePath();

      expect(filePath).toBe(path.join(testDir, "my-key.json"));
    });
  });

  describe("persistence across instances", () => {
    it("should persist state across different tracker instances", () => {
      const tracker1 = new StateTracker({
        key: "shared",
        default: 0,
        stateDirectory: testDir,
      });
      tracker1.save(12345);

      const tracker2 = new StateTracker({
        key: "shared",
        default: 0,
        stateDirectory: testDir,
      });
      const value = tracker2.load();

      expect(value).toBe(12345);
    });
  });

  describe("atomic write durability", () => {
    it("should not corrupt state file if temp file exists from interrupted write", () => {
      const tracker = new StateTracker({
        key: "durable",
        default: 0,
        stateDirectory: testDir,
      });

      tracker.save(100);

      const tempFilePath = `${tracker.getFilePath()}.tmp`;
      fs.writeFileSync(
        tempFilePath,
        '{"value": 999, "lastUpdated": "corrupted"}',
        "utf-8"
      );

      const value = tracker.load();
      expect(value).toBe(100);
    });
  });

  // ========== v2 tests below ==========

  describe("loadAsync / saveAsync", () => {
    it("loadAsync returns void and sets state", async () => {
      const tracker = new StateTracker({
        key: "async-load",
        default: { count: 0, name: "default" },
        stateDirectory: testDir,
      });

      // Pre-write a v1 envelope file
      const filePath = tracker.getFilePath();
      fs.writeFileSync(
        filePath,
        JSON.stringify({
          value: { count: 42, name: "loaded" },
          lastUpdated: new Date().toISOString(),
        }),
        "utf-8"
      );

      const result = await tracker.loadAsync();
      expect(result).toBeUndefined();
      expect(tracker.state).toEqual({ count: 42, name: "loaded" });
    });

    it("loadAsync gracefully degrades on unwritable directory", async () => {
      // Use a directory path that will fail during mkdir
      // /proc is a read-only filesystem on Linux
      const badDir = path.join("/proc", "nonexistent-state-tracker-test");

      // We need to construct a tracker whose directory already exists
      // but whose file read will fail. Simplest: make the file unreadable.
      const tracker = new StateTracker({
        key: "fail-read",
        default: { x: 1 },
        stateDirectory: testDir,
      });

      // Write a file then make it unreadable
      fs.writeFileSync(tracker.getFilePath(), "some data", "utf-8");
      fs.chmodSync(tracker.getFilePath(), 0o000);

      await tracker.loadAsync();
      expect(tracker.isPersistent).toBe(false);
      expect(tracker.state).toEqual({ x: 1 });

      // Restore permissions so cleanup works
      fs.chmodSync(tracker.getFilePath(), 0o644);
    });

    it("saveAsync writes atomically via temp file", async () => {
      const tracker = new StateTracker({
        key: "atomic-save",
        default: { value: "hello" },
        stateDirectory: testDir,
      });
      await tracker.loadAsync();
      tracker.set({ value: "world" });

      await tracker.saveAsync();

      const filePath = tracker.getFilePath();
      expect(fs.existsSync(filePath)).toBe(true);

      // Temp file should have been renamed away
      expect(fs.existsSync(`${filePath}.tmp`)).toBe(false);

      const content = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<
        string,
        unknown
      >;
      expect(content.value).toEqual({ value: "world" });
      expect(content.lastUpdated).toBeDefined();
    });

    it("loadAsync merges v1 envelope value with defaults for missing keys", async () => {
      const tracker = new StateTracker({
        key: "v1-merge",
        default: { count: 0, name: "default", extra: true },
        stateDirectory: testDir,
      });

      // Write v1 envelope format missing the "extra" key
      fs.writeFileSync(
        tracker.getFilePath(),
        JSON.stringify({
          value: { count: 42, name: "loaded" },
          lastUpdated: new Date().toISOString(),
        }),
        "utf-8"
      );

      await tracker.loadAsync();

      // Missing "extra" key should come from defaults
      expect(tracker.state).toEqual({
        count: 42,
        name: "loaded",
        extra: true,
      });
    });

    it("sync load merges v1 envelope value with defaults for missing keys", () => {
      const tracker = new StateTracker({
        key: "v1-merge-sync",
        default: { count: 0, name: "default", extra: true },
        stateDirectory: testDir,
      });

      fs.writeFileSync(
        tracker.getFilePath(),
        JSON.stringify({
          value: { count: 42, name: "loaded" },
          lastUpdated: new Date().toISOString(),
        }),
        "utf-8"
      );

      const value = tracker.load();

      expect(value).toEqual({
        count: 42,
        name: "loaded",
        extra: true,
      });
      expect(tracker.state).toEqual(value);
    });

    it("loadAsync is idempotent (calling twice is a no-op)", async () => {
      const tracker = new StateTracker({
        key: "idempotent",
        default: { count: 0 },
        stateDirectory: testDir,
      });

      // Write initial state
      fs.writeFileSync(
        tracker.getFilePath(),
        JSON.stringify({ value: { count: 10 }, lastUpdated: "t1" }),
        "utf-8"
      );

      await tracker.loadAsync();
      expect(tracker.state).toEqual({ count: 10 });

      // Overwrite file on disk
      fs.writeFileSync(
        tracker.getFilePath(),
        JSON.stringify({ value: { count: 99 }, lastUpdated: "t2" }),
        "utf-8"
      );

      // Second loadAsync should be a no-op
      await tracker.loadAsync();
      expect(tracker.state).toEqual({ count: 10 });
    });
  });

  describe("set() / update() / reset()", () => {
    it("set replaces state entirely", () => {
      const tracker = new StateTracker({
        key: "set-test",
        default: { a: 1, b: 2 },
        stateDirectory: testDir,
      });

      tracker.set({ a: 10, b: 20 });
      expect(tracker.state).toEqual({ a: 10, b: 20 });
    });

    it("update merges partial changes on object state", () => {
      const tracker = new StateTracker({
        key: "update-test",
        default: { a: 1, b: 2, c: 3 },
        stateDirectory: testDir,
      });

      tracker.update({ b: 20 });
      expect(tracker.state).toEqual({ a: 1, b: 20, c: 3 });
    });

    it("update throws on primitive state", () => {
      const tracker = new StateTracker({
        key: "update-prim",
        default: 42,
        stateDirectory: testDir,
      });

      expect(() => tracker.update(100 as never)).toThrow(
        "update() can only be used when state is a non-array object"
      );
    });

    it("reset restores to default value", () => {
      const tracker = new StateTracker({
        key: "reset-test",
        default: { x: "original" },
        stateDirectory: testDir,
      });

      tracker.set({ x: "changed" });
      expect(tracker.state).toEqual({ x: "changed" });

      tracker.reset();
      expect(tracker.state).toEqual({ x: "original" });
    });
  });

  describe(".state getter", () => {
    it("returns current in-memory state after load", () => {
      const tracker = new StateTracker({
        key: "state-getter",
        default: { val: "init" },
        stateDirectory: testDir,
      });

      // Before load, state is the default (set in constructor)
      expect(tracker.state).toEqual({ val: "init" });

      tracker.save({ val: "saved" });
      tracker.load();
      expect(tracker.state).toEqual({ val: "saved" });
    });

    it("returns current state after set/update", () => {
      const tracker = new StateTracker({
        key: "state-after-set",
        default: { a: 0, b: "" },
        stateDirectory: testDir,
      });

      tracker.set({ a: 5, b: "hello" });
      expect(tracker.state).toEqual({ a: 5, b: "hello" });

      tracker.update({ b: "world" });
      expect(tracker.state).toEqual({ a: 5, b: "world" });
    });
  });

  describe(".isPersistent getter", () => {
    it("returns true when storage is available", async () => {
      const tracker = new StateTracker({
        key: "persistent-true",
        default: { x: 1 },
        stateDirectory: testDir,
      });

      await tracker.loadAsync();
      expect(tracker.isPersistent).toBe(true);
    });

    it("returns false when storage failed", async () => {
      const tracker = new StateTracker({
        key: "persistent-false",
        default: { x: 1 },
        stateDirectory: testDir,
      });

      // Write a file then make it unreadable to cause failure
      fs.writeFileSync(tracker.getFilePath(), "some data", "utf-8");
      fs.chmodSync(tracker.getFilePath(), 0o000);

      await tracker.loadAsync();
      expect(tracker.isPersistent).toBe(false);

      // Restore permissions for cleanup
      fs.chmodSync(tracker.getFilePath(), 0o644);
    });
  });

  describe("auto-save with autoSaveMs", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("set() triggers debounced save", async () => {
      const tracker = new StateTracker({
        key: "auto-save-set",
        default: { count: 0 },
        stateDirectory: testDir,
        autoSaveMs: 500,
      });
      await tracker.loadAsync();

      tracker.set({ count: 42 });

      // File should not exist yet (debounce pending)
      const filePath = tracker.getFilePath();
      expect(fs.existsSync(filePath)).toBe(false);

      // Advance timers past the debounce and flush async saveAsync
      await vi.advanceTimersByTimeAsync(600);

      // Now the file should exist with the saved state
      expect(fs.existsSync(filePath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<
        string,
        unknown
      >;
      expect(content.value).toEqual({ count: 42 });
    });

    it("multiple rapid set() calls only trigger one save", async () => {
      const tracker = new StateTracker({
        key: "auto-save-debounce",
        default: { count: 0 },
        stateDirectory: testDir,
        autoSaveMs: 500,
      });
      await tracker.loadAsync();

      tracker.set({ count: 1 });

      // Advance time a little, but not past the debounce
      await vi.advanceTimersByTimeAsync(100);
      expect(fs.existsSync(tracker.getFilePath())).toBe(false);

      tracker.set({ count: 2 });
      await vi.advanceTimersByTimeAsync(100);
      expect(fs.existsSync(tracker.getFilePath())).toBe(false);

      tracker.set({ count: 3 });
      await vi.advanceTimersByTimeAsync(600);

      // Only the final value should be saved
      expect(fs.existsSync(tracker.getFilePath())).toBe(true);
      const content = JSON.parse(
        fs.readFileSync(tracker.getFilePath(), "utf-8")
      ) as Record<string, unknown>;
      expect(content.value).toEqual({ count: 3 });

      // Verify the final saved value
      expect(tracker.state).toEqual({ count: 3 });
    });

    it("cancelPendingSave works via save()", async () => {
      const tracker = new StateTracker({
        key: "cancel-pending",
        default: { count: 0 },
        stateDirectory: testDir,
        autoSaveMs: 1000,
      });
      await tracker.loadAsync();

      // Trigger auto-save via set
      tracker.set({ count: 10 });

      // Calling save() should cancel pending auto-save and write immediately
      tracker.save({ count: 20 });

      // Advance past the original debounce time
      await vi.advanceTimersByTimeAsync(1500);

      // The value on disk should be 20 (from save()), not 10 (from auto-save)
      const content = JSON.parse(
        fs.readFileSync(tracker.getFilePath(), "utf-8")
      ) as Record<string, unknown>;
      expect(content.value).toEqual({ count: 20 });
    });
  });

  describe("onEvent callback", () => {
    it("events emitted on loadAsync and saveAsync", async () => {
      const events: StateTrackerEvent[] = [];
      const tracker = new StateTracker({
        key: "events-test",
        default: { x: 1 },
        stateDirectory: testDir,
        onEvent: (event) => events.push(event),
      });

      await tracker.loadAsync();

      // Should have emitted an info event for "No existing state file"
      expect(events.length).toBeGreaterThanOrEqual(1);
      const loadEvent = events.find((e) => e.message.includes("state"));
      expect(loadEvent).toBeDefined();
      expect(loadEvent!.level).toBe("info");

      // Now save and check for debug event
      tracker.set({ x: 2 });
      await tracker.saveAsync();

      const saveEvent = events.find((e) => e.message.includes("Saved"));
      expect(saveEvent).toBeDefined();
      expect(saveEvent!.level).toBe("debug");
    });

    it("events emitted on errors", async () => {
      const events: StateTrackerEvent[] = [];
      const tracker = new StateTracker({
        key: "events-error",
        default: { x: 1 },
        stateDirectory: testDir,
        onEvent: (event) => events.push(event),
      });

      // Write file then make it unreadable to trigger error
      fs.writeFileSync(tracker.getFilePath(), "some data", "utf-8");
      fs.chmodSync(tracker.getFilePath(), 0o000);

      await tracker.loadAsync();

      const warnEvent = events.find((e) => e.level === "warn");
      expect(warnEvent).toBeDefined();
      expect(warnEvent!.message).toContain("unavailable");

      // Restore permissions for cleanup
      fs.chmodSync(tracker.getFilePath(), 0o644);
    });

    it("no errors when onEvent is omitted", async () => {
      const tracker = new StateTracker({
        key: "no-events",
        default: { x: 1 },
        stateDirectory: testDir,
      });

      // This should not throw even though there's no onEvent
      await tracker.loadAsync();
      tracker.set({ x: 2 });
      await tracker.saveAsync();
    });
  });

  describe("PersistentStore migration", () => {
    it("loads raw JSON object (no envelope) and merges with defaults", async () => {
      const tracker = new StateTracker({
        key: "migration",
        default: { count: 0, name: "default", extra: true },
        stateDirectory: testDir,
      });

      // Write raw PersistentStore format (no { value, lastUpdated } envelope)
      fs.writeFileSync(
        tracker.getFilePath(),
        JSON.stringify({ count: 42, name: "migrated" }),
        "utf-8"
      );

      await tracker.loadAsync();

      // Should merge with defaults: extra comes from default, count/name from file
      expect(tracker.state).toEqual({
        count: 42,
        name: "migrated",
        extra: true,
      });
    });

    it("after saveAsync, file contains envelope format", async () => {
      const tracker = new StateTracker({
        key: "migration-save",
        default: { count: 0, name: "default" },
        stateDirectory: testDir,
      });

      // Write raw PersistentStore format
      fs.writeFileSync(
        tracker.getFilePath(),
        JSON.stringify({ count: 99, name: "old" }),
        "utf-8"
      );

      await tracker.loadAsync();
      await tracker.saveAsync();

      // File should now be in v2 envelope format
      const content = JSON.parse(
        fs.readFileSync(tracker.getFilePath(), "utf-8")
      ) as Record<string, unknown>;
      expect(content.value).toEqual({ count: 99, name: "old" });
      expect(content.lastUpdated).toBeDefined();
    });
  });
});
