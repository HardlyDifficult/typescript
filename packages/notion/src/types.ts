export type NotionApiVersion = "2022-06-28" | "2025-09-03" | (string & {});

export type NotionColor =
  | "default"
  | "gray"
  | "brown"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "red"
  | "gray_background"
  | "brown_background"
  | "orange_background"
  | "yellow_background"
  | "green_background"
  | "blue_background"
  | "purple_background"
  | "pink_background"
  | "red_background";

export interface NotionAnnotations {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  code?: boolean;
  color?: NotionColor;
}

export interface NotionRichText {
  type: "text";
  text: { content: string; link?: { url: string } | null };
  annotations?: NotionAnnotations;
  plain_text?: string;
  href?: string | null;
}

export interface NotionTitleProperty {
  title: NotionRichText[];
}

export interface NotionRichTextProperty {
  rich_text: NotionRichText[];
}

export interface NotionSelectProperty {
  select: { name: string } | null;
}

export interface NotionStatusProperty {
  status: { name: string } | null;
}

export interface NotionDateProperty {
  date: { start: string; end?: string | null; time_zone?: string | null } | null;
}

export interface NotionNumberProperty {
  number: number | null;
}

export interface NotionCheckboxProperty {
  checkbox: boolean;
}

export interface NotionUrlProperty {
  url: string | null;
}

export interface NotionEmailProperty {
  email: string | null;
}

export interface NotionPhoneNumberProperty {
  phone_number: string | null;
}

export interface NotionMultiSelectProperty {
  multi_select: Array<{ name: string }>;
}

export interface NotionRelationProperty {
  relation: Array<{ id: string }>;
}

export interface NotionPeopleProperty {
  people: Array<{ id: string }>;
}

export type NotionPropertyValue =
  | NotionTitleProperty
  | NotionRichTextProperty
  | NotionSelectProperty
  | NotionStatusProperty
  | NotionDateProperty
  | NotionNumberProperty
  | NotionCheckboxProperty
  | NotionUrlProperty
  | NotionEmailProperty
  | NotionPhoneNumberProperty
  | NotionMultiSelectProperty
  | NotionRelationProperty
  | NotionPeopleProperty;

export interface NotionEmojiIcon {
  type: "emoji";
  emoji: string;
}

export interface NotionExternalFileRef {
  type: "external";
  external: { url: string };
  caption?: NotionRichText[];
}

export interface NotionHostedFileRef {
  type: "file";
  file: { url: string; expiry_time?: string };
  caption?: NotionRichText[];
}

export type NotionFileRef = NotionExternalFileRef | NotionHostedFileRef;
export type NotionIcon = NotionEmojiIcon | NotionFileRef;

export interface NotionBaseBlock {
  object: "block";
  id?: string;
  has_children?: boolean;
  archived?: boolean;
  in_trash?: boolean;
}

export interface NotionParagraphBlock extends NotionBaseBlock {
  type: "paragraph";
  paragraph: { rich_text: NotionRichText[]; color?: NotionColor; children?: NotionBlock[] };
}

export interface NotionHeading1Block extends NotionBaseBlock {
  type: "heading_1";
  heading_1: { rich_text: NotionRichText[]; color?: NotionColor; is_toggleable?: boolean };
}

export interface NotionHeading2Block extends NotionBaseBlock {
  type: "heading_2";
  heading_2: { rich_text: NotionRichText[]; color?: NotionColor; is_toggleable?: boolean };
}

export interface NotionHeading3Block extends NotionBaseBlock {
  type: "heading_3";
  heading_3: { rich_text: NotionRichText[]; color?: NotionColor; is_toggleable?: boolean };
}

export interface NotionBulletedListItemBlock extends NotionBaseBlock {
  type: "bulleted_list_item";
  bulleted_list_item: { rich_text: NotionRichText[]; color?: NotionColor; children?: NotionBlock[] };
}

