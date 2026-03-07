import type {
  NotionBlock,
  NotionCheckboxProperty,
  NotionDatabaseParent,
  NotionDataSourceParent,
  NotionDateInput,
  NotionDateProperty,
  NotionEmailProperty,
  NotionMarkdownContent,
  NotionMarkdownRenderable,
  NotionMultiSelectProperty,
  NotionNumberProperty,
  NotionPageBody,
  NotionPageDraft,
  NotionPageParent,
  NotionPeopleProperty,
  NotionPhoneNumberProperty,
  NotionPropertyInput,
  NotionPropertyValue,
  NotionRelationProperty,
  NotionRichText,
  NotionRichTextProperty,
  NotionSelectProperty,
  NotionStatusProperty,
  NotionStructuredPropertyInput,
  NotionTitleProperty,
  NotionUrlProperty,
  NotionWorkspaceParent,
} from "./types.js";

function requireValue(value: string, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function toRichText(content: string): NotionRichText[] {
  return [{ type: "text", text: { content } }];
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const RAW_PROPERTY_KEYS = [
  "title",
  "rich_text",
  "select",
  "status",
  "date",
  "number",
  "checkbox",
  "url",
  "email",
  "phone_number",
  "multi_select",
  "relation",
  "people",
] as const;

function isRawPropertyValue(value: unknown): value is NotionPropertyValue {
  return isRecord(value) && RAW_PROPERTY_KEYS.some((key) => key in value);
}

function isStructuredPropertyInput(
  value: unknown
): value is NotionStructuredPropertyInput {
  return isRecord(value) && typeof value.type === "string" && "value" in value;
}

function normalizeDateInput(
  value: string | Date | NotionDateInput | null
): NotionDateProperty {
  if (value === null) {
    return { date: null };
  }

  if (typeof value === "string" || value instanceof Date) {
    return {
      date: {
        start: toIsoString(value),
      },
    };
  }

  return {
    date: {
      start: toIsoString(value.start),
      ...(value.end !== undefined
        ? { end: value.end === null ? null : toIsoString(value.end) }
        : {}),
      ...(value.timeZone !== undefined ? { time_zone: value.timeZone } : {}),
    },
  };
}

export const notionParent = {
  database(databaseId: string): NotionDatabaseParent {
    return {
      type: "database_id",
      database_id: requireValue(databaseId, "databaseId"),
    };
  },

  dataSource(dataSourceId: string): NotionDataSourceParent {
    return {
      type: "data_source_id",
      data_source_id: requireValue(dataSourceId, "dataSourceId"),
    };
  },

  page(pageId: string): NotionPageParent {
    return {
      type: "page_id",
      page_id: requireValue(pageId, "pageId"),
    };
  },

  workspace(): NotionWorkspaceParent {
    return {
      type: "workspace",
      workspace: true,
    };
  },
} as const;

export const notionProperty = {
  title(content: string): NotionTitleProperty {
    return { title: toRichText(content) };
  },

  richText(content: string): NotionRichTextProperty {
    return { rich_text: toRichText(content) };
  },

  text(content: string): NotionRichTextProperty {
    return this.richText(content);
  },

  select(name: string | null): NotionSelectProperty {
    return {
      select: name === null ? null : { name: requireValue(name, "select name") },
    };
  },

  status(name: string | null): NotionStatusProperty {
    return {
      status: name === null ? null : { name: requireValue(name, "status name") },
    };
  },

  date(
    start: Date | string | null,
    end?: Date | string | null,
    timeZone?: string | null
  ): NotionDateProperty {
    if (start === null) {
      return { date: null };
    }

    return normalizeDateInput({
      start,
      ...(end !== undefined ? { end } : {}),
      ...(timeZone !== undefined ? { timeZone } : {}),
    });
  },

  number(value: number | null): NotionNumberProperty {
    return { number: value };
  },

  checkbox(checked: boolean): NotionCheckboxProperty {
    return { checkbox: checked };
  },

  url(url: string | null): NotionUrlProperty {
    return { url };
  },

  email(email: string | null): NotionEmailProperty {
    return { email };
  },

  phoneNumber(phoneNumber: string | null): NotionPhoneNumberProperty {
    return { phone_number: phoneNumber };
  },

  multiSelect(...names: string[]): NotionMultiSelectProperty {
    return {
      multi_select: names.map((name) => ({
        name: requireValue(name, "multi-select name"),
      })),
    };
  },

  relation(...ids: string[]): NotionRelationProperty {
    return {
      relation: ids.map((id) => ({ id: requireValue(id, "relation id") })),
    };
  },

  people(...ids: string[]): NotionPeopleProperty {
    return {
      people: ids.map((id) => ({ id: requireValue(id, "person id") })),
    };
  },

  raw(value: NotionPropertyValue): NotionPropertyValue {
    return value;
  },
} as const;

/**
 * Convert markdown content helpers into a raw markdown string payload.
 */
export function toMarkdownContent(content: NotionMarkdownContent): string {
  return typeof content === "string" ? content : content.toMarkdown();
}

/**
 * Normalize page body input to markdown text or Notion blocks.
 */
export function toPageBody(
  content?: NotionPageBody
): string | NotionBlock[] | undefined {
  if (content === undefined || Array.isArray(content)) {
    return content;
  }

  return toMarkdownContent(content);
}

/**
 * Convert user-friendly property input values into Notion API property payloads.
 */
export function toPropertyValue(
  propertyName: string,
  value: NotionPropertyInput
): NotionPropertyValue {
  if (isRawPropertyValue(value)) {
    return value;
  }

  if (typeof value === "string") {
    return notionProperty.richText(value);
  }

  if (typeof value === "number") {
    return notionProperty.number(value);
  }

  if (typeof value === "boolean") {
    return notionProperty.checkbox(value);
  }

  if (value instanceof Date) {
    return notionProperty.date(value);
  }

  if (Array.isArray(value)) {
    if (!value.every((item) => typeof item === "string")) {
      throw new Error(
        `Notion property "${propertyName}" only supports string arrays for implicit multi-select values`
      );
    }

    return notionProperty.multiSelect(...value);
  }

  if (!isStructuredPropertyInput(value)) {
    throw new Error(
      `Unsupported Notion property input for "${propertyName}". Use a primitive, notionProperty helper, or raw Notion property payload.`
    );
  }

  switch (value.type) {
    case "title":
      return notionProperty.title(value.value);
    case "text":
      return value.value === null
        ? { rich_text: [] }
        : notionProperty.richText(value.value);
    case "select":
      return notionProperty.select(value.value);
    case "status":
      return notionProperty.status(value.value);
    case "date":
      return normalizeDateInput(value.value);
    case "number":
      return notionProperty.number(value.value);
    case "checkbox":
      return notionProperty.checkbox(value.value);
    case "url":
      return notionProperty.url(value.value);
    case "email":
      return notionProperty.email(value.value);
    case "phone_number":
      return notionProperty.phoneNumber(value.value);
    case "multi_select":
      return notionProperty.multiSelect(...value.value);
    case "relation":
      return notionProperty.relation(...value.value);
    case "people":
      return notionProperty.people(...value.value);
    default:
      return assertUnreachable(value, propertyName);
  }
}

/**
 * Normalize a map of property inputs into Notion API-ready property values.
 */
export function normalizeProperties(
  properties: Record<string, NotionPropertyInput>
): Record<string, NotionPropertyValue> {
  return Object.fromEntries(
    Object.entries(properties).map(([name, value]) => [
      name,
      toPropertyValue(name, value),
    ])
  );
}

/**
 * Identify page draft payloads that already include a parent descriptor.
 */
export function isPageDraft(value: unknown): value is NotionPageDraft {
  return isRecord(value) && "parent" in value;
}

/**
 * Identify values that expose a markdown rendering contract.
 */
export function isMarkdownRenderable(
  value: unknown
): value is NotionMarkdownRenderable {
  return (
    isRecord(value) &&
    "toMarkdown" in value &&
    typeof value.toMarkdown === "function"
  );
}

function assertUnreachable(
  value: never,
  propertyName: string
): NotionPropertyValue {
  throw new Error(
    `Unsupported Notion property helper for "${propertyName}": ${JSON.stringify(value)}`
  );
}
