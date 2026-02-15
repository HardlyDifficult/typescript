import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { WorkflowEngine } from "../src/WorkflowEngine.js";
import type {
  TransitionEvent,
  TransitionMap,
  WorkflowSnapshot,
} from "../src/types.js";

// --- Test helpers ---

type Status = "idle" | "running" | "paused" | "completed" | "failed";
interface Data {
  count: number;
  message: string;
}

const transitions: TransitionMap<Status> = {
  idle: ["running", "failed"],
  running: ["paused", "completed", "failed"],
  paused: ["running", "failed"],
  completed: [],
  failed: [],
};

const defaultData: Data = { count: 0, message: "" };

let testDir: string;

function createEngine(
  overrides: {
    key?: string;
    initialStatus?: Status;
    initialData?: Data;
    onTransition?: (event: TransitionEvent<Status, Data>) => void;
  } = {}
): WorkflowEngine<Status, Data> {
  return new WorkflowEngine<Status, Data>({
    key: overrides.key ?? "test-workflow",
    initialStatus: overrides.initialStatus ?? "idle",
    initialData: overrides.initialData ?? { ...defaultData },
    transitions,
    stateDirectory: testDir,
    autoSaveMs: 0,
    onTransition: overrides.onTransition,
  });
}

// --- Tests ---

