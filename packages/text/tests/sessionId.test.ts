import { describe, it, expect } from "vitest";
import { createSessionId } from "../src/sessionId.js";

describe("createSessionId", () => {
  it("starts with the given prefix", () => {
    const id = createSessionId("test");
    expect(id.startsWith("test-")).toBe(true);
  });

  it("contains three hyphen-separated parts", () => {
    const id = createSessionId("abc");
    const parts = id.split("-");
    expect(parts.length).toBe(3);
    expect(parts[0]).toBe("abc");
  });

  it("second part is a base-36 timestamp", () => {
    const before = Date.now();
    const id = createSessionId("t");
    const after = Date.now();

    const parts = id.split("-");
    const timestamp = parseInt(parts[1], 36);
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });

  it("third part is a random suffix of base-36 characters", () => {
    const id = createSessionId("t");
    const parts = id.split("-");
    const suffix = parts[2];
    expect(suffix.length).toBeGreaterThan(0);
    expect(suffix.length).toBeLessThanOrEqual(6);
    expect(/^[0-9a-z]+$/.test(suffix)).toBe(true);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => createSessionId("u")));
    expect(ids.size).toBe(100);
  });

  it("works with empty prefix", () => {
    const id = createSessionId("");
    expect(id.startsWith("-")).toBe(true);
  });
});
