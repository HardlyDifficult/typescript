/**
 * Extra tests to cover remaining branches in PriorityQueue.
 * - Line 280: changePriority returns false when item not found
 * - Lines 310-313: moveToEnd returns true when already at end, returns false when not found
 */
import { describe, expect, it } from "vitest";

import { createPriorityQueue } from "../src/PriorityQueue.js";

describe("PriorityQueue - changePriority not found (line 280)", () => {
  it("returns false when item id does not exist", () => {
    const queue = createPriorityQueue<string>();
    queue.enqueue("a", "medium");
    expect(queue.updatePriority("nonexistent-id", "high")).toBe(false);
  });
});

describe("PriorityQueue - moveToEnd edge cases (lines 310-313)", () => {
  it("returns true when item is already at end of its bucket (line 310)", () => {
    const queue = createPriorityQueue<string>();
    queue.enqueue("a", "medium");
    queue.enqueue("b", "medium");
    const bId = queue.toArray()[1]!.id; // 'b' is last
    expect(queue.moveToEnd(bId)).toBe(true);
    // Still at end
    expect(queue.toArray()[1]!.data).toBe("b");
  });

  it("returns false when item id does not exist (line 313)", () => {
    const queue = createPriorityQueue<string>();
    queue.enqueue("a", "medium");
    expect(queue.moveToEnd("nonexistent-id")).toBe(false);
  });
});
