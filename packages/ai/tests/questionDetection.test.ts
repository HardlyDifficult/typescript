import { describe, it, expect } from "vitest";
import { isWaitingForInput } from "../src/questionDetection.js";

describe("isWaitingForInput", () => {
  it("returns false for empty string", () => {
    expect(isWaitingForInput("")).toBe(false);
  });

  it("returns false for whitespace-only string", () => {
    expect(isWaitingForInput("   ")).toBe(false);
  });

  it("returns true when response ends with question mark", () => {
    expect(isWaitingForInput("I completed the task. Should I continue?")).toBe(
      true
    );
  });

  it("returns true when response ends with question mark after whitespace", () => {
    expect(isWaitingForInput("Done. Ready to proceed?  ")).toBe(true);
  });

  it("returns false for a statement ending with period", () => {
    expect(isWaitingForInput("I have completed all the tasks.")).toBe(false);
  });

  it('returns true for "let me know" phrase', () => {
    expect(
      isWaitingForInput(
        "I have done the work. Let me know if you want changes."
      )
    ).toBe(true);
  });

  it('returns true for "would you like" phrase', () => {
    expect(
      isWaitingForInput("Would you like me to proceed with that approach?")
    ).toBe(true);
  });

  it('returns true for "please confirm" phrase', () => {
    expect(
      isWaitingForInput("Please confirm you want to delete the file.")
    ).toBe(true);
  });

  it("returns false for completion statement with no question indicators", () => {
    expect(
      isWaitingForInput("All tests pass and the build is successful.")
    ).toBe(false);
  });

  it("is case-insensitive for phrases", () => {
    expect(isWaitingForInput("LET ME KNOW if this works.")).toBe(true);
  });
});
