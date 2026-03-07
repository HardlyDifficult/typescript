export class NotionApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`Notion API error ${String(status)}: ${body}`);
    this.name = "NotionApiError";
    this.status = status;
    this.body = body;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
