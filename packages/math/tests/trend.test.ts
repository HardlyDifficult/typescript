import { describe, expect, it } from "vitest";

import { classifyTrend } from "../src/trend.js";

describe("classifyTrend", () => {
  it("classifies positive value above threshold as up", () => {
    expect(classifyTrend(0.001, 0.0005)).toBe("up");
  });

  it("classifies negative value below negative threshold as down", () => {
    expect(classifyTrend(-0.001, 0.0005)).toBe("down");
  });

  it("classifies value within threshold as flat", () => {
    expect(classifyTrend(0.0003, 0.0005)).toBe("flat");
    expect(classifyTrend(-0.0003, 0.0005)).toBe("flat");
  });

  it("classifies exact threshold as flat", () => {
    expect(classifyTrend(0.0005, 0.0005)).toBe("flat");
    expect(classifyTrend(-0.0005, 0.0005)).toBe("flat");
  });

  it("classifies zero as flat", () => {
    expect(classifyTrend(0, 0.0005)).toBe("flat");
  });
});
