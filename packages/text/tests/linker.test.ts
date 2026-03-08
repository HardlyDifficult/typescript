import { describe, expect, it } from "vitest";

import { createLinker, linkText } from "../src/linker.js";

describe("linkText", () => {
  it("links Linear issues and GitHub PRs from declarative config", () => {
    const output = linkText("Fix ENG-533 and PR#42", {
      linear: "fairmint",
      githubPrs: "Fairmint/api",
      for: "slack",
    });

    expect(output).toBe(
      "Fix <https://linear.app/fairmint/issue/ENG-533|ENG-533> and <https://github.com/Fairmint/api/pull/42|PR#42>"
    );
  });

  it("supports custom rules alongside built-ins", () => {
    const output = linkText("Fix ENG-533 PR#42 INC-99", {
      linear: "fairmint",
      githubPrs: "Fairmint/api",
      rules: [
        {
          name: "incident",
          match: /\bINC-\d+\b/g,
          to: ({ text }) => `https://incident.io/${text}`,
        },
      ],
      for: "slack",
    });

    expect(output).toBe(
      "Fix <https://linear.app/fairmint/issue/ENG-533|ENG-533> <https://github.com/Fairmint/api/pull/42|PR#42> <https://incident.io/INC-99|INC-99>"
    );
  });

  it("prefers higher priority rules for overlapping matches", () => {
    const output = linkText("ENG-533 and ENG-534", {
      rules: [
        {
          match: /\bENG-\d+\b/g,
          to: "https://low.example/$0",
        },
        {
          match: /\bENG-533\b/g,
          to: "https://high.example/$0",
          priority: 10,
        },
      ],
    });

    expect(output).toBe(
      "[ENG-533](https://high.example/ENG-533) and [ENG-534](https://low.example/ENG-534)"
    );
  });

  it("lets later rules override equal-priority conflicts", () => {
    const output = linkText("ENG-533", {
      rules: [
        {
          match: /\bENG-533\b/g,
          to: "https://first.example/$0",
        },
        {
          match: /\bENG-533\b/g,
          to: "https://second.example/$0",
        },
      ],
    });

    expect(output).toBe("[ENG-533](https://second.example/ENG-533)");
  });
});

describe("createLinker", () => {
  it("creates a reusable linker instance", () => {
    const linker = createLinker({ linear: "fairmint" });
    const first = linker.link("Ship ENG-533", { for: "slack" });
    const second = linker.link(first, { for: "slack" });

    expect(second).toBe(first);
  });

  it("skips code spans by default", () => {
    const linker = createLinker({ linear: "fairmint" });
    const output = linker.link("Code: `ENG-533` then ENG-533");

    expect(output).toBe(
      "Code: `ENG-533` then [ENG-533](https://linear.app/fairmint/issue/ENG-533)"
    );
  });

  it("skips existing links by default", () => {
    const linker = createLinker({ linear: "fairmint" });
    const output = linker.link(
      "Existing [ENG-533](https://linear.app/fairmint/issue/ENG-533) and ENG-533"
    );

    expect(output).toBe(
      "Existing [ENG-533](https://linear.app/fairmint/issue/ENG-533) and [ENG-533](https://linear.app/fairmint/issue/ENG-533)"
    );
  });

  it("renders plain links as raw hrefs and remains idempotent", () => {
    const linker = createLinker({ linear: "fairmint" });
    const first = linker.link("ENG-533", { for: "plain" });
    const second = linker.link(first, { for: "plain" });

    expect(first).toBe("https://linear.app/fairmint/issue/ENG-533");
    expect(second).toBe(first);
  });
});
