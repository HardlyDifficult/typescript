import { describe, it, expect } from "vitest";
import {
  Document,
  toMarkdown,
  toPlainText,
  toSlack,
  toSlackText,
  convertMarkdown,
  stripMarkdown,
} from "../src/index.js";
import type {
  Block,
  HeaderBlock,
  TextBlock,
  ListBlock,
  DividerBlock,
  ContextBlock,
  LinkBlock,
  CodeBlock,
  ImageBlock,
  Platform,
  StringOutputFormat,
  DocumentOptions,
  DocumentSection,
  DocumentLinkTransform,
  DocumentLinkifyOptions,
  SectionContent,
  SectionOptions,
  FieldOptions,
  KeyValueOptions,
  TruncatedListOptions,
  TimestampOptions,
} from "../src/index.js";

describe("index.ts exports", () => {
  it("exports Document class", () => {
    const doc = new Document();
    expect(doc).toBeInstanceOf(Document);
  });

  it("exports toMarkdown function", () => {
    const blocks: Block[] = [{ type: "text", content: "hello" }];
    expect(toMarkdown(blocks)).toBe("hello\n\n");
  });

  it("exports toPlainText function", () => {
    const blocks: Block[] = [{ type: "text", content: "hello" }];
    expect(toPlainText(blocks)).toBe("hello\n\n");
  });

  it("exports toSlack and toSlackText functions", () => {
    const blocks: Block[] = [{ type: "text", content: "hello" }];
    expect(toSlackText(blocks)).toBe("hello\n\n");
    expect(toSlack(blocks)).toBe(toSlackText(blocks));
  });

  it("exports convertMarkdown function", () => {
    expect(convertMarkdown("**bold**", "slack")).toBe("*bold*");
  });

  it("exports stripMarkdown function", () => {
    expect(stripMarkdown("**bold**")).toBe("bold");
  });

  it("type exports are usable (DocumentOptions)", () => {
    const opts: DocumentOptions = { header: "Test" };
    const doc = new Document(opts);
    expect(doc.getBlocks()[0]).toEqual({ type: "header", text: "Test" });
  });

  it("type exports are usable (DocumentSection)", () => {
    const section: DocumentSection = { title: "My Section", content: "text" };
    const doc = new Document({ sections: [section] });
    expect(doc.getBlocks()).toHaveLength(3);
  });

  it("type exports: StringOutputFormat", () => {
    const format: StringOutputFormat = "markdown";
    const doc = new Document().text("hi");
    expect(doc.render(format)).toBe("hi\n\n");
  });

  it("type exports: Platform", () => {
    const platform: Platform = "slack";
    expect(convertMarkdown("**bold**", platform)).toBe("*bold*");
  });

  it("type exports: block types are compatible with Block union", () => {
    const header: HeaderBlock = { type: "header", text: "H" };
    const text: TextBlock = { type: "text", content: "T" };
    const list: ListBlock = { type: "list", items: ["a"] };
    const divider: DividerBlock = { type: "divider" };
    const context: ContextBlock = { type: "context", text: "C" };
    const link: LinkBlock = { type: "link", text: "L", url: "https://x.com" };
    const code: CodeBlock = { type: "code", content: "c", multiline: false };
    const image: ImageBlock = { type: "image", url: "https://x.com/img.png" };

    const blocks: Block[] = [header, text, list, divider, context, link, code, image];
    expect(toMarkdown(blocks)).toContain("# H");
  });

  it("type exports: SectionOptions, FieldOptions, KeyValueOptions, TruncatedListOptions, TimestampOptions", () => {
    const sectionOpts: SectionOptions = { emptyText: "None", ordered: true, divider: true };
    const fieldOpts: FieldOptions = { separator: "=", bold: false, emptyText: "N/A" };
    const kvOpts: KeyValueOptions = { style: "bullet", separator: ":", bold: true };
    const truncOpts: TruncatedListOptions<string> = {
      limit: 5,
      format: (s) => s,
      moreText: (n) => `+${n}`,
      ordered: true,
    };
    const tsOpts: TimestampOptions = { emoji: false, label: "At" };

    // Create doc exercising these options
    const doc = new Document()
      .section("Test", [], sectionOpts)
      .field("Key", "", fieldOpts)
      .keyValue({ A: "1" }, kvOpts)
      .truncatedList(["x", "y"], truncOpts)
      .timestamp(tsOpts);

    expect(doc.isEmpty()).toBe(false);
  });

  it("type exports: DocumentLinkTransform and DocumentLinkifyOptions", () => {
    const transform: DocumentLinkTransform = (value: string) => value.toUpperCase();
    const linkifyOpts: DocumentLinkifyOptions = { platform: "slack" };
    const doc = new Document().text("hello");
    doc.linkify(transform, linkifyOpts);
    expect(doc.getBlocks()[0]).toEqual({ type: "text", content: "HELLO" });
  });

  it("type exports: SectionContent", () => {
    const content1: SectionContent = "text content";
    const content2: SectionContent = ["item1", "item2"];
    const doc = new Document()
      .section("S1", content1)
      .section("S2", content2);
    expect(doc.getBlocks()).toHaveLength(2);
  });
});