export interface NotionNumberedListItemBlock extends NotionBaseBlock {
  type: "numbered_list_item";
  numbered_list_item: { rich_text: NotionRichText[]; color?: NotionColor; children?: NotionBlock[] };
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
  toggle: { rich_text: NotionRichText[]; color?: NotionColor; children?: NotionBlock[] };
}

export interface NotionQuoteBlock extends NotionBaseBlock {
  type: "quote";
  quote: { rich_text: NotionRichText[]; color?: NotionColor; children?: NotionBlock[] };
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
  synced_block: { synced_from?: { block_id: string } | null; children?: NotionBlock[] };
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

export interface NotionDatabaseParent {
  type: "database_id";
  database_id: string;
}

export interface NotionDataSourceParent {
  type: "data_source_id";
  data_source_id: string;
}

export interface NotionPageParent {
  type: "page_id";
  page_id: string;
}

export interface NotionWorkspaceParent {
  type: "workspace";
  workspace: true;
}

export type NotionParent =
  | NotionDatabaseParent
  | NotionDataSourceParent
  | NotionPageParent
  | NotionWorkspaceParent;

export interface CreatePageRequest {
  parent: NotionParent | { database_id: string } | { page_id: string } | { workspace: true };
  properties?: Record<string, NotionPropertyValue>;
  children?: NotionBlock[];
  markdown?: string;
}

export interface NotionPagePropertyMap {
  [key: string]: {
    id?: string;
    type?: string;
    [key: string]: unknown;
  };
}

export interface NotionPageResponse {
  object?: "page";
  id: string;
  url: string;
  parent?: NotionParent | Record<string, unknown>;
  properties?: NotionPagePropertyMap;
  last_edited_time?: string;
  created_time?: string;
  archived?: boolean;
  in_trash?: boolean;
  icon?: NotionIcon | null;
  cover?: Record<string, unknown> | null;
}

export interface NotionPageMeta {
  id: string;
  title: string;
  url: string;
  lastEdited: string | null;
  createdTime: string | null;
  archived: boolean;
  inTrash: boolean;
  parent?: NotionParent | Record<string, unknown>;
  properties: NotionPagePropertyMap;
  icon?: NotionIcon | null;
  cover?: Record<string, unknown> | null;
}

export interface NotionPageMarkdownResponse {
  object: "page_markdown";
  id: string;
  markdown: string;
  truncated: boolean;
  unknown_block_ids: string[];
}

export interface NotionPageContent extends NotionPageMeta {
  markdown: string;
  truncated: boolean;
  unknownBlockIds: string[];
}

export interface NotionPageSearchResult extends NotionPageMeta {
  object?: "page";
}

export interface AppendBlocksRequest {
  children: NotionBlock[];
}

export interface NotionListResponse<T> {
  object: "list";
  results: T[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface NotionSearchFilter {
  property: "object";
  value: "page" | "data_source";
}

export interface NotionSearchSort {
  direction: "ascending" | "descending";
  timestamp: "last_edited_time";
}

export interface SearchPagesOptions {
  limit?: number;
  pageSize?: number;
  startCursor?: string;
  filter?: NotionSearchFilter;
  sort?: NotionSearchSort;
}

export interface RetrieveBlockChildrenOptions {
  recursive?: boolean;
  pageSize?: number;
  startCursor?: string;
}

export interface ReadPageOptions {
  includeTranscript?: boolean;
  fallbackToBlocks?: boolean;
}

export interface InsertContentMarkdownRequest {
  type: "insert_content";
  insert_content: {
    content: string;
    after?: string;
  };
}

export interface ReplaceContentRangeMarkdownRequest {
  type: "replace_content_range";
  replace_content_range: {
    content: string;
    content_range: string;
    allow_deleting_content?: boolean;
  };
}

export type UpdatePageMarkdownRequest =
  | InsertContentMarkdownRequest
  | ReplaceContentRangeMarkdownRequest;

export interface UpdatePageOptions {
  replace?: boolean;
  after?: string;
  contentRange?: string;
  allowDeletingContent?: boolean;
}
