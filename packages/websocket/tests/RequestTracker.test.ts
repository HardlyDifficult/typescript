import { describe, it, expect, vi } from "vitest";
import { RequestTracker } from "../src/RequestTracker.js";

describe("RequestTracker", () => {
  it("tryAccept() returns true when not draining", () => {
    const tracker = new RequestTracker();
    expect(tracker.tryAccept()).toBe(true);
    expect(tracker.active).toBe(1);
  });

  it("tryAccept() returns false when draining", () => {
    const tracker = new RequestTracker();
    tracker.startDraining("test");
    expect(tracker.tryAccept()).toBe(false);
    expect(tracker.active).toBe(0);
  });

  it("complete() decrements active count", () => {
    const tracker = new RequestTracker();
    tracker.tryAccept();
    tracker.tryAccept();
    tracker.complete();
    expect(tracker.active).toBe(1);
  });

  it("startDraining emits draining then drained immediately when active=0", () => {
    const tracker = new RequestTracker();
    const order: string[] = [];
    tracker.on("draining", () => order.push("draining"));
    tracker.on("drained", () => order.push("drained"));

    tracker.startDraining("no work");

    expect(order).toEqual(["draining", "drained"]);
  });

  it("startDraining with active requests defers drained until last complete", () => {
    const tracker = new RequestTracker();
    const draining = vi.fn();
    const drained = vi.fn();
    tracker.on("draining", draining);
    tracker.on("drained", drained);

    tracker.tryAccept();
    tracker.startDraining("waiting");

    expect(draining).toHaveBeenCalledOnce();
    expect(drained).not.toHaveBeenCalled();

    tracker.complete();

    expect(drained).toHaveBeenCalledOnce();
  });

  it("startDraining() is idempotent — draining event only emits once", () => {
    const tracker = new RequestTracker();
    const draining = vi.fn();
    tracker.on("draining", draining);

    tracker.startDraining("first");
    tracker.startDraining("second");

    expect(draining).toHaveBeenCalledOnce();
    expect(draining).toHaveBeenCalledWith("first");
  });

  it("on() returns a working unsubscribe function", () => {
    const tracker = new RequestTracker();
    const listener = vi.fn();
    const unsubscribe = tracker.on("drained", listener);

    unsubscribe();
    tracker.startDraining("gone");

    expect(listener).not.toHaveBeenCalled();
  });
});
