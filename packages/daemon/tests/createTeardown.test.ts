import { describe, it, expect, vi, afterEach } from "vitest";
import { createTeardown } from "../src/createTeardown";

describe("createTeardown", () => {
  it("runs teardown functions in LIFO order", async () => {
    const order: number[] = [];
    const teardown = createTeardown();

    teardown.add(() => {
      order.push(1);
    });
    teardown.add(() => {
      order.push(2);
    });
    teardown.add(() => {
      order.push(3);
    });

    await teardown.run();

    expect(order).toEqual([3, 2, 1]);
  });

  it("handles async teardown functions", async () => {
    const order: number[] = [];
    const teardown = createTeardown();

    teardown.add(async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push(1);
    });
    teardown.add(async () => {
      await new Promise((r) => setTimeout(r, 10));
      order.push(2);
    });

    await teardown.run();

    expect(order).toEqual([2, 1]);
  });

  it("is idempotent: second run() is a no-op", async () => {
    let count = 0;
    const teardown = createTeardown();

    teardown.add(() => {
      count++;
    });

    await teardown.run();
    await teardown.run();

    expect(count).toBe(1);
  });

  it("swallows sync errors and continues remaining fns", async () => {
    const order: number[] = [];
    const teardown = createTeardown();

    teardown.add(() => {
      order.push(1);
    });
    teardown.add(() => {
      throw new Error("boom");
    });
    teardown.add(() => {
      order.push(3);
    });

    await teardown.run();

    expect(order).toEqual([3, 1]);
  });

  it("swallows async errors and continues remaining fns", async () => {
    const order: number[] = [];
    const teardown = createTeardown();

    teardown.add(() => {
      order.push(1);
    });
    teardown.add(async () => {
      throw new Error("async boom");
    });
    teardown.add(() => {
      order.push(3);
    });

    await teardown.run();

    expect(order).toEqual([3, 1]);
  });

  it("run() resolves even when errors occur", async () => {
    const teardown = createTeardown();

    teardown.add(() => {
      throw new Error("boom");
    });

    await expect(teardown.run()).resolves.toBeUndefined();
  });

  it("add() returns working unregister fn", async () => {
    const order: number[] = [];
    const teardown = createTeardown();

    teardown.add(() => {
      order.push(1);
    });
    const unregister = teardown.add(() => {
      order.push(2);
    });
    teardown.add(() => {
      order.push(3);
    });

    unregister();
    await teardown.run();

    expect(order).toEqual([3, 1]);
  });

  it("unregister is safe to call multiple times", async () => {
    let count = 0;
    const teardown = createTeardown();

    const unregister = teardown.add(() => {
      count++;
    });

    unregister();
    unregister();
    unregister();

    await teardown.run();

    expect(count).toBe(0);
  });

  it("only unregisters the specific registration", async () => {
    const order: number[] = [];
    const teardown = createTeardown();

    const un1 = teardown.add(() => {
      order.push(1);
    });
    teardown.add(() => {
      order.push(2);
    });
    teardown.add(() => {
      order.push(3);
    });

    un1();
    await teardown.run();

    expect(order).toEqual([3, 2]);
  });

  it("add() after run() is silent no-op", async () => {
    let count = 0;
    const teardown = createTeardown();

    await teardown.run();

    const unregister = teardown.add(() => {
      count++;
    });

    // The returned unregister should be safe to call
    unregister();

    expect(count).toBe(0);
  });

  it("run() with no registered functions resolves", async () => {
    const teardown = createTeardown();

    await expect(teardown.run()).resolves.toBeUndefined();
  });

  it("same function added twice runs twice", async () => {
    let count = 0;
    const fn = (): void => {
      count++;
    };

    const teardown = createTeardown();
    teardown.add(fn);
    teardown.add(fn);

    await teardown.run();

    expect(count).toBe(2);
  });

  it("unregistering one of two identical fn refs only removes one", async () => {
    let count = 0;
    const fn = (): void => {
      count++;
    };

    const teardown = createTeardown();
    teardown.add(fn);
    const unregister = teardown.add(fn);

    unregister();
    await teardown.run();

    expect(count).toBe(1);
  });

  describe("trapSignals", () => {
    afterEach(() => {
      process.removeAllListeners("SIGTERM");
      process.removeAllListeners("SIGINT");
    });

    it("registers SIGTERM and SIGINT handlers", () => {
      const teardown = createTeardown();
      const before = {
        sigterm: process.listenerCount("SIGTERM"),
        sigint: process.listenerCount("SIGINT"),
      };

      teardown.trapSignals();

      expect(process.listenerCount("SIGTERM")).toBe(before.sigterm + 1);
      expect(process.listenerCount("SIGINT")).toBe(before.sigint + 1);
    });

    it("untrap removes signal handlers", () => {
      const teardown = createTeardown();
      const before = {
        sigterm: process.listenerCount("SIGTERM"),
        sigint: process.listenerCount("SIGINT"),
      };

      const untrap = teardown.trapSignals();
      untrap();

      expect(process.listenerCount("SIGTERM")).toBe(before.sigterm);
      expect(process.listenerCount("SIGINT")).toBe(before.sigint);
    });
  });
});
