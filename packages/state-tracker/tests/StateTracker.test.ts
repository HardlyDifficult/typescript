import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  createFileStorage,
  defineStateMigration,
  StateTracker,
  type StateTrackerEvent,
  type StateStorage,
  type StorageAdapter,
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
    it("should create state directory when loadAsync is called", async () => {
      const stateDir = path.join(testDir, "nested", "state");
      expect(fs.existsSync(stateDir)).toBe(false);

      const tracker = new StateTracker({
        key: "test",
        default: 0,
        stateDirectory: stateDir,
      });
      await tracker.loadAsync();

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

  describe("loadAsync / saveAsync", () => {
    it("returns default value when no state file exists", async () => {
      const tracker = new StateTracker({
        key: "test",
        default: 42,
        stateDirectory: testDir,
      });
      await tracker.loadAsync();
      expect(tracker.state).toBe(42);
    });

    it("loads and returns saved numeric value", async () => {
      const tracker = new StateTracker({
        key: "test",
        default: 0,
        stateDirectory: testDir,
      });
      await tracker.loadAsync();
      tracker.set(100);
      await tracker.saveAsync();

      const tracker2 = new StateTracker({
        key: "test",
        default: 0,
        stateDirectory: testDir,
      });
      await tracker2.loadAsync();
      expect(tracker2.state).toBe(100);
    });

    it("stores value in JSON envelope format", async () => {
      const tracker = new StateTracker({
        key: "test",
        default: 0,
        stateDirectory: testDir,
      });
      await tracker.loadAsync();
      tracker.set(200);
      await tracker.saveAsync();

      const filePath = tracker.getFilePath();
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8")) as Record<
        string,
        unknown
      >;
      expect(content.value).toBe(200);
      expect(content.lastUpdated).toBeDefined();
    });

    it("returns default for corrupted JSON", async () => {
      const tracker = new StateTracker({
        key: "test",
        default: 999,
        stateDirectory: testDir,
      });
      const filePath = tracker.getFilePath();
      fs.writeFileSync(filePath, "not valid json{{{", "utf-8");

      await tracker.loadAsync();
      expect(tracker.state).toBe(999);
    });

    it("returns default when value property is missing", async () => {
      const tracker = new StateTracker({
        key: "test",
        default: 777,
        stateDirectory: testDir,
      });
      const filePath = tracker.getFilePath();
      fs.writeFileSync(filePath, JSON.stringify({ other: "data" }), "utf-8");

      await tracker.loadAsync();
      expect(tracker.state).toBe(777);
    });

    it("overwrites previous value", async () => {
      const tracker = new StateTracker({
        key: "test",
        default: 0,
        stateDirectory: testDir,
      });
      await tracker.loadAsync();
      tracker.set(100);
      await tracker.saveAsync();
      tracker.set(200);
      await tracker.saveAsync();
      tracker.set(300);
      await tracker.saveAsync();

      const tracker2 = new StateTracker({
        key: "test",
        default: 0,
        stateDirectory: testDir,
      });
      await tracker2.loadAsync();
      expect(tracker2.state).toBe(300);
    });

    it("loadAsync returns the loaded state", async () => {
      const tracker = new StateTracker({
        key: "async-load",
        default: { count: 0, name: "default" },
        stateDirectory: testDir,
      });

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
      expect(result).toEqual({ count: 42, name: "loaded" });
      expect(tracker.state).toEqual({ count: 42, name: "loaded" });
    });

    it("loadAsync gracefully degrades on unreadable file", async () => {
      const tracker = new StateTracker({
        key: "fail-read",
        default: { x: 1 },
        stateDirectory: testDir,
      });

      fs.writeFileSync(tracker.getFilePath(), "some data", "utf-8");
      fs.chmodSync(tracker.getFilePath(), 0o000);

      await tracker.loadAsync();
      expect(tracker.isPersistent).toBe(false);
      expect(tracker.state).toEqual({ x: 1 });

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

      fs.writeFileSync(
        tracker.getFilePath(),
        JSON.stringify({
          value: { count: 42, name: "loaded" },
          lastUpdated: new Date().toISOString(),
        }),
        "utf-8"
      );

      await tracker.loadAsync();

      expect(tracker.state).toEqual({
        count: 42,
        name: "loaded",
        extra: true,
      });
    });

    it("loadAsync is idempotent (calling twice is a no-op)", async () => {
      const tracker = new StateTracker({
        key: "idempotent",
        default: { count: 0 },
        stateDirectory: testDir,
      });

      fs.writeFileSync(
        tracker.getFilePath(),
        JSON.stringify({ value: { count: 10 }, lastUpdated: "t1" }),
        "utf-8"
      );

      await tracker.loadAsync();
      expect(tracker.state).toEqual({ count: 10 });

      fs.writeFileSync(
        tracker.getFilePath(),
        JSON.stringify({ value: { count: 99 }, lastUpdated: "t2" }),
        "utf-8"
      );

      await tracker.loadAsync();
      expect(tracker.state).toEqual({ count: 10 });
    });

    it("should not corrupt state if stale temp file exists", async () => {
      const tracker = new StateTracker({
        key: "durable",
        default: 0,
        stateDirectory: testDir,
      });
      await tracker.loadAsync();
      tracker.set(100);
      await tracker.saveAsync();

      const tempFilePath = `${tracker.getFilePath()}.tmp`;
      fs.writeFileSync(
        tempFilePath,
        '{"value": 999, "lastUpdated": "corrupted"}',
        "utf-8"
      );

      const tracker2 = new StateTracker({
        key: "durable",
        default: 0,
        stateDirectory: testDir,
      });
      await tracker2.loadAsync();
      expect(tracker2.state).toBe(100);
    });
  });

  describe("loadAsync with migrations", () => {
    it("returns default when file is missing", async () => {
      const tracker = new StateTracker({
        key: "load-or-default",
        default: { cursor: 0, done: [] as string[] },
        stateDirectory: testDir,
      });

      await tracker.loadAsync();
      expect(tracker.state).toEqual({ cursor: 0, done: [] });
    });

    it("applies typed migration for legacy raw state files", async () => {
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

      await tracker.loadAsync({ migrations: [migration] });
      expect(tracker.state).toEqual({ cursor: 7, done: ["a", "b"] });
    });

    it("applies migrations to envelope value payloads", async () => {
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

      await tracker.loadAsync({ migrations: [migration] });
      expect(tracker.state).toEqual({ cursor: 22 });
    });
  });

  describe("type inference from default", () => {
    it("should infer string type from default", async () => {
      const tracker = new StateTracker({
        key: "string-test",
        default: "default-value",
        stateDirectory: testDir,
      });
      await tracker.loadAsync();
      tracker.set("hello world");
      await tracker.saveAsync();

      const tracker2 = new StateTracker({
        key: "string-test",
        default: "default-value",
        stateDirectory: testDir,
      });
      await tracker2.loadAsync();
      expect(tracker2.state).toBe("hello world");
    });

    it("should infer object type from default", async () => {
      const tracker = new StateTracker({
        key: "object-test",
        default: { count: 0, name: "" },
        stateDirectory: testDir,
      });
      await tracker.loadAsync();
      tracker.set({ count: 10, name: "test" });
      await tracker.saveAsync();

      const tracker2 = new StateTracker({
        key: "object-test",
        default: { count: 0, name: "" },
        stateDirectory: testDir,
      });
      await tracker2.loadAsync();
      expect(tracker2.state).toEqual({ count: 10, name: "test" });
    });

    it("should infer array type from default", async () => {
      const tracker = new StateTracker({
        key: "array-test",
        default: [] as number[],
        stateDirectory: testDir,
      });
      await tracker.loadAsync();
      tracker.set([1, 2, 3, 4, 5]);
      await tracker.saveAsync();

      const tracker2 = new StateTracker({
        key: "array-test",
        default: [] as number[],
        stateDirectory: testDir,
      });
      await tracker2.loadAsync();
      expect(tracker2.state).toEqual([1, 2, 3, 4, 5]);
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
    it("should return correct file path for file-based storage", () => {
      const tracker = new StateTracker({
        key: "my-key",
        default: 0,
        stateDirectory: testDir,
      });
      const filePath = tracker.getFilePath();

      expect(filePath).toBe(path.join(testDir, "my-key.json"));
    });

    it("works with the storage-first file helper", () => {
      const tracker = new StateTracker({
        key: "my-key",
        default: 0,
        storage: createFileStorage({ directory: testDir }),
      });

      expect(tracker.getFilePath()).toBe(path.join(testDir, "my-key.json"));
    });

    it("should throw when using a storageAdapter", () => {
      const adapter: StorageAdapter = {
        read: async () => null,
        write: async () => undefined,
      };
      const tracker = new StateTracker({
        key: "my-key",
        default: 0,
        storageAdapter: adapter,
      });

      expect(() => tracker.getFilePath()).toThrow("file storage");
    });
  });

  describe("open()", () => {
    it("returns a ready-to-use tracker in one call", async () => {
      const filePath = path.join(testDir, "open-test.json");
      fs.writeFileSync(
        filePath,
        JSON.stringify({
          value: { count: 7 },
          lastUpdated: new Date().toISOString(),
        }),
        "utf-8"
      );

      const tracker = await StateTracker.open({
        key: "open-test",
        default: { count: 0 },
        storage: createFileStorage({ directory: testDir }),
      });

      expect(tracker.state).toEqual({ count: 7 });
      expect(tracker.isPersistent).toBe(true);
    });
  });

  describe("persistence across instances", () => {
    it("should persist state across different tracker instances", async () => {
      const tracker1 = new StateTracker({
        key: "shared",
        default: 0,
        stateDirectory: testDir,
      });
      await tracker1.loadAsync();
      tracker1.set(12345);
      await tracker1.saveAsync();

      const tracker2 = new StateTracker({
        key: "shared",
        default: 0,
        stateDirectory: testDir,
      });
      await tracker2.loadAsync();

      expect(tracker2.state).toBe(12345);
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

    it("mutate updates nested state without manual copying", () => {
      const tracker = new StateTracker({
        key: "mutate-test",
        default: { stats: { count: 1 }, tags: ["a"] as string[] },
        stateDirectory: testDir,
      });

      tracker.mutate((draft) => {
        draft.stats.count += 1;
        draft.tags.push("b");
      });

      expect(tracker.state).toEqual({
        stats: { count: 2 },
        tags: ["a", "b"],
      });
    });

    it("mutate does not commit a partial change when the mutator throws", () => {
      const tracker = new StateTracker({
        key: "mutate-rollback",
        default: { count: 1, items: [] as string[] },
        stateDirectory: testDir,
      });

      expect(() =>
        tracker.mutate((draft) => {
          draft.count = 99;
          draft.items.push("broken");
          throw new Error("stop");
        })
      ).toThrow("stop");

      expect(tracker.state).toEqual({ count: 1, items: [] });
    });

    it("mutate throws on primitive state", () => {
      const tracker = new StateTracker({
        key: "mutate-prim",
        default: 42,
        stateDirectory: testDir,
      });

      expect(() => tracker.mutate(() => undefined)).toThrow(
        "mutate() can only be used when state is an object or array"
      );
    });
  });

  describe(".state getter", () => {
    it("returns current in-memory state after loadAsync", async () => {
      const tracker = new StateTracker({
        key: "state-getter",
        default: { val: "init" },
        stateDirectory: testDir,
      });

      expect(tracker.state).toEqual({ val: "init" });

      await tracker.loadAsync();
      tracker.set({ val: "saved" });
      await tracker.saveAsync();

      const tracker2 = new StateTracker({
        key: "state-getter",
        default: { val: "init" },
        stateDirectory: testDir,
      });
      await tracker2.loadAsync();
      expect(tracker2.state).toEqual({ val: "saved" });
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

      fs.writeFileSync(tracker.getFilePath(), "some data", "utf-8");
      fs.chmodSync(tracker.getFilePath(), 0o000);

      await tracker.loadAsync();
      expect(tracker.isPersistent).toBe(false);

      fs.chmodSync(tracker.getFilePath(), 0o644);
    });
  });

  describe("auto-save with autoSaveMs", () => {
    const wait = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));

    it("set() triggers debounced save", async () => {
      const tracker = new StateTracker({
        key: "auto-save-set",
        default: { count: 0 },
        stateDirectory: testDir,
        autoSaveMs: 20,
      });
      await tracker.loadAsync();

      tracker.set({ count: 42 });

      const filePath = tracker.getFilePath();
      expect(fs.existsSync(filePath)).toBe(false);

      await wait(100);

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
        autoSaveMs: 50,
      });
      await tracker.loadAsync();

      tracker.set({ count: 1 });
      await wait(10);
      expect(fs.existsSync(tracker.getFilePath())).toBe(false);

      tracker.set({ count: 2 });
      await wait(10);
      expect(fs.existsSync(tracker.getFilePath())).toBe(false);

      tracker.set({ count: 3 });
      await wait(200);

      expect(fs.existsSync(tracker.getFilePath())).toBe(true);
      const content = JSON.parse(
        fs.readFileSync(tracker.getFilePath(), "utf-8")
      ) as Record<string, unknown>;
      expect(content.value).toEqual({ count: 3 });
      expect(tracker.state).toEqual({ count: 3 });
    });

    it("saveAsync cancels pending auto-save and writes immediately", async () => {
      const tracker = new StateTracker({
        key: "cancel-pending",
        default: { count: 0 },
        stateDirectory: testDir,
        autoSaveMs: 200,
      });
      await tracker.loadAsync();

      tracker.set({ count: 10 });
      tracker.set({ count: 20 });

      await tracker.saveAsync();

      await wait(400);

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

      expect(events.length).toBeGreaterThanOrEqual(1);
      const loadEvent = events.find((e) => e.message.includes("state"));
      expect(loadEvent).toBeDefined();
      expect(loadEvent!.level).toBe("info");

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

      fs.writeFileSync(tracker.getFilePath(), "some data", "utf-8");
      fs.chmodSync(tracker.getFilePath(), 0o000);

      await tracker.loadAsync();

      const warnEvent = events.find((e) => e.level === "warn");
      expect(warnEvent).toBeDefined();
      expect(warnEvent!.message).toContain("unavailable");

      fs.chmodSync(tracker.getFilePath(), 0o644);
    });

    it("no errors when onEvent is omitted", async () => {
      const tracker = new StateTracker({
        key: "no-events",
        default: { x: 1 },
        stateDirectory: testDir,
      });

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

      fs.writeFileSync(
        tracker.getFilePath(),
        JSON.stringify({ count: 42, name: "migrated" }),
        "utf-8"
      );

      await tracker.loadAsync();

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

      fs.writeFileSync(
        tracker.getFilePath(),
        JSON.stringify({ count: 99, name: "old" }),
        "utf-8"
      );

      await tracker.loadAsync();
      await tracker.saveAsync();

      const content = JSON.parse(
        fs.readFileSync(tracker.getFilePath(), "utf-8")
      ) as Record<string, unknown>;
      expect(content.value).toEqual({ count: 99, name: "old" });
      expect(content.lastUpdated).toBeDefined();
    });
  });

  describe("getDefaultStateDirectory (lines 6-10)", () => {
    it("uses STATE_TRACKER_DIR env var when set", async () => {
      const customDir = path.join(testDir, "env-state-dir");
      const originalEnv = process.env.STATE_TRACKER_DIR;

      try {
        process.env.STATE_TRACKER_DIR = customDir;
        // Creating StateTracker without stateDirectory triggers getDefaultStateDirectory()
        const tracker = new StateTracker({
          key: "env-dir-test",
          default: { x: 1 },
          // no stateDirectory - uses env var
        });
        await tracker.loadAsync();
        expect(tracker.isPersistent).toBe(true);
        expect(fs.existsSync(customDir)).toBe(true);
      } finally {
        process.env.STATE_TRACKER_DIR = originalEnv;
      }
    });

    it("uses os.homedir()/.app-state when STATE_TRACKER_DIR is not set", async () => {
      const originalEnv = process.env.STATE_TRACKER_DIR;

      try {
        delete process.env.STATE_TRACKER_DIR;
        // Creates tracker that will use the default directory path
        const tracker = new StateTracker({
          key: "default-dir-test",
          default: { x: 1 },
          // no stateDirectory, no env var - falls to line 10
        });
        // We just verify it doesn't throw and uses a valid path
        // Don't actually call loadAsync (avoids writing to ~/.app-state in tests)
        const filePath = tracker.getFilePath();
        const os = await import("os");
        const path2 = await import("path");
        expect(filePath).toBe(path2.join(os.homedir(), ".app-state", "default-dir-test.json"));
      } finally {
        if (originalEnv !== undefined) {
          process.env.STATE_TRACKER_DIR = originalEnv;
        } else {
          delete process.env.STATE_TRACKER_DIR;
        }
      }
    });

    it("uses STATE_TRACKER_DIR env var when empty string falls through to default", async () => {
      const originalEnv = process.env.STATE_TRACKER_DIR;

      try {
        process.env.STATE_TRACKER_DIR = "";
        // Empty string falls through to line 10 (os.homedir() path)
        const tracker = new StateTracker({
          key: "empty-env-test",
          default: { x: 1 },
        });
        const filePath = tracker.getFilePath();
        const os = await import("os");
        const path2 = await import("path");
        expect(filePath).toBe(path2.join(os.homedir(), ".app-state", "empty-env-test.json"));
      } finally {
        if (originalEnv !== undefined) {
          process.env.STATE_TRACKER_DIR = originalEnv;
        } else {
          delete process.env.STATE_TRACKER_DIR;
        }
      }
    });
  });

  describe("createFileStorage.read() non-ENOENT error (line 64)", () => {
    it("re-throws non-ENOENT errors from file reading", async () => {
      // To trigger a non-ENOENT error, create a directory with the same name as the file
      // Reading a directory as a file gives EISDIR error
      const dirAsFile = path.join(testDir, "is-a-dir.json");
      fs.mkdirSync(dirAsFile); // Create directory where file would be

      const tracker = new StateTracker({
        key: "is-a-dir",
        default: { x: 1 },
        stateDirectory: testDir,
      });

      // The read will fail with EISDIR (not ENOENT), which re-throws and hits line 64
      // StateTracker.loadAsync catches this and sets _storageAvailable = false
      await tracker.loadAsync();
      expect(tracker.isPersistent).toBe(false);
    });
  });

  describe("saveAsync when storage unavailable", () => {
    it("returns current state without writing when storage is unavailable (line 377)", async () => {
      // Use a storage that fails on read so _storageAvailable = false
      const storage: StateStorage = {
        async read() {
          throw new Error("storage unavailable");
        },
        async write() {},
      };

      const tracker = new StateTracker({
        key: "save-unavailable",
        default: { count: 5 },
        storage,
      });

      await tracker.loadAsync();
      expect(tracker.isPersistent).toBe(false);

      tracker.set({ count: 99 });
      const result = await tracker.saveAsync();

      // saveAsync returns current state without calling write
      expect(result).toEqual({ count: 99 });
      expect(tracker.isPersistent).toBe(false);
    });
  });

  describe("envelope value edge cases (line 305-308)", () => {
    it("falls through to mergeWithDefaults when envelope value is null", async () => {
      // To get close to line 306: provide an envelope where "value" key exists but value is null.
      // null !== undefined so goes to line 308 mergeWithDefaults(null)
      // mergeWithDefaults(null): null !== null is false -> returns null as T
      // But for an object default, this returns null cast as T (not merged with defaults)
      const storage: StateStorage = {
        async read() {
          return JSON.stringify({ value: null, lastUpdated: "now" });
        },
        async write() {},
      };

      const tracker = new StateTracker({
        key: "null-envelope",
        default: { x: 42 },
        storage,
      });

      await tracker.loadAsync();
      // envelope.value is null - mergeWithDefaults(null) returns null since null is not an object
      expect(tracker.state).toBeNull();
    });

    it("extracts raw number state from storage (non-envelope number)", async () => {
      // Test reading a raw number stored by a legacy system (not in envelope format)
      // JSON.parse("42") = 42, which is not an object, so:
      // - envelope check fails (not an object)
      // - legacy merge check fails (not an object or default is not an object)
      // - returns structuredClone(defaultValue)
      const storage: StateStorage = {
        async read() {
          return "42";
        },
        async write() {},
      };

      const tracker = new StateTracker({
        key: "raw-number",
        default: 99,
        storage,
      });

      await tracker.loadAsync();
      // Falls to line 324: return structuredClone(defaultValue) = 99
      expect(tracker.state).toBe(99);
    });
  });

  describe("migration failure (lines 271-280)", () => {
    it("returns default value when migration.migrate() throws", async () => {
      const events: StateTrackerEvent[] = [];
      const tracker = new StateTracker({
        key: "migration-fail",
        default: { cursor: 0, done: [] as string[] },
        stateDirectory: testDir,
        onEvent: (e) => events.push(e),
      });

      // Write legacy state that will match the migration
      const fs = await import("fs");
      const path = await import("path");
      fs.writeFileSync(
        path.join(testDir, "migration-fail.json"),
        JSON.stringify({ offset: 7, completedIds: ["a"] }),
        "utf-8"
      );

      const failingMigration = defineStateMigration<
        { cursor: number; done: string[] },
        { offset: number; completedIds: string[] }
      >({
        name: "fail-migration",
        isLegacy(input): input is { offset: number; completedIds: string[] } {
          if (input === null || typeof input !== "object") return false;
          const rec = input as Record<string, unknown>;
          return typeof rec.offset === "number";
        },
        migrate(_legacy) {
          throw new Error("migration failed intentionally");
        },
      });

      await tracker.loadAsync({ migrations: [failingMigration] });

      // Should fall back to default
      expect(tracker.state).toEqual({ cursor: 0, done: [] });

      // Should have emitted a warn event
      const warnEvent = events.find((e) => e.level === "warn" && e.message.includes("migration failed"));
      expect(warnEvent).toBeDefined();
      expect(warnEvent?.context?.["migration"]).toBe("fail-migration");
    });

    it("uses anonymous migration name when name is not provided", async () => {
      const events: StateTrackerEvent[] = [];
      const tracker = new StateTracker({
        key: "migration-anon",
        default: { cursor: 0 },
        stateDirectory: testDir,
        onEvent: (e) => events.push(e),
      });

      const fs = await import("fs");
      const path = await import("path");
      fs.writeFileSync(
        path.join(testDir, "migration-anon.json"),
        JSON.stringify({ offset: 1 }),
        "utf-8"
      );

      const anonMigration = defineStateMigration<
        { cursor: number },
        { offset: number }
      >({
        // no name property
        isLegacy(input): input is { offset: number } {
          if (input === null || typeof input !== "object") return false;
          return typeof (input as Record<string, unknown>).offset === "number";
        },
        migrate(_legacy) {
          throw new Error("anon fail");
        },
      });

      await tracker.loadAsync({ migrations: [anonMigration] });
      expect(tracker.state).toEqual({ cursor: 0 });

      const warnEvent = events.find((e) => e.level === "warn");
      expect(warnEvent?.context?.["migration"]).toBe("anonymous");
    });

    it("returns undefined when no migration matches (line 280)", async () => {
      const tracker = new StateTracker({
        key: "migration-no-match",
        default: { cursor: 0 },
        stateDirectory: testDir,
      });

      const fs = await import("fs");
      const path = await import("path");
      fs.writeFileSync(
        path.join(testDir, "migration-no-match.json"),
        JSON.stringify({ value: { cursor: 5 }, lastUpdated: "now" }),
        "utf-8"
      );

      // Migration that never matches
      const nonMatchingMigration = defineStateMigration<
        { cursor: number },
        never
      >({
        isLegacy(_input): _input is never {
          return false;
        },
        migrate(_legacy: never) {
          return { cursor: 0 };
        },
      });

      await tracker.loadAsync({ migrations: [nonMatchingMigration] });
      // Falls through to envelope extraction
      expect(tracker.state).toEqual({ cursor: 5 });
    });
  });

  describe("StorageAdapter", () => {
    function makeInMemoryAdapter(): StorageAdapter {
      const store = new Map<string, string>();
      return {
        async read(key) {
          return store.get(key) ?? null;
        },
        async write(key, value) {
          store.set(key, value);
        },
      };
    }

    it("uses adapter for read and write instead of disk", async () => {
      const adapter = makeInMemoryAdapter();
      const tracker = new StateTracker({
        key: "adapter-test",
        default: { count: 0 },
        storageAdapter: adapter,
      });

      await tracker.loadAsync();
      expect(tracker.state).toEqual({ count: 0 });
      expect(tracker.isPersistent).toBe(true);

      tracker.set({ count: 42 });
      await tracker.saveAsync();

      const tracker2 = new StateTracker({
        key: "adapter-test",
        default: { count: 0 },
        storageAdapter: adapter,
      });
      await tracker2.loadAsync();
      expect(tracker2.state).toEqual({ count: 42 });
    });

    it("uses sanitized key when calling adapter", async () => {
      const reads: string[] = [];
      const writes: string[] = [];
      const adapter: StorageAdapter = {
        async read(key) {
          reads.push(key);
          return null;
        },
        async write(key, _value) {
          writes.push(key);
        },
      };

      const tracker = new StateTracker({
        key: "my-tracker",
        default: 0,
        storageAdapter: adapter,
      });
      await tracker.loadAsync();
      tracker.set(1);
      await tracker.saveAsync();

      expect(reads).toEqual(["my-tracker"]);
      expect(writes).toEqual(["my-tracker"]);
    });

    it("gracefully degrades when adapter read throws", async () => {
      const adapter: StorageAdapter = {
        async read() {
          throw new Error("Redis connection failed");
        },
        async write() {},
      };

      const tracker = new StateTracker({
        key: "adapter-fail",
        default: { x: 1 },
        storageAdapter: adapter,
      });
      await tracker.loadAsync();

      expect(tracker.isPersistent).toBe(false);
      expect(tracker.state).toEqual({ x: 1 });
    });

    it("emits events for adapter load and save", async () => {
      const events: StateTrackerEvent[] = [];
      const adapter = makeInMemoryAdapter();
      const tracker = new StateTracker({
        key: "adapter-events",
        default: { x: 1 },
        storageAdapter: adapter,
        onEvent: (e) => events.push(e),
      });

      await tracker.loadAsync();
      tracker.set({ x: 2 });
      await tracker.saveAsync();

      const loadEvent = events.find((e) => e.message.includes("defaults"));
      expect(loadEvent).toBeDefined();
      const saveEvent = events.find((e) => e.message.includes("Saved state"));
      expect(saveEvent).toBeDefined();
    });

    it("isPersistent is true with working adapter", async () => {
      const adapter = makeInMemoryAdapter();
      const tracker = new StateTracker({
        key: "persistent-adapter",
        default: 0,
        storageAdapter: adapter,
      });
      await tracker.loadAsync();
      expect(tracker.isPersistent).toBe(true);
    });

    it("supports redis-style storage through the storage option", async () => {
      const redis = new Map<string, string>();
      const storage: StateStorage = {
        async read(key) {
          return redis.get(`state:${key}`) ?? null;
        },
        async write(key, value) {
          redis.set(`state:${key}`, value);
        },
      };

      const tracker = await StateTracker.open({
        key: "redis-test",
        default: { count: 0 },
        storage,
      });

      tracker.mutate((draft) => {
        draft.count = 5;
      });
      await tracker.saveAsync();

      expect(JSON.parse(redis.get("state:redis-test") ?? "{}")).toEqual({
        value: { count: 5 },
        lastUpdated: expect.any(String),
      });
    });

    it("disables persistence after a storage write failure", async () => {
      const storage: StateStorage = {
        async read() {
          return null;
        },
        async write() {
          throw new Error("Redis unavailable");
        },
      };

      const tracker = await StateTracker.open({
        key: "write-failure",
        default: { count: 0 },
        storage,
      });

      tracker.set({ count: 1 });
      await tracker.saveAsync();

      expect(tracker.isPersistent).toBe(false);
    });
  });
});
