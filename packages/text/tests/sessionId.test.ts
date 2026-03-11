import { describe, it, expect, vi, afterEach } from "vitest";
import { createSessionId } from "../src/sessionId.js";

describe("createSessionId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with the given prefix", () => {
    const id = createSessionId("test");
    expect(id.startsWith("test-")).toBe(true);
  });

  it("has three parts separated by hyphens after the prefix", () => {
    const id = createSessionId("pfx");
    // prefix-timestamp-random
    const parts = id.split("-");
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe("pfx");
  });

  it("contains a base-36 timestamp", () => {
    vi.spyOn(Date, "now").mockReturnValue(1000000);
    const id = createSessionId("s");
    const parts = id.split("-");
    expect(parts[1]).toBe((1000000).toString(36));
  });

  it("generates unique IDs on consecutive calls", () => {
    const id1 = createSessionId("a");
    const id2 = createSessionId("a");
    expect(id1).not.toBe(id2);
  });

  it("works with empty prefix", () => {
    const id = createSessionId("");
    expect(id.startsWith("-")).toBe(true);
  });
});
