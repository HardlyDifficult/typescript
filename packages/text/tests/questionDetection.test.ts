import { describe, it, expect } from "vitest";
import { isWaitingForInput } from "../src/questionDetection.js";

describe("isWaitingForInput", () => {
  it("returns false for empty string", () => {
    expect(isWaitingForInput("")).toBe(false);
  });

  it("returns false for whitespace-only string", () => {
    expect(isWaitingForInput("   \n  ")).toBe(false);
  });

  it("returns true when response ends with a question mark", () => {
    expect(isWaitingForInput("I finished the task. Should I continue?")).toBe(
      true
    );
  });

  it("returns true when response ends with question mark after whitespace", () => {
    expect(isWaitingForInput("Done. Which option do you prefer?   ")).toBe(
      true
    );
  });

  it("returns false for a normal completion response", () => {
    expect(isWaitingForInput("I have completed the task successfully.")).toBe(
      false
    );
  });

  it("returns true for 'let me know'", () => {
    expect(
      isWaitingForInput(
        "I can do either approach. Let me know which you prefer."
      )
    ).toBe(true);
  });

  it("returns true for 'would you like'", () => {
    expect(
      isWaitingForInput("Would you like me to proceed with option A?")
    ).toBe(true);
  });

  it("returns true for 'should i'", () => {
    expect(isWaitingForInput("Should I also update the tests?")).toBe(true);
  });

  it("returns true for 'do you want'", () => {
    expect(
      isWaitingForInput("Do you want me to refactor the other files as well?")
    ).toBe(true);
  });

  it("returns true for 'which option'", () => {
    expect(
      isWaitingForInput(
        "There are two approaches available. Which option works best for you?"
      )
    ).toBe(true);
  });

  it("returns true for 'please clarify'", () => {
    expect(isWaitingForInput("Please clarify the expected behavior.")).toBe(
      true
    );
  });

  it("returns true for 'please confirm'", () => {
    expect(isWaitingForInput("Please confirm you want to proceed.")).toBe(true);
  });

  it("returns true for 'before i proceed'", () => {
    expect(isWaitingForInput("Before I proceed, I need more context.")).toBe(
      true
    );
  });

  it("returns true for 'how would you like'", () => {
    expect(
      isWaitingForInput("How would you like me to handle the error cases?")
    ).toBe(true);
  });

  it("is case-insensitive for phrase matching", () => {
    expect(isWaitingForInput("LET ME KNOW if this looks right.")).toBe(true);
  });

  it("only inspects the last 500 characters", () => {
    const longPrefix = "a".repeat(600);
    expect(isWaitingForInput(longPrefix + " let me know")).toBe(true);
    expect(isWaitingForInput("let me know " + longPrefix)).toBe(false);
  });

  it("returns false when question mark appears mid-response but not at end", () => {
    expect(isWaitingForInput("Can this work? Yes it can. Done.")).toBe(false);
  });
});
