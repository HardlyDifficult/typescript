import { describe, expect, it } from "vitest";
import { z } from "zod";

import { extractTyped } from "../src/extractTyped.js";

describe("extractTyped", () => {
  const personSchema = z.object({
    name: z.string(),
    age: z.number(),
  });

  it("extracts and validates a matching object", () => {
    const text = '{"name":"Alice","age":30}';
    expect(extractTyped(text, personSchema)).toEqual({
      name: "Alice",
      age: 30,
    });
  });

  it("extracts from a code block and validates", () => {
    const text =
      'Here is the person:\n```json\n{"name":"Bob","age":25}\n```\nDone.';
    expect(extractTyped(text, personSchema)).toEqual({
      name: "Bob",
      age: 25,
    });
  });

  it("extracts from prose and validates", () => {
    const text = 'The result is {"name":"Carol","age":40} as expected.';
    expect(extractTyped(text, personSchema)).toEqual({
      name: "Carol",
      age: 40,
    });
  });

  it("returns null when JSON does not match schema", () => {
    const text = '{"name":"Dave","age":"not a number"}';
    expect(extractTyped(text, personSchema)).toBeNull();
  });

  it("returns null when no JSON is found", () => {
    expect(extractTyped("no json here", personSchema)).toBeNull();
  });

  it("works with array schemas", () => {
    const schema = z.array(z.number());
    expect(extractTyped("[1, 2, 3]", schema)).toEqual([1, 2, 3]);
  });

  it("works with string schemas", () => {
    const schema = z.string();
    expect(extractTyped('"hello"', schema)).toBe("hello");
  });

  it("returns null when valid JSON fails schema", () => {
    const schema = z.object({ required: z.string() });
    const text = '{"other":"field"}';
    expect(extractTyped(text, schema)).toBeNull();
  });
});
