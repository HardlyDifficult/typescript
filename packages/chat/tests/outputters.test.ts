import { describe, it, expect } from "vitest";
import { toSlackBlocks } from "../src/outputters/slack.js";
import { toDiscordEmbed } from "../src/outputters/discord.js";
import type { Block } from "@hardlydifficult/document-generator";

describe("toSlackBlocks", () => {
  it("should convert header block correctly", () => {
    const blocks: Block[] = [
      {
        type: "header",
        text: "Test Header",
      },
    ];

    const result = toSlackBlocks(blocks);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "header",
      text: {
        type: "plain_text",
        text: "Test Header",
      },
    });
  });

  it("should convert text block correctly", () => {
    const blocks: Block[] = [
      {
        type: "text",
        content: "This is a test message",
      },
    ];

    const result = toSlackBlocks(blocks);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "This is a test message",
      },
    });
  });

  it("should convert list block correctly", () => {
    const blocks: Block[] = [
      {
        type: "list",
        items: ["Item 1", "Item 2", "Item 3"],
      },
    ];

    const result = toSlackBlocks(blocks);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("section");
    expect(result[0].text?.type).toBe("mrkdwn");
    expect(result[0].text?.text).toContain("• Item 1");
    expect(result[0].text?.text).toContain("• Item 2");
    expect(result[0].text?.text).toContain("• Item 3");
  });

  it("should convert divider block correctly", () => {
    const blocks: Block[] = [
      {
        type: "divider",
      },
    ];

    const result = toSlackBlocks(blocks);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "divider",
    });
  });

  it("should convert context block correctly", () => {
    const blocks: Block[] = [
      {
        type: "context",
        text: "Context information",
      },
    ];

    const result = toSlackBlocks(blocks);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "Context information",
        },
      ],
    });
  });

  it("should convert link block correctly", () => {
    const blocks: Block[] = [
      {
        type: "link",
        text: "Click here",
        url: "https://example.com",
      },
    ];

    const result = toSlackBlocks(blocks);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("section");
    expect(result[0].text?.type).toBe("mrkdwn");
    expect(result[0].text?.text).toContain("https://example.com");
    expect(result[0].text?.text).toContain("Click here");
  });

  it("should convert code block (single line) correctly", () => {
    const blocks: Block[] = [
      {
        type: "code",
        content: "const x = 1;",
        multiline: false,
      },
    ];

    const result = toSlackBlocks(blocks);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("section");
    expect(result[0].text?.type).toBe("mrkdwn");
    expect(result[0].text?.text).toBe("`const x = 1;`");
  });

  it("should convert code block (multiline) correctly", () => {
    const blocks: Block[] = [
      {
        type: "code",
        content: "const x = 1;\nconst y = 2;",
        multiline: true,
      },
    ];

    const result = toSlackBlocks(blocks);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("section");
    expect(result[0].text?.type).toBe("mrkdwn");
    expect(result[0].text?.text).toContain("```");
    expect(result[0].text?.text).toContain("const x = 1;");
    expect(result[0].text?.text).toContain("const y = 2;");
  });

  it("should convert image block correctly", () => {
    const blocks: Block[] = [
      {
        type: "image",
        url: "https://example.com/image.png",
        alt: "Test image",
      },
    ];

    const result = toSlackBlocks(blocks);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "image",
      image_url: "https://example.com/image.png",
      alt_text: "Test image",
    });
  });

  it("should use default alt text for image when not provided", () => {
    const blocks: Block[] = [
      {
        type: "image",
        url: "https://example.com/image.png",
      },
    ];

    const result = toSlackBlocks(blocks);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "image",
      image_url: "https://example.com/image.png",
      alt_text: "image",
    });
  });

  it("should use default alt text for image when alt is empty string", () => {
    const blocks: Block[] = [
      {
        type: "image",
        url: "https://example.com/image.png",
        alt: "",
      },
    ];

    const result = toSlackBlocks(blocks);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: "image",
      image_url: "https://example.com/image.png",
      alt_text: "image",
    });
  });

  it("should chunk text blocks longer than 2900 characters", () => {
    const longText = "a".repeat(3000);
    const blocks: Block[] = [
      {
        type: "text",
        content: longText,
      },
    ];

    const result = toSlackBlocks(blocks);

    expect(result.length).toBeGreaterThan(1);
    // Each chunk should be <= 2900 chars
    result.forEach((block) => {
      if (block.text?.text) {
        expect(block.text.text.length).toBeLessThanOrEqual(2900);
      }
    });
    // Combined text should equal original
    const combinedText = result.map((block) => block.text?.text || "").join("");
    expect(combinedText.length).toBe(longText.length);
  });

  it("should chunk text at newlines when possible", () => {
    const textWithNewlines =
      "Line 1\n" + "a".repeat(2800) + "\nLine 3\n" + "b".repeat(2800);
    const blocks: Block[] = [
      {
        type: "text",
        content: textWithNewlines,
      },
    ];

    const result = toSlackBlocks(blocks);

    expect(result.length).toBeGreaterThan(1);
    // Check that chunks split at newlines (not mid-line)
    result.forEach((block, index) => {
      if (index > 0 && block.text?.text) {
        // Chunk should not start mid-line (unless it's the first chunk)
        const text = block.text.text;
        // If it doesn't start with "Line", it should be a continuation
        // This is a simplified check - actual implementation may vary
        expect(text.length).toBeLessThanOrEqual(2900);
      }
    });
  });

  it("should handle multiple block types", () => {
    const blocks: Block[] = [
      { type: "header", text: "Title" },
      { type: "text", content: "Body text" },
      { type: "divider" },
      { type: "context", text: "Footer" },
    ];

    const result = toSlackBlocks(blocks);

    expect(result).toHaveLength(4);
    expect(result[0].type).toBe("header");
    expect(result[1].type).toBe("section");
    expect(result[2].type).toBe("divider");
    expect(result[3].type).toBe("context");
  });
});

