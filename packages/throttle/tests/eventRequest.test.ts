import { describe, it, expect, vi } from "vitest";
import { eventRequest, type EventSubscriber } from "../src/eventRequest";

// --- Test helpers ---

interface TestEvent {
  requestId: string;
}

interface CompleteEvent extends TestEvent {
  result: string;
}

interface ErrorEvent extends TestEvent {
  error: string;
}

interface DataEvent extends TestEvent {
  content: string;
}

/**
 * Creates a mock event bus with typed subscribe/emit for testing.
 */
function createEventBus<T>(): {
  subscribe: EventSubscriber<T>;
  emit: (event: T) => void;
  unsubscribed: boolean;
} {
  let handler: ((event: T) => void) | null = null;
  const bus = {
    unsubscribed: false,
    subscribe: (cb: (event: T) => void) => {
      handler = cb;
      return () => {
        handler = null;
        bus.unsubscribed = true;
      };
    },
    emit: (event: T) => {
      handler?.(event);
    },
  };
  return bus;
}

// --- Tests ---

describe("eventRequest", () => {
  it("resolves when a matching complete event fires", async () => {
    const complete = createEventBus<CompleteEvent>();
    const error = createEventBus<ErrorEvent>();

    const promise = eventRequest({
      send: () => {},
      match: () => true,
      on: {
        complete: complete.subscribe,
        error: error.subscribe,
      },
    });

    complete.emit({ requestId: "1", result: "done" });

    await expect(promise).resolves.toEqual({
      requestId: "1",
      result: "done",
    });
  });

  it("rejects when a matching error event fires", async () => {
    const complete = createEventBus<CompleteEvent>();
    const error = createEventBus<ErrorEvent>();

    const promise = eventRequest({
      send: () => {},
      match: () => true,
      on: {
        complete: complete.subscribe,
        error: error.subscribe,
      },
    });

    error.emit({ requestId: "1", error: "failed" });

    await expect(promise).rejects.toEqual({
      requestId: "1",
      error: "failed",
    });
  });

  it("filters events using match", async () => {
    const complete = createEventBus<CompleteEvent>();
    const error = createEventBus<ErrorEvent>();

    const promise = eventRequest({
      send: () => {},
      match: (event) => event.requestId === "target",
      on: {
        complete: complete.subscribe,
        error: error.subscribe,
      },
    });

    // Non-matching event should be ignored
    complete.emit({ requestId: "other", result: "wrong" });

    // Matching event should resolve
    complete.emit({ requestId: "target", result: "correct" });

    await expect(promise).resolves.toEqual({
      requestId: "target",
      result: "correct",
    });
  });

  it("calls onData for matching data events", async () => {
    const complete = createEventBus<CompleteEvent>();
    const error = createEventBus<ErrorEvent>();
    const data = createEventBus<DataEvent>();
    const received: string[] = [];

    const promise = eventRequest({
      send: () => {},
      match: (event) => event.requestId === "1",
      on: {
        complete: complete.subscribe,
        error: error.subscribe,
        data: data.subscribe,
      },
      onData: (event) => received.push(event.content),
    });

    data.emit({ requestId: "1", content: "chunk-1" });
    data.emit({ requestId: "other", content: "ignored" });
    data.emit({ requestId: "1", content: "chunk-2" });
    complete.emit({ requestId: "1", result: "done" });

    await promise;

    expect(received).toEqual(["chunk-1", "chunk-2"]);
  });

  it("cleans up all subscriptions on complete", async () => {
    const complete = createEventBus<CompleteEvent>();
    const error = createEventBus<ErrorEvent>();
    const data = createEventBus<DataEvent>();

    const promise = eventRequest({
      send: () => {},
      match: () => true,
      on: {
        complete: complete.subscribe,
        error: error.subscribe,
        data: data.subscribe,
      },
      onData: () => {},
    });

    complete.emit({ requestId: "1", result: "done" });
    await promise;

    expect(complete.unsubscribed).toBe(true);
    expect(error.unsubscribed).toBe(true);
    expect(data.unsubscribed).toBe(true);
  });

  it("cleans up all subscriptions on error", async () => {
    const complete = createEventBus<CompleteEvent>();
    const error = createEventBus<ErrorEvent>();
    const data = createEventBus<DataEvent>();

    const promise = eventRequest({
      send: () => {},
      match: () => true,
      on: {
        complete: complete.subscribe,
        error: error.subscribe,
        data: data.subscribe,
      },
      onData: () => {},
    });

    error.emit({ requestId: "1", error: "failed" });
    await promise.catch(() => {});

    expect(complete.unsubscribed).toBe(true);
    expect(error.unsubscribed).toBe(true);
    expect(data.unsubscribed).toBe(true);
  });

  it("subscribes before calling send", async () => {
    const complete = createEventBus<CompleteEvent>();
    const error = createEventBus<ErrorEvent>();

    const promise = eventRequest({
      send: () => {
        // Emit during send — should be caught because subscriptions are active
        complete.emit({ requestId: "1", result: "immediate" });
      },
      match: () => true,
      on: {
        complete: complete.subscribe,
        error: error.subscribe,
      },
    });

    await expect(promise).resolves.toEqual({
      requestId: "1",
      result: "immediate",
    });
  });

  it("does not subscribe to data when on.data is not provided", async () => {
    const complete = createEventBus<CompleteEvent>();
    const error = createEventBus<ErrorEvent>();
    const onData = vi.fn();

    const promise = eventRequest({
      send: () => {},
      match: () => true,
      on: {
        complete: complete.subscribe,
        error: error.subscribe,
      },
      onData,
    });

    complete.emit({ requestId: "1", result: "done" });
    await promise;

    // onData should never be called when on.data is not provided
    expect(onData).not.toHaveBeenCalled();
  });

  it("rejects and cleans up if send throws", async () => {
    const complete = createEventBus<CompleteEvent>();
    const error = createEventBus<ErrorEvent>();

    const promise = eventRequest({
      send: () => {
        throw new Error("send failed");
      },
      match: () => true,
      on: {
        complete: complete.subscribe,
        error: error.subscribe,
      },
    });

    await expect(promise).rejects.toThrow("send failed");
    expect(complete.unsubscribed).toBe(true);
    expect(error.unsubscribed).toBe(true);
  });
});
