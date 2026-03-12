/**
 * Additional coverage tests for createTeardown.ts
 * Targets: line 77 (trapSignals signal handler calling process.exit)
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { createTeardown } from "../src/createTeardown";

describe("createTeardown - additional coverage", () => {
  afterEach(() => {
    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGINT");
    vi.restoreAllMocks();
  });

  it("trapSignals: SIGTERM triggers run() then process.exit(0)", async () => {
    // Spy on process.exit to prevent actual exit
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as (code?: number) => never);

    let ran = false;
    const teardown = createTeardown();
    teardown.add(() => {
      ran = true;
    });

    teardown.trapSignals();

    // Emit SIGTERM to trigger the signal handler
    process.emit("SIGTERM");

    // Wait for the async chain (run() then exit) to complete
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(ran).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("trapSignals: SIGINT triggers run() then process.exit(0)", async () => {
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as (code?: number) => never);

    let ran = false;
    const teardown = createTeardown();
    teardown.add(() => {
      ran = true;
    });

    teardown.trapSignals();

    process.emit("SIGINT");

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(ran).toBe(true);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
