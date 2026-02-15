import { describe, it, expect, vi } from "vitest";
import { createPriorityQueue } from "../src/PriorityQueue";

describe("PriorityQueue", () => {
  describe("enqueue and dequeue", () => {
    it("dequeues items in FIFO order within the same priority", () => {
      const queue = createPriorityQueue<string>();
      queue.enqueue("first", "medium");
      queue.enqueue("second", "medium");
      queue.enqueue("third", "medium");

      expect(queue.dequeue()?.data).toBe("first");
      expect(queue.dequeue()?.data).toBe("second");
      expect(queue.dequeue()?.data).toBe("third");
      expect(queue.dequeue()).toBeUndefined();
    });

    it("dequeues high priority before medium and low", () => {
      const queue = createPriorityQueue<string>();
      queue.enqueue("low-1", "low");
      queue.enqueue("medium-1", "medium");
      queue.enqueue("high-1", "high");
      queue.enqueue("low-2", "low");
      queue.enqueue("high-2", "high");

      expect(queue.dequeue()?.data).toBe("high-1");
      expect(queue.dequeue()?.data).toBe("high-2");
      expect(queue.dequeue()?.data).toBe("medium-1");
      expect(queue.dequeue()?.data).toBe("low-1");
      expect(queue.dequeue()?.data).toBe("low-2");
    });

    it("defaults to medium priority", () => {
      const queue = createPriorityQueue<string>();
      queue.enqueue("low", "low");
      queue.enqueue("default");
      queue.enqueue("high", "high");

      expect(queue.dequeue()?.data).toBe("high");
      expect(queue.dequeue()?.data).toBe("default");
      expect(queue.dequeue()?.data).toBe("low");
    });

    it("returns item metadata on enqueue", () => {
      const queue = createPriorityQueue<string>();
      const item = queue.enqueue("test", "high");

      expect(item.data).toBe("test");
      expect(item.priority).toBe("high");
      expect(item.id).toMatch(/^q_\d+$/);
      expect(typeof item.enqueuedAt).toBe("number");
    });

    it("assigns unique IDs to each item", () => {
      const queue = createPriorityQueue<string>();
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(queue.enqueue(`item-${i}`).id);
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("peek", () => {
    it("returns the next item without removing it", () => {
      const queue = createPriorityQueue<string>();
      queue.enqueue("first");

      expect(queue.peek()?.data).toBe("first");
      expect(queue.peek()?.data).toBe("first");
      expect(queue.size).toBe(1);
    });

    it("returns undefined for empty queue", () => {
      const queue = createPriorityQueue<string>();
      expect(queue.peek()).toBeUndefined();
    });

    it("peeks the highest priority item", () => {
      const queue = createPriorityQueue<string>();
      queue.enqueue("low", "low");
      queue.enqueue("high", "high");

      expect(queue.peek()?.data).toBe("high");
    });
  });

  describe("remove", () => {
    it("removes an item by ID", () => {
      const queue = createPriorityQueue<string>();
      const item = queue.enqueue("to-remove");
      queue.enqueue("to-keep");

      expect(queue.remove(item.id)).toBe(true);
      expect(queue.size).toBe(1);
      expect(queue.dequeue()?.data).toBe("to-keep");
    });

    it("returns false for non-existent ID", () => {
      const queue = createPriorityQueue<string>();
      queue.enqueue("item");

      expect(queue.remove("nonexistent")).toBe(false);
      expect(queue.size).toBe(1);
    });

    it("removes from correct priority bucket", () => {
      const queue = createPriorityQueue<string>();
      const high = queue.enqueue("high", "high");
      queue.enqueue("medium", "medium");
      const low = queue.enqueue("low", "low");

      queue.remove(high.id);
      queue.remove(low.id);

      expect(queue.size).toBe(1);
      expect(queue.dequeue()?.data).toBe("medium");
    });
  });

  describe("size and isEmpty", () => {
    it("reports correct size", () => {
      const queue = createPriorityQueue<string>();
      expect(queue.size).toBe(0);
      expect(queue.isEmpty).toBe(true);

      queue.enqueue("a");
      expect(queue.size).toBe(1);
      expect(queue.isEmpty).toBe(false);

      queue.enqueue("b");
      expect(queue.size).toBe(2);

      queue.dequeue();
      expect(queue.size).toBe(1);

      queue.dequeue();
      expect(queue.size).toBe(0);
      expect(queue.isEmpty).toBe(true);
    });

    it("counts across all priority levels", () => {
      const queue = createPriorityQueue<string>();
      queue.enqueue("h", "high");
      queue.enqueue("m", "medium");
      queue.enqueue("l", "low");

      expect(queue.size).toBe(3);
    });
  });

  describe("onEnqueue", () => {
    it("notifies listeners when items are enqueued", () => {
      const queue = createPriorityQueue<string>();
      const callback = vi.fn();
      queue.onEnqueue(callback);

      const item = queue.enqueue("test", "high");

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith(item);
    });

    it("returns unsubscribe function", () => {
      const queue = createPriorityQueue<string>();
      const callback = vi.fn();
      const unsub = queue.onEnqueue(callback);

      queue.enqueue("first");
      expect(callback).toHaveBeenCalledOnce();

      unsub();
      queue.enqueue("second");
      expect(callback).toHaveBeenCalledOnce();
    });

    it("supports multiple listeners", () => {
      const queue = createPriorityQueue<string>();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      queue.onEnqueue(cb1);
      queue.onEnqueue(cb2);

      queue.enqueue("test");

      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
    });
  });

  describe("toArray", () => {
    it("returns items in dequeue order", () => {
      const queue = createPriorityQueue<string>();
      queue.enqueue("low-1", "low");
      queue.enqueue("high-1", "high");
      queue.enqueue("medium-1", "medium");
      queue.enqueue("high-2", "high");

      const items = queue.toArray().map((i) => i.data);
      expect(items).toEqual(["high-1", "high-2", "medium-1", "low-1"]);
    });

    it("returns empty array for empty queue", () => {
      const queue = createPriorityQueue<string>();
      expect(queue.toArray()).toEqual([]);
    });

    it("does not modify the queue", () => {
      const queue = createPriorityQueue<string>();
      queue.enqueue("a");
      queue.enqueue("b");

      queue.toArray();
      expect(queue.size).toBe(2);
    });
  });

  describe("clear", () => {
    it("removes all items", () => {
      const queue = createPriorityQueue<string>();
      queue.enqueue("a", "high");
      queue.enqueue("b", "medium");
      queue.enqueue("c", "low");

      queue.clear();

      expect(queue.size).toBe(0);
      expect(queue.isEmpty).toBe(true);
      expect(queue.dequeue()).toBeUndefined();
    });
  });

  describe("dequeue from empty queue", () => {
    it("returns undefined", () => {
      const queue = createPriorityQueue<string>();
      expect(queue.dequeue()).toBeUndefined();
    });
  });
});
