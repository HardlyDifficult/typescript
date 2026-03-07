import type { NotionColor } from "./common.js";

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
  date: {
    start: string;
    end?: string | null;
    time_zone?: string | null;
  } | null;
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
  multi_select: { name: string }[];
}

export interface NotionRelationProperty {
  relation: { id: string }[];
}

export interface NotionPeopleProperty {
  people: { id: string }[];
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

export interface NotionDateInput {
  start: string | Date;
  end?: string | Date | null;
  timeZone?: string | null;
}

export interface NotionTitleInput {
  type: "title";
  value: string;
}

export interface NotionTextInput {
  type: "text";
  value: string | null;
}

export interface NotionSelectInput {
  type: "select";
  value: string | null;
}

export interface NotionStatusInput {
  type: "status";
  value: string | null;
}

export interface NotionDatePropertyInput {
  type: "date";
  value: string | Date | NotionDateInput | null;
}

export interface NotionNumberInput {
  type: "number";
  value: number | null;
}

export interface NotionCheckboxInput {
  type: "checkbox";
  value: boolean;
}

export interface NotionUrlInput {
  type: "url";
  value: string | null;
}

export interface NotionEmailInput {
  type: "email";
  value: string | null;
}

export interface NotionPhoneNumberInput {
  type: "phone_number";
  value: string | null;
}

export interface NotionMultiSelectInput {
  type: "multi_select";
  value: string[];
}

export interface NotionRelationInput {
  type: "relation";
  value: string[];
}

export interface NotionPeopleInput {
  type: "people";
  value: string[];
}

export type NotionStructuredPropertyInput =
  | NotionTitleInput
  | NotionTextInput
  | NotionSelectInput
  | NotionStatusInput
  | NotionDatePropertyInput
  | NotionNumberInput
  | NotionCheckboxInput
  | NotionUrlInput
  | NotionEmailInput
  | NotionPhoneNumberInput
  | NotionMultiSelectInput
  | NotionRelationInput
  | NotionPeopleInput;

export type NotionPropertyInput =
  | NotionPropertyValue
  | NotionStructuredPropertyInput
  | string
  | number
  | boolean
  | string[]
  | Date;

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
