import { describe, it, expect } from "vitest";
import { z } from "zod";
import { defineOperation, validateParams } from "../src/Operation";
import { ValidationError } from "../src/errors";

describe("defineOperation", () => {
  it("returns the config unchanged", () => {
    const config = defineOperation<{ id: string }, { name: string }>({
      params: z.object({ id: z.string() }),
      method: "GET",
      url: (p, base) => `${base}/users/${p.id}`,
    });

    expect(config.method).toBe("GET");
    expect(config.url({ id: "123" }, "https://api.test")).toBe(
      "https://api.test/users/123",
    );
  });

  it("preserves body builder", () => {
    const config = defineOperation<{ name: string }, { id: string }>({
      params: z.object({ name: z.string() }),
      method: "POST",
      url: (_p, base) => `${base}/users`,
      body: (p) => ({ name: p.name }),
    });

    expect(config.body?.({ name: "Alice" })).toEqual({ name: "Alice" });
  });

  it("preserves transform function", () => {
    const config = defineOperation<void, { raw: string }>({
      params: z.void(),
      method: "GET",
      url: (_p, base) => `${base}/data`,
      transform: (r) => ({ raw: r.raw.toUpperCase() }),
    });

    expect(config.transform?.({ raw: "hello" })).toEqual({ raw: "HELLO" });
  });
});

describe("validateParams", () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().positive(),
  });

  it("returns parsed params on success", () => {
    const result = validateParams({ name: "Alice", age: 30 }, schema);
    expect(result).toEqual({ name: "Alice", age: 30 });
  });

  it("strips extra fields", () => {
    const result = validateParams(
      { name: "Bob", age: 25, extra: true } as { name: string; age: number },
      schema,
    );
    expect(result).toEqual({ name: "Bob", age: 25 });
  });

  it("throws ValidationError on invalid params", () => {
    expect(() => validateParams({ name: "", age: -1 }, schema)).toThrow(
      ValidationError,
    );
  });

  it("includes field paths in error message", () => {
    try {
      validateParams({ name: "", age: -1 }, schema);
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as ValidationError;
      expect(err.message).toContain("name");
      expect(err.message).toContain("age");
    }
  });

  it("passes through non-Zod errors", () => {
    const badSchema = {
      parse: () => {
        throw new Error("unexpected");
      },
    } as unknown as z.ZodSchema<unknown>;

    expect(() => validateParams({}, badSchema)).toThrow("unexpected");
  });
});
