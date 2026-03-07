import type { NotionApiVersion } from "../types.js";
import { NotionApiError } from "../NotionApiError.js";

import type { RequestOptions } from "./types.js";

const NOTION_API_BASE = "https://api.notion.com/v1";

export interface BaseNotionClientOptions {
  apiToken: string;
  fetchImpl?: typeof fetch;
  apiVersion?: NotionApiVersion;
}

/** Shared request plumbing for the Notion client. */
export class BaseNotionClient {
  protected readonly apiToken: string;
  protected readonly fetchImpl: typeof fetch;
  protected readonly apiVersion: NotionApiVersion;

  constructor(options: BaseNotionClientOptions) {
    if (options.apiToken.trim() === "") {
      throw new Error("Notion API token is required");
    }
    this.apiToken = options.apiToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.apiVersion = options.apiVersion ?? "2022-06-28";
  }

  protected getHeaders(
    notionVersion: NotionApiVersion
  ): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
      "Content-Type": "application/json",
      "Notion-Version": notionVersion,
    };
  }

  protected async request<T>(
    method: "GET" | "PATCH" | "POST",
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<T> {
    const url = new URL(`${NOTION_API_BASE}${path}`);
    for (const [key, value] of Object.entries(options?.query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await this.fetchImpl(url.toString(), {
      method,
      headers: this.getHeaders(options?.notionVersion ?? this.apiVersion),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new NotionApiError(response.status, text);
    }

    if (text.trim().length === 0) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }
}
