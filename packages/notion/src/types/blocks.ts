import type { NotionColor } from "./common.js";
import type {
  NotionFileRef,
  NotionIcon,
  NotionRichText,
} from "./properties.js";

export interface NotionBaseBlock {
  object: "block";
  id?: string;
  has_children?: boolean;
  archived?: boolean;
  in_trash?: boolean;
}

export interface NotionParagraphBlock extends NotionBaseBlock {
  type: "paragraph";
  paragraph: {
    rich_text: NotionRichText[];
    color?: NotionColor;
    children?: NotionBlock[];
  };
}

export interface NotionHeading1Block extends NotionBaseBlock {
  type: "heading_1";
  heading_1: {
    rich_text: NotionRichText[];
    color?: NotionColor;
    is_toggleable?: boolean;
  };
}

export interface NotionHeading2Block extends NotionBaseBlock {
  type: "heading_2";
  heading_2: {
    rich_text: NotionRichText[];
    color?: NotionColor;
    is_toggleable?: boolean;
  };
}

export interface NotionHeading3Block extends NotionBaseBlock {
  type: "heading_3";
  heading_3: {
    rich_text: NotionRichText[];
    color?: NotionColor;
    is_toggleable?: boolean;
  };
}

export interface NotionBulletedListItemBlock extends NotionBaseBlock {
  type: "bulleted_list_item";
  bulleted_list_item: {
    rich_text: NotionRichText[];
    color?: NotionColor;
    children?: NotionBlock[];
  };
}

export interface NotionNumberedListItemBlock extends NotionBaseBlock {
  type: "numbered_list_item";
  numbered_list_item: {
    rich_text: NotionRichText[];
    color?: NotionColor;
    children?: NotionBlock[];
  };
}

export interface NotionToDoBlock extends NotionBaseBlock {
  type: "to_do";
  to_do: {
    rich_text: NotionRichText[];
    checked: boolean;
    color?: NotionColor;
    children?: NotionBlock[];
  };
}

export interface NotionToggleBlock extends NotionBaseBlock {
  type: "toggle";
  toggle: {
    rich_text: NotionRichText[];
    color?: NotionColor;
    children?: NotionBlock[];
  };
}

export interface NotionQuoteBlock extends NotionBaseBlock {
  type: "quote";
  quote: {
    rich_text: NotionRichText[];
    color?: NotionColor;
    children?: NotionBlock[];
  };
}

export interface NotionCalloutBlock extends NotionBaseBlock {
  type: "callout";
  callout: {
    rich_text: NotionRichText[];
    color?: NotionColor;
    icon?: NotionIcon;
    children?: NotionBlock[];
  };
}

export interface NotionDividerBlock extends NotionBaseBlock {
  type: "divider";
  divider: Record<string, never>;
}

export interface NotionCodeBlock extends NotionBaseBlock {
  type: "code";
  code: {
    rich_text: NotionRichText[];
    language?: string;
    caption?: NotionRichText[];
  };
}

export interface NotionEquationBlock extends NotionBaseBlock {
  type: "equation";
  equation: { expression: string };
}

export interface NotionImageBlock extends NotionBaseBlock {
  type: "image";
  image: NotionFileRef;
}

export interface NotionFileBlock extends NotionBaseBlock {
  type: "file";
  file: NotionFileRef;
}

export interface NotionVideoBlock extends NotionBaseBlock {
  type: "video";
  video: NotionFileRef;
}

export interface NotionAudioBlock extends NotionBaseBlock {
  type: "audio";
  audio: NotionFileRef;
}

export interface NotionPdfBlock extends NotionBaseBlock {
  type: "pdf";
  pdf: NotionFileRef;
}

export interface NotionBookmarkBlock extends NotionBaseBlock {
  type: "bookmark";
  bookmark: { url: string; caption?: NotionRichText[] };
}

export interface NotionEmbedBlock extends NotionBaseBlock {
  type: "embed";
  embed: { url: string; caption?: NotionRichText[] };
}

export interface NotionChildPageBlock extends NotionBaseBlock {
  type: "child_page";
  child_page: { title: string; url?: string };
}

export interface NotionChildDatabaseBlock extends NotionBaseBlock {
  type: "child_database";
  child_database: { title: string; url?: string };
}

export interface NotionSyncedBlock extends NotionBaseBlock {
  type: "synced_block";
  synced_block: {
    synced_from?: { block_id: string } | null;
    children?: NotionBlock[];
  };
}

export interface NotionTableOfContentsBlock extends NotionBaseBlock {
  type: "table_of_contents";
  table_of_contents: { color?: NotionColor };
}

export interface NotionUnsupportedBlock extends NotionBaseBlock {
  type: "unsupported";
  original_type?: string;
  data?: Record<string, unknown>;
}

export type NotionBlock =
  | NotionParagraphBlock
  | NotionHeading1Block
  | NotionHeading2Block
  | NotionHeading3Block
  | NotionBulletedListItemBlock
  | NotionNumberedListItemBlock
  | NotionToDoBlock
  | NotionToggleBlock
  | NotionQuoteBlock
  | NotionCalloutBlock
  | NotionDividerBlock
  | NotionCodeBlock
  | NotionEquationBlock
  | NotionImageBlock
  | NotionFileBlock
  | NotionVideoBlock
  | NotionAudioBlock
  | NotionPdfBlock
  | NotionBookmarkBlock
  | NotionEmbedBlock
  | NotionChildPageBlock
  | NotionChildDatabaseBlock
  | NotionSyncedBlock
  | NotionTableOfContentsBlock
  | NotionUnsupportedBlock;