describe("WorkflowEngine", () => {
  beforeEach(() => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-engine-test-"));
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("validates that initialStatus is in the transitions map", () => {
      expect(
        () =>
          new WorkflowEngine({
            key: "test",
            initialStatus: "nonexistent" as Status,
            initialData: defaultData,
            transitions,
            stateDirectory: testDir,
          })
      ).toThrow(
        'initialStatus "nonexistent" is not a key in the transitions map'
      );
    });

    it("accepts a valid initialStatus", () => {
      const engine = createEngine();
      expect(engine.status).toBe("idle");
    });
  });

  describe("load", () => {
    it("uses defaults when no state file exists", async () => {
      const engine = createEngine();
      await engine.load();
      expect(engine.status).toBe("idle");
      expect(engine.data).toEqual(defaultData);
      expect(engine.isLoaded).toBe(true);
    });

    it("restores persisted state from file", async () => {
      // First instance: transition and save
      const engine1 = createEngine();
      await engine1.load();
      await engine1.transition("running", (d) => {
        d.count = 42;
        d.message = "hello";
      });

      // Second instance: should restore
      const engine2 = createEngine();
      await engine2.load();
      expect(engine2.status).toBe("running");
      expect(engine2.data.count).toBe(42);
      expect(engine2.data.message).toBe("hello");
    });

    it("is idempotent (second call is a no-op)", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("running");

      // Call load again — should NOT reset to defaults
      await engine.load();
      expect(engine.status).toBe("running");
    });
  });

  describe("transition", () => {
    it("transitions to an allowed status", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("running");
      expect(engine.status).toBe("running");
    });

    it("updates data via updater during transition", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("running", (d) => {
        d.count = 10;
        d.message = "started";
      });
      expect(engine.data.count).toBe(10);
      expect(engine.data.message).toBe("started");
    });

    it("works without an updater (status-only change)", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("running");
      expect(engine.status).toBe("running");
      expect(engine.data).toEqual(defaultData);
    });

    it("persists immediately after successful transition", async () => {
      const engine1 = createEngine();
      await engine1.load();
      await engine1.transition("running", (d) => {
        d.count = 99;
      });

      // Verify by loading a new instance
      const engine2 = createEngine();
      await engine2.load();
      expect(engine2.status).toBe("running");
      expect(engine2.data.count).toBe(99);
    });

    it("throws for disallowed transition with helpful message", async () => {
      const engine = createEngine();
      await engine.load();
      await expect(engine.transition("completed")).rejects.toThrow(
        'Cannot transition from "idle" to "completed". Allowed: [running, failed]'
      );
    });

    it("throws when transitioning from terminal status", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("running");
      await engine.transition("completed");
      await expect(engine.transition("idle" as Status)).rejects.toThrow(
        'Cannot transition from terminal status "completed"'
      );
    });

    it("does not persist if updater throws", async () => {
      const engine1 = createEngine();
      await engine1.load();

      await expect(
        engine1.transition("running", () => {
          throw new Error("updater failed");
        })
      ).rejects.toThrow("updater failed");

      // Status should not have changed
      expect(engine1.status).toBe("idle");

      // Verify file was not written
      const engine2 = createEngine();
      await engine2.load();
      expect(engine2.status).toBe("idle");
    });

    it("does not change status if updater throws", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("running", (d) => {
        d.count = 5;
      });

      await expect(
        engine.transition("paused", () => {
          throw new Error("nope");
        })
      ).rejects.toThrow("nope");

      expect(engine.status).toBe("running");
      expect(engine.data.count).toBe(5);
    });

    it("supports multi-step transitions", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("running");
      await engine.transition("paused");
      await engine.transition("running");
      await engine.transition("completed");
      expect(engine.status).toBe("completed");
      expect(engine.isTerminal).toBe(true);
    });
  });

  describe("update", () => {
    it("mutates data without changing status", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("running");
      await engine.update((d) => {
        d.count = 100;
      });
      expect(engine.status).toBe("running");
      expect(engine.data.count).toBe(100);
    });

    it("persists immediately after update", async () => {
      const engine1 = createEngine();
      await engine1.load();
      await engine1.update((d) => {
        d.message = "updated";
      });

      const engine2 = createEngine();
      await engine2.load();
      expect(engine2.data.message).toBe("updated");
    });

    it("does not persist if updater throws", async () => {
      const engine1 = createEngine();
      await engine1.load();
      await engine1.update((d) => {
        d.count = 50;
      });

      await expect(
        engine1.update(() => {
          throw new Error("update failed");
        })
      ).rejects.toThrow("update failed");

      // Original value should remain
      expect(engine1.data.count).toBe(50);

      const engine2 = createEngine();
      await engine2.load();
      expect(engine2.data.count).toBe(50);
    });
  });

  describe("canTransition / allowedTransitions", () => {
    it("returns true for allowed transitions", async () => {
      const engine = createEngine();
      await engine.load();
      expect(engine.canTransition("running")).toBe(true);
      expect(engine.canTransition("failed")).toBe(true);
    });

    it("returns false for disallowed transitions", async () => {
      const engine = createEngine();
      await engine.load();
      expect(engine.canTransition("completed")).toBe(false);
      expect(engine.canTransition("paused")).toBe(false);
    });

    it("returns false for all transitions from terminal status", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("failed");
      expect(engine.canTransition("idle")).toBe(false);
      expect(engine.canTransition("running")).toBe(false);
    });

    it("allowedTransitions returns the correct list", async () => {
      const engine = createEngine();
      await engine.load();
      expect(engine.allowedTransitions()).toEqual(["running", "failed"]);
    });

    it("allowedTransitions returns empty array for terminal status", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("running");
      await engine.transition("completed");
      expect(engine.allowedTransitions()).toEqual([]);
    });
  });

  describe("isTerminal", () => {
    it("returns false for non-terminal status", async () => {
      const engine = createEngine();
      await engine.load();
      expect(engine.isTerminal).toBe(false);
    });

    it("returns true for completed", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("running");
      await engine.transition("completed");
      expect(engine.isTerminal).toBe(true);
    });

    it("returns true for failed", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("failed");
      expect(engine.isTerminal).toBe(true);
    });
  });

  describe("persistence", () => {
    it("state survives across instances", async () => {
      const engine1 = createEngine();
      await engine1.load();
      await engine1.transition("running", (d) => {
        d.count = 7;
        d.message = "persisted";
      });
      await engine1.transition("paused");

      // New instance with same key
      const engine2 = createEngine();
      await engine2.load();
      expect(engine2.status).toBe("paused");
      expect(engine2.data.count).toBe(7);
      expect(engine2.data.message).toBe("persisted");
    });

    it("isPersistent returns true when storage works", async () => {
      const engine = createEngine();
      await engine.load();
      expect(engine.isPersistent).toBe(true);
    });

    it("save() force-persists current state", async () => {
      const engine1 = createEngine();
      await engine1.load();
      await engine1.transition("running");
      await engine1.save();

      const engine2 = createEngine();
      await engine2.load();
      expect(engine2.status).toBe("running");
    });
  });

  describe("events", () => {
    it("emits transition event with from/to", async () => {
      const events: TransitionEvent<Status, Data>[] = [];
      const engine = createEngine({ onTransition: (e) => events.push(e) });
      await engine.load();
      await engine.transition("running");

      const event = events.find((e) => e.type === "transition");
      expect(event).toBeDefined();
      expect(event!.from).toBe("idle");
      expect(event!.to).toBe("running");
      expect(event!.status).toBe("running");
      expect(event!.timestamp).toBeTruthy();
    });

    it("emits update event with current status", async () => {
      const events: TransitionEvent<Status, Data>[] = [];
      const engine = createEngine({ onTransition: (e) => events.push(e) });
      await engine.load();
      await engine.transition("running");
      await engine.update((d) => {
        d.count = 1;
      });

      const updateEvents = events.filter((e) => e.type === "update");
      expect(updateEvents).toHaveLength(1);
      expect(updateEvents[0]!.status).toBe("running");
    });

    it("emits load event on load", async () => {
      const events: TransitionEvent<Status, Data>[] = [];
      const engine = createEngine({ onTransition: (e) => events.push(e) });
      await engine.load();

      const loadEvents = events.filter((e) => e.type === "load");
      expect(loadEvents).toHaveLength(1);
      expect(loadEvents[0]!.status).toBe("idle");
    });

    it("includes data snapshot in events", async () => {
      const events: TransitionEvent<Status, Data>[] = [];
      const engine = createEngine({ onTransition: (e) => events.push(e) });
      await engine.load();
      await engine.transition("running", (d) => {
        d.count = 42;
      });

      const event = events.find((e) => e.type === "transition");
      expect(event!.data.count).toBe(42);
    });

    it("does not emit on failed transition", async () => {
      const events: TransitionEvent<Status, Data>[] = [];
      const engine = createEngine({ onTransition: (e) => events.push(e) });
      await engine.load();

      const beforeCount = events.length;
      await engine.transition("completed").catch(() => {});
      expect(events.length).toBe(beforeCount);
    });
  });

  describe("updatedAt", () => {
    it("is set after load", async () => {
      const engine = createEngine();
      await engine.load();
      expect(engine.updatedAt).toBeTruthy();
      expect(new Date(engine.updatedAt).toISOString()).toBe(engine.updatedAt);
    });

    it("is updated on transition", async () => {
      vi.useFakeTimers();
      const engine = createEngine();
      await engine.load();
      const before = engine.updatedAt;

      await vi.advanceTimersByTimeAsync(100);
      await engine.transition("running");
      expect(engine.updatedAt).not.toBe(before);
      vi.useRealTimers();
    });

    it("is updated on update", async () => {
      vi.useFakeTimers();
      const engine = createEngine();
      await engine.load();
      const before = engine.updatedAt;

      await vi.advanceTimersByTimeAsync(100);
      await engine.update((d) => {
        d.count = 1;
      });
      expect(engine.updatedAt).not.toBe(before);
      vi.useRealTimers();
    });

    it("is persisted and restored", async () => {
      const engine1 = createEngine();
      await engine1.load();
      await engine1.transition("running");
      const savedUpdatedAt = engine1.updatedAt;

      const engine2 = createEngine();
      await engine2.load();
      expect(engine2.updatedAt).toBe(savedUpdatedAt);
    });
  });

  describe("cursor", () => {
    interface Item {
      name: string;
      status: string;
    }
    interface IndexedData {
      items: Item[];
      currentIndex?: number;
      total: number;
    }

    type IndexedStatus = "idle" | "running" | "completed";

    const indexedTransitions: TransitionMap<IndexedStatus> = {
      idle: ["running"],
      running: ["completed"],
      completed: [],
    };

    function createIndexedEngine(
      items: Item[] = [],
      currentIndex?: number,
      key = "cursor-test"
    ): WorkflowEngine<IndexedStatus, IndexedData> {
      return new WorkflowEngine<IndexedStatus, IndexedData>({
        key,
        initialStatus: "idle",
        initialData: { items, currentIndex, total: 0 },
        transitions: indexedTransitions,
        stateDirectory: testDir,
        autoSaveMs: 0,
      });
    }

    it("get() returns the selected item", async () => {
      const engine = createIndexedEngine([{ name: "a", status: "pending" }], 0);
      await engine.load();

      const cursor = engine.cursor((d) => d.items[d.currentIndex ?? -1]);

      expect(cursor.get()).toEqual({ name: "a", status: "pending" });
    });

    it("get() throws when selector returns undefined", async () => {
      const engine = createIndexedEngine([], undefined);
      await engine.load();

      const cursor = engine.cursor((d) => d.items[d.currentIndex ?? -1]);

      expect(() => cursor.get()).toThrow("Cursor target not found");
    });

    it("find() returns the selected item or undefined", async () => {
      const engine = createIndexedEngine([{ name: "a", status: "pending" }], 0);
      await engine.load();

      const cursor = engine.cursor((d) => d.items[d.currentIndex ?? -1]);

      expect(cursor.find()).toEqual({ name: "a", status: "pending" });
    });

    it("find() returns undefined when selector misses", async () => {
      const engine = createIndexedEngine([], undefined);
      await engine.load();

      const cursor = engine.cursor((d) => d.items[d.currentIndex ?? -1]);

      expect(cursor.find()).toBeUndefined();
    });

    it("update() mutates the selected item and persists", async () => {
      const engine = createIndexedEngine([{ name: "a", status: "pending" }], 0);
      await engine.load();

      const cursor = engine.cursor((d) => d.items[d.currentIndex ?? -1]);

      await cursor.update((item) => {
        item.status = "done";
      });

      expect(engine.data.items[0]!.status).toBe("done");

      // Verify persistence
      const engine2 = createIndexedEngine();
      await engine2.load();
      expect(engine2.data.items[0]!.status).toBe("done");
    });

    it("update() receives both item and parent data", async () => {
      const engine = createIndexedEngine([{ name: "a", status: "pending" }], 0);
      await engine.load();

      const cursor = engine.cursor((d) => d.items[d.currentIndex ?? -1]);

      await cursor.update((item, data) => {
        item.status = "done";
        data.total += 1;
      });

      expect(engine.data.items[0]!.status).toBe("done");
      expect(engine.data.total).toBe(1);
    });

    it("update() is a no-op when selector returns undefined", async () => {
      const engine = createIndexedEngine(
        [{ name: "a", status: "pending" }],
        undefined
      );
      await engine.load();

      const cursor = engine.cursor((d) => d.items[d.currentIndex ?? -1]);

      await cursor.update((item) => {
        item.status = "should-not-happen";
      });

      // Item should NOT have been mutated
      expect(engine.data.items[0]!.status).toBe("pending");
    });

    it("reflects latest data after engine updates", async () => {
      const engine = createIndexedEngine(
        [
          { name: "a", status: "pending" },
          { name: "b", status: "pending" },
        ],
        0
      );
      await engine.load();

      const cursor = engine.cursor((d) => d.items[d.currentIndex ?? -1]);

      expect(cursor.get().name).toBe("a");

      // Change the current index
      await engine.update((d) => {
        d.currentIndex = 1;
      });

      expect(cursor.get().name).toBe("b");
    });
  });

  describe("error messages", () => {
    it("includes current status in disallowed transition error", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("running");
      try {
        await engine.transition("idle" as Status);
      } catch (err) {
        expect((err as Error).message).toContain('"running"');
      }
    });

    it("includes attempted status in disallowed transition error", async () => {
      const engine = createEngine();
      await engine.load();
      try {
        await engine.transition("completed");
      } catch (err) {
        expect((err as Error).message).toContain('"completed"');
      }
    });

    it("includes allowed transitions in error", async () => {
      const engine = createEngine();
      await engine.load();
      try {
        await engine.transition("completed");
      } catch (err) {
        expect((err as Error).message).toContain("running, failed");
      }
    });
  });

  describe("on() multi-listener", () => {
    it("delivers events to multiple listeners", async () => {
      const engine = createEngine();
      await engine.load();

      const events1: TransitionEvent<Status, Data>[] = [];
      const events2: TransitionEvent<Status, Data>[] = [];
      engine.on((e) => events1.push(e));
      engine.on((e) => events2.push(e));

      await engine.transition("running");

      expect(events1).toHaveLength(1);
      expect(events2).toHaveLength(1);
      expect(events1[0]!.type).toBe("transition");
      expect(events2[0]!.type).toBe("transition");
    });

    it("unsubscribe stops delivery", async () => {
      const engine = createEngine();
      await engine.load();

      const events: TransitionEvent<Status, Data>[] = [];
      const unsub = engine.on((e) => events.push(e));

      await engine.transition("running");
      expect(events).toHaveLength(1);

      unsub();

      await engine.update((d) => {
        d.count = 1;
      });
      expect(events).toHaveLength(1); // no new events
    });

    it("works alongside onTransition option", async () => {
      const optionEvents: TransitionEvent<Status, Data>[] = [];
      const listenerEvents: TransitionEvent<Status, Data>[] = [];

      const engine = createEngine({
        onTransition: (e) => optionEvents.push(e),
      });
      engine.on((e) => listenerEvents.push(e));
      await engine.load();

      await engine.transition("running");

      // Both receive the load + transition events
      expect(optionEvents).toHaveLength(2);
      expect(listenerEvents).toHaveLength(2);
    });

    it("listener added after load receives subsequent events", async () => {
      const engine = createEngine();
      await engine.load();

      const events: TransitionEvent<Status, Data>[] = [];
      engine.on((e) => events.push(e));

      await engine.transition("running");
      await engine.update((d) => {
        d.count = 5;
      });

      expect(events).toHaveLength(2);
      expect(events[0]!.type).toBe("transition");
      expect(events[1]!.type).toBe("update");
    });
  });

  describe("toSnapshot", () => {
    it("returns correct shape", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("running", (d) => {
        d.count = 42;
        d.message = "hello";
      });

      const snap: WorkflowSnapshot<Status, Data> = engine.toSnapshot();

      expect(snap.status).toBe("running");
      expect(snap.data.count).toBe(42);
      expect(snap.data.message).toBe("hello");
      expect(snap.updatedAt).toBe(engine.updatedAt);
      expect(snap.isTerminal).toBe(false);
    });

    it("data is a deep copy", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("running", (d) => {
        d.count = 1;
      });

      const snap = engine.toSnapshot();

      // Mutating the snapshot should not affect the engine
      (snap.data as Data).count = 999;
      expect(engine.data.count).toBe(1);
    });

    it("reflects terminal status", async () => {
      const engine = createEngine();
      await engine.load();
      await engine.transition("running");
      await engine.transition("completed");

      const snap = engine.toSnapshot();
      expect(snap.isTerminal).toBe(true);
    });

    it("reflects latest state after transitions", async () => {
      vi.useFakeTimers();
      const engine = createEngine();
      await engine.load();

      const snap1 = engine.toSnapshot();
      expect(snap1.status).toBe("idle");

      await vi.advanceTimersByTimeAsync(100);
      await engine.transition("running", (d) => {
        d.count = 10;
      });

      const snap2 = engine.toSnapshot();
      expect(snap2.status).toBe("running");
      expect(snap2.data.count).toBe(10);
      expect(snap2.updatedAt).not.toBe(snap1.updatedAt);
      vi.useRealTimers();
    });
  });
});
