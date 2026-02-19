import { describe, it, expect } from "vitest";
import { EventEmitter } from "events";
import type { IncomingMessage, ServerResponse } from "http";
import { readBody, sendJson, MAX_BODY_BYTES } from "../src/http.js";

function createMockRequest(chunks: string[]): IncomingMessage {
  const emitter = new EventEmitter();
  (emitter as unknown as IncomingMessage).destroy = () => {
    emitter.emit("error", new Error("destroyed"));
  };
  process.nextTick(() => {
    for (const chunk of chunks) {
      emitter.emit("data", Buffer.from(chunk));
    }
    emitter.emit("end");
  });
  return emitter as unknown as IncomingMessage;
}

function createMockResponse() {
  let statusCode = 0;
  let headers: Record<string, string> = {};
  let body = "";
  const res = {
    writeHead: (status: number, hdrs: Record<string, string>) => {
      statusCode = status;
      headers = hdrs;
    },
    end: (data: string) => {
      body = data;
    },
  } as unknown as ServerResponse;
  return {
    res,
    getStatus: () => statusCode,
    getHeaders: () => headers,
    getBody: () => body,
  };
}

describe("MAX_BODY_BYTES", () => {
  it("equals 1MB", () => {
    expect(MAX_BODY_BYTES).toBe(1024 * 1024);
  });
});

describe("readBody", () => {
  it("reads a simple request body", async () => {
    const req = createMockRequest(["hello world"]);
    const body = await readBody(req);
    expect(body).toBe("hello world");
  });

  it("concatenates multiple chunks", async () => {
    const req = createMockRequest(["foo", "bar", "baz"]);
    const body = await readBody(req);
    expect(body).toBe("foobarbaz");
  });

  it("rejects when body exceeds maxBytes", async () => {
    const req = createMockRequest(["x".repeat(100)]);
    await expect(readBody(req, 50)).rejects.toThrow("Payload too large");
  });
});

describe("sendJson", () => {
  it("sends JSON response with correct status and headers", () => {
    const mock = createMockResponse();
    sendJson(mock.res, 200, { ok: true }, "https://example.com");
    expect(mock.getStatus()).toBe(200);
    expect(mock.getHeaders()["Content-Type"]).toBe("application/json");
    expect(mock.getHeaders()["Access-Control-Allow-Origin"]).toBe(
      "https://example.com"
    );
    expect(JSON.parse(mock.getBody())).toEqual({ ok: true });
  });

  it("serializes body to JSON", () => {
    const mock = createMockResponse();
    sendJson(mock.res, 201, [1, 2, 3], "*");
    expect(JSON.parse(mock.getBody())).toEqual([1, 2, 3]);
  });
});