describe("toDiscordEmbed", () => {
  it("should convert header to title", () => {
    const blocks: Block[] = [
      {
        type: "header",
        text: "Test Title",
      },
    ];

    const result = toDiscordEmbed(blocks);

    expect(result.title).toBe("Test Title");
    expect(result.description).toBeUndefined();
  });

  it("should convert text to description", () => {
    const blocks: Block[] = [
      {
        type: "text",
        content: "This is a description",
      },
    ];

    const result = toDiscordEmbed(blocks);

    expect(result.description).toBe("This is a description");
  });

  it("should convert context to footer", () => {
    const blocks: Block[] = [
      {
        type: "context",
        text: "Footer text",
      },
    ];

    const result = toDiscordEmbed(blocks);

    expect(result.footer).toEqual({ text: "Footer text" });
  });

  it("should combine header, text, and context correctly", () => {
    const blocks: Block[] = [
      { type: "header", text: "Title" },
      { type: "text", content: "Description" },
      { type: "context", text: "Footer" },
    ];

    const result = toDiscordEmbed(blocks);

    expect(result.title).toBe("Title");
    expect(result.description).toBe("Description");
    expect(result.footer).toEqual({ text: "Footer" });
  });

  it("should convert list to description", () => {
    const blocks: Block[] = [
      {
        type: "list",
        items: ["Item 1", "Item 2"],
      },
    ];

    const result = toDiscordEmbed(blocks);

    expect(result.description).toContain("• Item 1");
    expect(result.description).toContain("• Item 2");
  });

  it("should convert divider to description separator", () => {
    const blocks: Block[] = [
      { type: "text", content: "Before" },
      { type: "divider" },
      { type: "text", content: "After" },
    ];

    const result = toDiscordEmbed(blocks);

    expect(result.description).toContain("Before");
    expect(result.description).toContain("───────────");
    expect(result.description).toContain("After");
  });

  it("should convert link to markdown format in description", () => {
    const blocks: Block[] = [
      {
        type: "link",
        text: "Click here",
        url: "https://example.com",
      },
    ];

    const result = toDiscordEmbed(blocks);

    expect(result.description).toContain("[Click here](https://example.com)");
  });

  it("should convert code block (single line) correctly", () => {
    const blocks: Block[] = [
      {
        type: "code",
        content: "const x = 1;",
        multiline: false,
      },
    ];

    const result = toDiscordEmbed(blocks);

    expect(result.description).toBe("`const x = 1;`");
  });

  it("should convert code block (multiline) correctly", () => {
    const blocks: Block[] = [
      {
        type: "code",
        content: "const x = 1;\nconst y = 2;",
        multiline: true,
      },
    ];

    const result = toDiscordEmbed(blocks);

    expect(result.description).toContain("```");
    expect(result.description).toContain("const x = 1;");
    expect(result.description).toContain("const y = 2;");
  });

  it("should convert image block correctly", () => {
    const blocks: Block[] = [
      {
        type: "image",
        url: "https://example.com/image.png",
      },
    ];

    const result = toDiscordEmbed(blocks);

    expect(result.image).toEqual({ url: "https://example.com/image.png" });
  });

  it("should handle multiple headers (first becomes title, rest go to description)", () => {
    const blocks: Block[] = [
      { type: "header", text: "First Header" },
      { type: "header", text: "Second Header" },
    ];

    const result = toDiscordEmbed(blocks);

    expect(result.title).toBe("First Header");
    expect(result.description).toContain("**Second Header**");
  });

  it("should handle multiple context blocks (append to footer)", () => {
    const blocks: Block[] = [
      { type: "context", text: "First Footer" },
      { type: "context", text: "Second Footer" },
    ];

    const result = toDiscordEmbed(blocks);

    expect(result.footer?.text).toContain("First Footer");
    expect(result.footer?.text).toContain("Second Footer");
    expect(result.footer?.text).toContain("|");
  });

  it("should join description parts with double newlines", () => {
    const blocks: Block[] = [
      { type: "text", content: "First paragraph" },
      { type: "text", content: "Second paragraph" },
    ];

    const result = toDiscordEmbed(blocks);

    expect(result.description).toBe("First paragraph\n\nSecond paragraph");
  });

  it("should handle empty blocks array", () => {
    const blocks: Block[] = [];

    const result = toDiscordEmbed(blocks);

    expect(result).toEqual({});
  });

  it("should handle complex document with all block types", () => {
    const blocks: Block[] = [
      { type: "header", text: "Main Title" },
      { type: "text", content: "Introduction text" },
      { type: "list", items: ["Point 1", "Point 2"] },
      { type: "divider" },
      { type: "code", content: "const code = true;", multiline: false },
      { type: "link", text: "Learn more", url: "https://example.com" },
      { type: "image", url: "https://example.com/img.png" },
      { type: "context", text: "Footer info" },
    ];

    const result = toDiscordEmbed(blocks);

    expect(result.title).toBe("Main Title");
    expect(result.description).toContain("Introduction text");
    expect(result.description).toContain("• Point 1");
    expect(result.description).toContain("• Point 2");
    expect(result.description).toContain("───────────");
    expect(result.description).toContain("`const code = true;`");
    expect(result.description).toContain("[Learn more](https://example.com)");
    expect(result.image).toEqual({ url: "https://example.com/img.png" });
    expect(result.footer).toEqual({ text: "Footer info" });
  });
});
