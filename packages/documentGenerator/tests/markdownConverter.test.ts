import { describe, it, expect } from "vitest";
import { convertMarkdown, stripMarkdown } from "../src/index.js";

describe("convertMarkdown", () => {
  describe("platform: markdown", () => {
    it("preserves bold formatting", () => {
      expect(convertMarkdown("**bold text**", "markdown")).toBe(
        "**bold text**"
      );
    });

    it("preserves italic formatting", () => {
      expect(convertMarkdown("*italic text*", "markdown")).toBe(
        "*italic text*"
      );
    });

    it("preserves strikethrough formatting", () => {
      expect(convertMarkdown("~~strikethrough text~~", "markdown")).toBe(
        "~~strikethrough text~~"
      );
    });

    it("handles mixed formatting", () => {
      expect(
        convertMarkdown("**bold** and *italic* and ~~strike~~", "markdown")
      ).toBe("**bold** and *italic* and ~~strike~~");
    });
  });

  describe("platform: slack", () => {
    it("converts bold to slack format", () => {
      expect(convertMarkdown("**bold text**", "slack")).toBe("*bold text*");
    });

    it("converts italic to slack format", () => {
      expect(convertMarkdown("*italic text*", "slack")).toBe("_italic text_");
    });

    it("converts strikethrough to slack format", () => {
      expect(convertMarkdown("~~strikethrough text~~", "slack")).toBe(
        "~strikethrough text~"
      );
    });

    it("handles mixed formatting", () => {
      expect(
        convertMarkdown("**bold** and *italic* and ~~strike~~", "slack")
      ).toBe("*bold* and _italic_ and ~strike~");
    });
  });

  describe("platform: discord", () => {
    it("preserves bold formatting", () => {
      expect(convertMarkdown("**bold text**", "discord")).toBe("**bold text**");
    });

    it("preserves italic formatting", () => {
      expect(convertMarkdown("*italic text*", "discord")).toBe("*italic text*");
    });

    it("preserves strikethrough formatting", () => {
      expect(convertMarkdown("~~strikethrough text~~", "discord")).toBe(
        "~~strikethrough text~~"
      );
    });

    it("handles mixed formatting", () => {
      expect(
        convertMarkdown("**bold** and *italic* and ~~strike~~", "discord")
      ).toBe("**bold** and *italic* and ~~strike~~");
    });
  });

  describe("platform: plaintext", () => {
    it("strips all formatting", () => {
      expect(convertMarkdown("**bold text**", "plaintext")).toBe("bold text");
    });

    it("strips italic formatting", () => {
      expect(convertMarkdown("*italic text*", "plaintext")).toBe("italic text");
    });

    it("strips strikethrough formatting", () => {
      expect(convertMarkdown("~~strikethrough text~~", "plaintext")).toBe(
        "strikethrough text"
      );
    });

    it("strips mixed formatting", () => {
      expect(
        convertMarkdown("**bold** and *italic* and ~~strike~~", "plaintext")
      ).toBe("bold and italic and strike");
    });
  });

  describe("edge cases", () => {
    it("handles text without formatting", () => {
      expect(convertMarkdown("plain text", "markdown")).toBe("plain text");
      expect(convertMarkdown("plain text", "slack")).toBe("plain text");
      expect(convertMarkdown("plain text", "discord")).toBe("plain text");
      expect(convertMarkdown("plain text", "plaintext")).toBe("plain text");
    });

    it("handles empty string", () => {
      expect(convertMarkdown("", "markdown")).toBe("");
      expect(convertMarkdown("", "slack")).toBe("");
      expect(convertMarkdown("", "discord")).toBe("");
      expect(convertMarkdown("", "plaintext")).toBe("");
    });

    it("handles nested formatting correctly", () => {
      // Bold should be processed first, so **text** doesn't get matched as italic
      expect(convertMarkdown("**bold**", "markdown")).toBe("**bold**");
      expect(convertMarkdown("**bold**", "slack")).toBe("*bold*");
    });

    it("handles multiple bold sections", () => {
      expect(convertMarkdown("**first** and **second**", "markdown")).toBe(
        "**first** and **second**"
      );
      expect(convertMarkdown("**first** and **second**", "slack")).toBe(
        "*first* and *second*"
      );
    });

    it("handles multiple italic sections", () => {
      expect(convertMarkdown("*first* and *second*", "markdown")).toBe(
        "*first* and *second*"
      );
      expect(convertMarkdown("*first* and *second*", "slack")).toBe(
        "_first_ and _second_"
      );
    });
  });
});

describe("stripMarkdown", () => {
  it("removes bold formatting", () => {
    expect(stripMarkdown("**bold text**")).toBe("bold text");
  });

  it("removes italic formatting", () => {
    expect(stripMarkdown("*italic text*")).toBe("italic text");
  });

  it("removes strikethrough formatting", () => {
    expect(stripMarkdown("~~strikethrough text~~")).toBe("strikethrough text");
  });

  it("removes all formatting from mixed text", () => {
    expect(stripMarkdown("**bold** and *italic* and ~~strike~~")).toBe(
      "bold and italic and strike"
    );
  });

  it("preserves plain text", () => {
    expect(stripMarkdown("plain text")).toBe("plain text");
  });

  it("handles empty string", () => {
    expect(stripMarkdown("")).toBe("");
  });

  it("handles text with asterisks that are not formatting", () => {
    expect(stripMarkdown("Price: $10 * tax")).toBe("Price: $10 * tax");
  });

  it("handles multiple formatting instances", () => {
    expect(stripMarkdown("**first** **second**")).toBe("first second");
    expect(stripMarkdown("*first* *second*")).toBe("first second");
    expect(stripMarkdown("~~first~~ ~~second~~")).toBe("first second");
  });

  it("does not match ** as italic", () => {
    expect(stripMarkdown("**bold**")).toBe("bold");
    expect(stripMarkdown("**")).toBe("**");
  });
});
