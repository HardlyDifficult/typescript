import { describe, expect, it } from "vitest";

import { createLinker } from "../src/linker.js";

describe("createLinker", () => {
  it("formats links for Slack from array-based rules", () => {
    const linker = createLinker([
      {
        pattern: /\b([A-Z]{2,6}-\d+)\b/g,
        href: "https://linear.app/fairmint/issue/$1",
      },
      {
        pattern: /\bPR#(\d+)\b/g,
        href: "https://github.com/Fairmint/api/pull/$1",
      },
    ]);

    const output = linker.apply("Fix ENG-533 and PR#42", {
      platform: "slack",
    });

    expect(output).toBe(
      "Fix <https://linear.app/fairmint/issue/ENG-533|ENG-533> and <https://github.com/Fairmint/api/pull/42|PR#42>"
    );
  });

  it("is idempotent for Slack output", () => {
    const linker = createLinker().linear("fairmint");
    const first = linker.linkText("Ship ENG-533", { format: "slack" });
    const second = linker.linkText(first, { format: "slack" });
    expect(second).toBe(first);
  });

  it("skips code spans by default", () => {
    const linker = createLinker().linear("fairmint");
    const output = linker.linkText("Code: `ENG-533` then ENG-533", {
      format: "markdown",
    });
    expect(output).toBe(
      "Code: `ENG-533` then [ENG-533](https://linear.app/fairmint/issue/ENG-533)"
    );
  });

  it("skips existing markdown links by default", () => {
    const linker = createLinker().linear("fairmint");
    const output = linker.linkText(
      "Existing [ENG-533](https://linear.app/fairmint/issue/ENG-533) and ENG-533",
      { format: "markdown" }
    );
    expect(output).toBe(
      "Existing [ENG-533](https://linear.app/fairmint/issue/ENG-533) and [ENG-533](https://linear.app/fairmint/issue/ENG-533)"
    );
  });

  it("prefers higher priority rules for overlapping matches", () => {
    const linker = createLinker()
      .custom(/\bENG-\d+\b/g, "https://low.example/$0", { priority: 0 })
      .custom(/\bENG-533\b/g, "https://high.example/$0", { priority: 10 });

    const output = linker.linkText("ENG-533 and ENG-534", {
      format: "markdown",
    });
    expect(output).toBe(
      "[ENG-533](https://high.example/ENG-533) and [ENG-534](https://low.example/ENG-534)"
    );
  });

  it("supports fluent sugar for linear, github PR, and custom rules", () => {
    const linker = createLinker()
      .linear("fairmint")
      .githubPr("Fairmint/api")
      .custom(/\bINC-\d+\b/g, ({ match }) => `https://incident.io/${match}`);

    const output = linker.linkText("Fix ENG-533 PR#42 INC-99", {
      format: "slack",
    });
    expect(output).toBe(
      "Fix <https://linear.app/fairmint/issue/ENG-533|ENG-533> <https://github.com/Fairmint/api/pull/42|PR#42> <https://incident.io/INC-99|INC-99>"
    );
  });

  it("renders plain-text links as raw hrefs and remains idempotent", () => {
    const linker = createLinker().linear("fairmint");
    const first = linker.linkText("ENG-533", { format: "plaintext" });
    const second = linker.linkText(first, { format: "plaintext" });
    expect(first).toBe("https://linear.app/fairmint/issue/ENG-533");
    expect(second).toBe(first);
  });

  it("falls back to declaration order for equal-priority conflicts", () => {
    const linker = createLinker()
      .custom(/\bENG-533\b/g, "https://first.example/$0")
      .custom(/\bENG-533\b/g, "https://second.example/$0");
    const output = linker.linkText("ENG-533", { format: "markdown" });
    expect(output).toBe("[ENG-533](https://first.example/ENG-533)");
  });
});
