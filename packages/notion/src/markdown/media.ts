import type { NotionBlock } from "../types.js";

import { richTextFromMarkdown } from "./richText.js";

/** Parses media, embed, bookmark, and child object shortcuts. */
export function parseMediaBlock(line: string): NotionBlock | null {
  const imageMatch = /^!\[(.*)\]\((.+)\)\s*$/.exec(line.trim());
  if (imageMatch !== null) {
    return {
      object: "block",
      type: "image",
      image: {
        type: "external",
        external: { url: imageMatch[2] },
        caption:
          imageMatch[1].length > 0
            ? richTextFromMarkdown(imageMatch[1])
            : undefined,
      },
    };
  }

  const taggedMedia =
    /^<(file|video|audio|pdf|embed|bookmark)\s+src="([^"]+)"(?:\s+caption="([^"]*)")?\s*\/?>$/i.exec(
      line.trim()
    );
  if (taggedMedia !== null) {
    const captionText = taggedMedia.at(3) ?? "";
    const caption =
      captionText.length > 0 ? richTextFromMarkdown(captionText) : undefined;
    switch (taggedMedia[1].toLowerCase()) {
      case "file":
        return {
          object: "block",
          type: "file",
          file: {
            type: "external",
            external: { url: taggedMedia[2] },
            caption,
          },
        };
      case "video":
        return {
          object: "block",
          type: "video",
          video: {
            type: "external",
            external: { url: taggedMedia[2] },
            caption,
          },
        };
      case "audio":
        return {
          object: "block",
          type: "audio",
          audio: {
            type: "external",
            external: { url: taggedMedia[2] },
            caption,
          },
        };
      case "pdf":
        return {
          object: "block",
          type: "pdf",
          pdf: { type: "external", external: { url: taggedMedia[2] }, caption },
        };
      case "embed":
        return {
          object: "block",
          type: "embed",
          embed: { url: taggedMedia[2], caption },
        };
      default:
        return {
          object: "block",
          type: "bookmark",
          bookmark: { url: taggedMedia[2], caption },
        };
    }
  }

  const childPage = /^<page\s+title="([^"]+)"(?:\s+url="([^"]+)")?\s*\/>$/.exec(
    line.trim()
  );
  if (childPage !== null) {
    return {
      object: "block",
      type: "child_page",
      child_page: {
        title: childPage[1],
        url: childPage[2],
      },
    };
  }

  const childDatabase =
    /^<database\s+title="([^"]+)"(?:\s+url="([^"]+)")?\s*\/>$/.exec(
      line.trim()
    );
  if (childDatabase !== null) {
    return {
      object: "block",
      type: "child_database",
      child_database: {
        title: childDatabase[1],
        url: childDatabase[2],
      },
    };
  }

  return null;
}
