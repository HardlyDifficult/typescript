import { describe, it, expect } from "vitest";
import { evaluateCondition, extractVariables } from "../src/conditionParser.js";

describe("evaluateCondition", () => {
  describe("simple comparisons", () => {
    it("evaluates greater than", () => {
      expect(evaluateCondition("x > 5", { x: 10 })).toBe(true);
      expect(evaluateCondition("x > 5", { x: 3 })).toBe(false);
      expect(evaluateCondition("x > 5", { x: 5 })).toBe(false);
    });

    it("evaluates less than", () => {
      expect(evaluateCondition("x < 5", { x: 3 })).toBe(true);
      expect(evaluateCondition("x < 5", { x: 10 })).toBe(false);
      expect(evaluateCondition("x < 5", { x: 5 })).toBe(false);
    });

    it("evaluates greater than or equal", () => {
      expect(evaluateCondition("x >= 5", { x: 5 })).toBe(true);
      expect(evaluateCondition("x >= 5", { x: 6 })).toBe(true);
      expect(evaluateCondition("x >= 5", { x: 4 })).toBe(false);
    });

    it("evaluates less than or equal", () => {
      expect(evaluateCondition("x <= 5", { x: 5 })).toBe(true);
      expect(evaluateCondition("x <= 5", { x: 4 })).toBe(true);
      expect(evaluateCondition("x <= 5", { x: 6 })).toBe(false);
    });

    it("evaluates equality", () => {
      expect(evaluateCondition("x == 5", { x: 5 })).toBe(true);
      expect(evaluateCondition("x == 5", { x: 6 })).toBe(false);
    });
  });

  describe("variable comparisons", () => {
    it("compares two variables", () => {
      expect(
        evaluateCondition("sma_7 > sma_30", { sma_7: 100, sma_30: 90 })
      ).toBe(true);
      expect(
        evaluateCondition("sma_7 > sma_30", { sma_7: 80, sma_30: 90 })
      ).toBe(false);
    });
  });

  describe("numeric literals", () => {
    it("handles decimal numbers", () => {
      expect(evaluateCondition("x > 0.5", { x: 0.8 })).toBe(true);
      expect(evaluateCondition("x > 0.5", { x: 0.3 })).toBe(false);
    });

    it("handles negative numbers", () => {
      expect(evaluateCondition("x > -5", { x: 0 })).toBe(true);
      expect(evaluateCondition("x > -5", { x: -10 })).toBe(false);
    });

    it("handles negative numbers after operators", () => {
      expect(evaluateCondition("x == -3", { x: -3 })).toBe(true);
    });

    it("handles negative numbers after open paren", () => {
      expect(evaluateCondition("(-1 < 0)", {})).toBe(true);
    });
  });

  describe("logical operators", () => {
    it("evaluates AND", () => {
      expect(evaluateCondition("x > 5 AND y < 10", { x: 7, y: 3 })).toBe(true);
      expect(evaluateCondition("x > 5 AND y < 10", { x: 3, y: 3 })).toBe(false);
      expect(evaluateCondition("x > 5 AND y < 10", { x: 7, y: 15 })).toBe(
        false
      );
    });

    it("evaluates OR", () => {
      expect(evaluateCondition("x > 5 OR y < 10", { x: 7, y: 15 })).toBe(true);
      expect(evaluateCondition("x > 5 OR y < 10", { x: 3, y: 3 })).toBe(true);
      expect(evaluateCondition("x > 5 OR y < 10", { x: 3, y: 15 })).toBe(false);
    });

    it("AND has higher precedence than OR", () => {
      // "a OR b AND c" should be "a OR (b AND c)"
      expect(
        evaluateCondition("a > 0 OR b > 0 AND c > 0", { a: 1, b: 0, c: 0 })
      ).toBe(true);
      expect(
        evaluateCondition("a > 0 OR b > 0 AND c > 0", { a: 0, b: 1, c: 0 })
      ).toBe(false);
    });
  });

  describe("parentheses", () => {
    it("groups expressions with parentheses", () => {
      expect(
        evaluateCondition("(sma_7 > sma_30) AND (rsi_14 < 70)", {
          sma_7: 100,
          sma_30: 90,
          rsi_14: 50,
        })
      ).toBe(true);
    });

    it("overrides precedence", () => {
      // "(a OR b) AND c" differs from "a OR b AND c"
      expect(
        evaluateCondition("(a > 0 OR b > 0) AND c > 0", {
          a: 1,
          b: 0,
          c: 0,
        })
      ).toBe(false);
    });

    it("handles nested parentheses", () => {
      expect(evaluateCondition("((x > 0))", { x: 1 })).toBe(true);
    });
  });

  describe("bare truthy check", () => {
    it("treats non-zero as truthy", () => {
      expect(evaluateCondition("x", { x: 5 })).toBe(true);
      expect(evaluateCondition("x", { x: -1 })).toBe(true);
    });

    it("treats zero as falsy", () => {
      expect(evaluateCondition("x", { x: 0 })).toBe(false);
    });

    it("treats NaN as falsy", () => {
      expect(evaluateCondition("x", { x: NaN })).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("returns false for empty condition", () => {
      expect(evaluateCondition("", {})).toBe(false);
    });

    it("returns false for whitespace-only condition", () => {
      expect(evaluateCondition("   ", {})).toBe(false);
    });

    it("handles tabs in input", () => {
      expect(evaluateCondition("x\t>\t5", { x: 10 })).toBe(true);
    });

    it("throws for unknown variable", () => {
      expect(() => evaluateCondition("unknown > 5", {})).toThrow(
        "Unknown variable: unknown"
      );
    });

    it("throws for unexpected character", () => {
      expect(() => evaluateCondition("x & y", { x: 1, y: 1 })).toThrow(
        "Unexpected character"
      );
    });

    it("throws for subtraction operator used after identifier", () => {
      expect(() => evaluateCondition("x - 5", { x: 10 })).toThrow(
        "Subtraction is not supported"
      );
    });

    it("throws for unexpected end of expression", () => {
      expect(() => evaluateCondition("x >", { x: 10 })).toThrow(
        "Unexpected end of expression"
      );
    });

    it("throws for mismatched parenthesis", () => {
      expect(() => evaluateCondition("(x > 5", { x: 10 })).toThrow();
    });

    it("throws for extra tokens after valid expression", () => {
      expect(() => evaluateCondition("x > 5 6", { x: 10 })).toThrow(
        "Unexpected token"
      );
    });
  });

  describe("complex expressions from docstring", () => {
    it("evaluates 'macd_signal > 0 AND rsi_14 < 70'", () => {
      expect(
        evaluateCondition("macd_signal > 0 AND rsi_14 < 70", {
          macd_signal: 0.5,
          rsi_14: 60,
        })
      ).toBe(true);
    });

    it("evaluates '(sma_7 > sma_30) AND (rsi_14 < 70 OR bollinger < 0.2)'", () => {
      expect(
        evaluateCondition(
          "(sma_7 > sma_30) AND (rsi_14 < 70 OR bollinger < 0.2)",
          { sma_7: 100, sma_30: 90, rsi_14: 80, bollinger: 0.1 }
        )
      ).toBe(true);
      expect(
        evaluateCondition(
          "(sma_7 > sma_30) AND (rsi_14 < 70 OR bollinger < 0.2)",
          { sma_7: 100, sma_30: 90, rsi_14: 80, bollinger: 0.5 }
        )
      ).toBe(false);
    });
  });
});

describe("extractVariables", () => {
  it("extracts variable names from simple expression", () => {
    expect(extractVariables("sma_7 > sma_30")).toEqual(["sma_7", "sma_30"]);
  });

  it("returns empty array for empty string", () => {
    expect(extractVariables("")).toEqual([]);
  });

  it("does not include AND/OR as variables", () => {
    expect(extractVariables("x > 0 AND y < 5 OR z == 1")).toEqual([
      "x",
      "y",
      "z",
    ]);
  });

  it("extracts variables from complex expression", () => {
    expect(
      extractVariables("(sma_7 > sma_30) AND (rsi_14 < 70 OR bollinger < 0.2)")
    ).toEqual(["sma_7", "sma_30", "rsi_14", "bollinger"]);
  });

  it("includes duplicates if a variable appears multiple times", () => {
    expect(extractVariables("x > 0 AND x < 10")).toEqual(["x", "x"]);
  });
});
