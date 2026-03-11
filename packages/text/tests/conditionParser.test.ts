import { describe, it, expect } from "vitest";
import { evaluateCondition, extractVariables } from "../src/conditionParser.js";

describe("evaluateCondition", () => {
  const vars = {
    sma_7: 105,
    sma_30: 100,
    rsi_14: 45,
    macd_signal: 0.5,
    bollinger: 0.1,
    zero: 0,
  };

  describe("simple comparisons", () => {
    it("evaluates greater-than", () => {
      expect(evaluateCondition("sma_7 > sma_30", vars)).toBe(true);
      expect(evaluateCondition("sma_30 > sma_7", vars)).toBe(false);
    });

    it("evaluates less-than", () => {
      expect(evaluateCondition("rsi_14 < 70", vars)).toBe(true);
      expect(evaluateCondition("rsi_14 < 30", vars)).toBe(false);
    });

    it("evaluates greater-than-or-equal", () => {
      expect(evaluateCondition("sma_7 >= 105", vars)).toBe(true);
      expect(evaluateCondition("sma_7 >= 106", vars)).toBe(false);
    });

    it("evaluates less-than-or-equal", () => {
      expect(evaluateCondition("rsi_14 <= 45", vars)).toBe(true);
      expect(evaluateCondition("rsi_14 <= 44", vars)).toBe(false);
    });

    it("evaluates equality", () => {
      expect(evaluateCondition("rsi_14 == 45", vars)).toBe(true);
      expect(evaluateCondition("rsi_14 == 46", vars)).toBe(false);
    });
  });

  describe("numeric literals", () => {
    it("handles decimal numbers", () => {
      expect(evaluateCondition("bollinger < 0.2", vars)).toBe(true);
    });

    it("handles negative numbers", () => {
      expect(evaluateCondition("macd_signal > -1", vars)).toBe(true);
    });

    it("handles negative number at start of expression", () => {
      expect(evaluateCondition("-1 < macd_signal", vars)).toBe(true);
    });

    it("handles negative number after open paren", () => {
      expect(evaluateCondition("(-1 < macd_signal)", vars)).toBe(true);
    });

    it("handles negative number after logical operator", () => {
      expect(evaluateCondition("sma_7 > 100 AND -1 < macd_signal", vars)).toBe(
        true
      );
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

    it("evaluates AND (both true)", () => {
      expect(evaluateCondition("sma_7 > sma_30 AND rsi_14 < 70", vars)).toBe(
        true
      );
    });

    it("evaluates AND (one false)", () => {
      expect(evaluateCondition("sma_7 > sma_30 AND rsi_14 < 30", vars)).toBe(
        false
      );
    });

    it("evaluates OR (one true)", () => {
      expect(evaluateCondition("sma_7 < sma_30 OR rsi_14 < 70", vars)).toBe(
        true
      );
    });

    it("evaluates OR (both false)", () => {
      expect(evaluateCondition("sma_7 < sma_30 OR rsi_14 > 70", vars)).toBe(
        false
      );
    });

    it("chains multiple ANDs", () => {
      expect(
        evaluateCondition(
          "sma_7 > 100 AND rsi_14 < 70 AND macd_signal > 0",
          vars
        )
      ).toBe(true);
    });

    it("chains multiple ORs", () => {
      expect(
        evaluateCondition("sma_7 < 50 OR rsi_14 > 90 OR macd_signal > 0", vars)
      ).toBe(true);
    });
  });

  describe("operator precedence (AND binds tighter than OR)", () => {
    it("AND has higher precedence than OR", () => {
      // "a OR b AND c" should be "a OR (b AND c)"
      expect(
        evaluateCondition(
          "sma_7 < sma_30 AND rsi_14 < 70 OR macd_signal > 0",
          vars
        )
      ).toBe(true);
    });

    it("evaluates AND first in mixed expression", () => {
      // true OR (false AND true) => true
      expect(
        evaluateCondition(
          "macd_signal > 0 OR sma_7 < sma_30 AND rsi_14 < 70",
          vars
        )
      ).toBe(true);
    });
  });

  describe("parentheses", () => {
    it("overrides precedence with parentheses", () => {
      // (false OR true) AND true => true
      expect(
        evaluateCondition(
          "(sma_7 < sma_30 OR rsi_14 < 70) AND macd_signal > 0",
          vars
        )
      ).toBe(true);
    });

    it("parentheses can make expression false", () => {
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

    it("nested parentheses with complex expression", () => {
      expect(
        evaluateCondition(
          "((sma_7 > sma_30) AND (rsi_14 < 70 OR bollinger < 0.2))",
          vars
        )
      ).toBe(true);
    });
  });

  describe("bare truthy checks", () => {
    it("non-zero value is truthy", () => {
      expect(evaluateCondition("sma_7", vars)).toBe(true);
    });

    it("zero value is falsy", () => {
      expect(evaluateCondition("zero", vars)).toBe(false);
    });
  });

  describe("empty input", () => {
    it("returns false for empty string", () => {
      expect(evaluateCondition("", {})).toBe(false);
    });

    it("returns false for whitespace-only string", () => {
      expect(evaluateCondition("   ", {})).toBe(false);
    });
  });

  describe("error cases", () => {
    it("throws on unknown variable", () => {
      expect(() => evaluateCondition("unknown > 5", {})).toThrow(
        "Unknown variable: unknown"
      );
    });

    it("throws on unexpected character", () => {
      expect(() => evaluateCondition("a @ b", { a: 1, b: 2 })).toThrow(
        "Unexpected character '@'"
      );
    });

    it("throws on subtraction operator", () => {
      expect(() => evaluateCondition("sma_7 - sma_30 > 0", vars)).toThrow(
        "Subtraction is not supported"
      );
    });

    it("throws on unclosed parenthesis", () => {
      expect(() => evaluateCondition("(sma_7 > 100", vars)).toThrow();
    });

    it("throws on unexpected end of expression", () => {
      expect(() => evaluateCondition("sma_7 >", vars)).toThrow(
        "Unexpected end of expression"
      );
    });

    it("throws on trailing tokens", () => {
      expect(() => evaluateCondition("sma_7 > 100 sma_30", vars)).toThrow(
        "Unexpected token at position"
      );
    });
  });
});

describe("extractVariables", () => {
  it("extracts variables from a simple comparison", () => {
    expect(extractVariables("sma_7 > sma_30")).toEqual(["sma_7", "sma_30"]);
  });

  it("extracts variables from a complex expression", () => {
    expect(
      extractVariables("sma_7 > sma_30 AND rsi_14 < 70 OR bollinger < 0.2")
    ).toEqual(["sma_7", "sma_30", "rsi_14", "bollinger"]);
  });

  it("does not include numeric literals", () => {
    expect(extractVariables("rsi_14 < 70")).toEqual(["rsi_14"]);
  });

  it("does not include AND/OR as variables", () => {
    expect(extractVariables("a > 1 AND b < 2 OR c == 3")).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("returns empty array for empty string", () => {
    expect(extractVariables("")).toEqual([]);
  });

  it("handles parenthesized expressions", () => {
    expect(extractVariables("(x > y) AND z < 10")).toEqual(["x", "y", "z"]);
  });
});
