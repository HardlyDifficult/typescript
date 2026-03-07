/** Base class providing authenticated HTTP request infrastructure for Cursor Cloud. */
export class CursorCloudHttp {
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  protected readonly fetchImpl: typeof fetch;

  constructor(apiKey: string, baseUrl: string, fetchImpl: typeof fetch) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
  }

  protected basicAuthHeader(): string {
    const encoded = Buffer.from(`${this.apiKey}:`).toString("base64");
    return `Basic ${encoded}`;
  }

  protected async requestJson<T>(
    path: string,
    init: { method: "GET" | "POST" | "PATCH" | "DELETE"; body?: string }
  ): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: init.method,
      headers: {
        Authorization: this.basicAuthHeader(),
        "Content-Type": "application/json",
      },
      ...(init.body !== undefined && { body: init.body }),
    });

    const raw = await response.text();
    let payload: unknown = {};

    if (raw.trim() !== "") {
      try {
        payload = JSON.parse(raw) as unknown;
      } catch {
        if (!response.ok) {
          throw new Error(
            `Cursor API request failed (${String(response.status)} ${response.statusText}): ${raw}`
          );
        }
        throw new Error("Cursor API returned non-JSON response");
      }
    }

    if (!response.ok) {
      throw new Error(
        `Cursor API request failed (${String(response.status)} ${response.statusText}): ${JSON.stringify(payload)}`
      );
    }

    return payload as T;
  }
}
