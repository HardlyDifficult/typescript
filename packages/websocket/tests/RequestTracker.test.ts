import { describe, it, expect, vi } from "vitest";
import { RequestTracker } from "../src/RequestTracker.js";

describe("RequestTracker", () => {
  it("tryAccept returns true when not draining", () => {
    const tracker = new RequestTracker();
    expect(tracker.tryAccept()).toBe(true);
    expect(tracker.active).toBe(1);
  });

  it("tryAccept returns false when draining", () => {
    const tracker = new RequestTracker();
    tracker.startDraining("test");
    expect(tracker.tryAccept()).toBe(false);
    expect(tracker.active).toBe(0);
  });

  it("complete decrements active count", () => {
    const tracker = new RequestTracker();
    tracker.tryAccept();
    tracker.tryAccept();
    expect(tracker.active).toBe(2);
    tracker.complete();
    expect(tracker.active).toBe(1);
    tracker.complete();
    expect(tracker.active).toBe(0);
  });

  it("emits draining with reason", () => {
    const tracker = new RequestTracker();
    const listener = vi.fn();
    tracker.on("draining", listener);
    tracker.startDraining("shutting down");
    expect(listener).toHaveBeenCalledWith("shutting down");
  });

  it("emits drained immediately if no active requests", () => {
    const tracker = new RequestTracker();
    const drained = vi.fn();
    tracker.on("drained", drained);
    tracker.startDraining("test");
    expect(drained).toHaveBeenCalledOnce();
  });

  it("emits drained when last request completes during drain", () => {
    const tracker = new RequestTracker();
    const drained = vi.fn();
    tracker.on("drained", drained);

    tracker.tryAccept();
    tracker.tryAccept();
    tracker.startDraining("test");
    expect(drained).not.toHaveBeenCalled();

    tracker.complete();
    expect(drained).not.toHaveBeenCalled();

    tracker.complete();
    expect(drained).toHaveBeenCalledOnce();
  });

  it("startDraining is idempotent", () => {
    const tracker = new RequestTracker();
    const draining = vi.fn();
    tracker.on("draining", draining);
    tracker.startDraining("first");
    tracker.startDraining("second");
    expect(draining).toHaveBeenCalledOnce();
  });

  it("on returns working unsubscribe function", () => {
    const tracker = new RequestTracker();
    const listener = vi.fn();
    const unsub = tracker.on("drained", listener);
    unsub();
    tracker.startDraining("test");
    expect(listener).not.toHaveBeenCalled();
  });

  it("draining getter reflects state", () => {
    const tracker = new RequestTracker();
    expect(tracker.draining).toBe(false);
    tracker.startDraining("test");
    expect(tracker.draining).toBe(true);
  });
});
