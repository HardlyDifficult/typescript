export interface NotionRichText {
  type: "text";
  text: { content: string; link?: { url: string } | null };
}

export interface NotionTitleProperty {
  title: NotionRichText[];
}

export interface NotionRichTextProperty {
  rich_text: NotionRichText[];
}

export interface NotionSelectProperty {
  select: { name: string };
}

export interface NotionDateProperty {
  date: { start: string };
}

export type NotionPropertyValue =
  | NotionTitleProperty
  | NotionRichTextProperty
  | NotionSelectProperty
  | NotionDateProperty;

export interface NotionParagraphBlock {
  object: "block";
  type: "paragraph";
  paragraph: { rich_text: NotionRichText[] };
}

export interface NotionHeading2Block {
  object: "block";
  type: "heading_2";
  heading_2: { rich_text: NotionRichText[] };
}

export type NotionBlock = NotionParagraphBlock | NotionHeading2Block;

export interface CreatePageRequest {
  parent: { database_id: string };
  properties: Record<string, NotionPropertyValue>;
  children?: NotionBlock[];
}

export interface NotionPageResponse {
  id: string;
  url: string;
}

export interface AppendBlocksRequest {
  children: NotionBlock[];
}
