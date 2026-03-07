import { describe, expect, it } from "vitest";
import { z } from "zod";

import { defineOperation, operation, validateParams } from "../src/Operation";
import { ConfigurationError, ValidationError } from "../src/errors";

describe("defineOperation", () => {
  it("returns the config unchanged for explicit URLs", () => {
    const config = defineOperation<{ id: string }, { name: string }>({
      params: z.object({ id: z.string() }),
      method: "GET",
      url: (params, baseUrl) => `${baseUrl}/users/${params.id}`,
    });

    expect(config.method).toBe("GET");
    expect(config.url?.({ id: "123" }, "https://api.test")).toBe(
      "https://api.test/users/123"
    );
  });

  it("accepts relative paths", () => {
    const config = operation.get<{ name: string }>({
      params: z.object({ id: z.string() }),
      path: ({ id }) => `/users/${id}`,
    });

    expect(config.method).toBe("GET");
    expect(config.path?.({ id: "123" })).toBe("/users/123");
  });

  it("preserves body builders", () => {
    const config = operation.post<{ id: string }>({
      params: z.object({ name: z.string() }),
      path: "/users",
      body: ({ name }) => ({ name }),
    });

    expect(config.body?.({ name: "Alice" })).toEqual({ name: "Alice" });
  });

  it("supports parse functions that change the response shape", () => {
    const config = operation.get<
      string[],
      void,
      { items: Array<{ name: string }> }
    >({
      path: "/users",
      parse: (response) => response.items.map((user) => user.name),
    });

    expect(
      config.parse?.(
        { items: [{ name: "Alice" }, { name: "Bob" }] },
        undefined as void
      )
    ).toEqual(["Alice", "Bob"]);
  });

  it("throws when neither path nor url is provided", () => {
    expect(() =>
      defineOperation({
        method: "GET",
      })
    ).toThrow(ConfigurationError);
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
      schema
    );
    expect(result).toEqual({ name: "Bob", age: 25 });
  });

  it("throws ValidationError on invalid params", () => {
    expect(() => validateParams({ name: "", age: -1 }, schema)).toThrow(
      ValidationError
    );
  });

  it("includes field paths in error message", () => {
    try {
      validateParams({ name: "", age: -1 }, schema);
      expect.fail("should have thrown");
    } catch (error) {
      const validationError = error as ValidationError;
      expect(validationError.message).toContain("name");
      expect(validationError.message).toContain("age");
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
