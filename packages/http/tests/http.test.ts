import { describe, it, expect } from "vitest";
import { EventEmitter } from "events";
import type { IncomingMessage, ServerResponse } from "http";
import {
  json,
  readBody,
  readJson,
  sendJson,
  MAX_BODY_BYTES,
} from "../src/http.js";

function createMockRequest(
  chunks: Array<string | Buffer | Uint8Array>
): IncomingMessage {
  const emitter = new EventEmitter();
  (emitter as unknown as IncomingMessage).destroy = () => {
    emitter.emit("error", new Error("destroyed"));
  };
  process.nextTick(() => {
    for (const chunk of chunks) {
      emitter.emit("data", chunk);
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
    const req = createMockRequest([
      Buffer.from("foo"),
      Buffer.from("bar"),
      Buffer.from("baz"),
    ]);
    const body = await readBody(req);
    expect(body).toBe("foobarbaz");
  });

  it("accepts string chunks", async () => {
    const req = createMockRequest(["hello", " ", "world"]);
    const body = await readBody(req);
    expect(body).toBe("hello world");
  });

  it("rejects when body exceeds maxBytes", async () => {
    const req = createMockRequest(["x".repeat(100)]);
    await expect(readBody(req, { maxBytes: 50 })).rejects.toThrow(
      "Payload too large"
    );
  });

  it("rejects when string chunks exceed maxBytes", async () => {
    const req = createMockRequest(["abc", "def", "ghi"]);
    await expect(readBody(req, { maxBytes: 8 })).rejects.toThrow(
      "Payload too large"
    );
  });
});

describe("readJson", () => {
  it("parses a JSON request body", async () => {
    const req = createMockRequest(['{"ok":true,"count":2}']);
    const body = await readJson<{ ok: boolean; count: number }>(req);
    expect(body).toEqual({ ok: true, count: 2 });
  });

  it("rejects invalid JSON", async () => {
    const req = createMockRequest(["not json"]);
    await expect(readJson(req)).rejects.toThrow("Invalid JSON body");
  });
});

describe("readBody - additional branches", () => {
  it("handles Uint8Array chunks", async () => {
    const emitter = new EventEmitter();
    (emitter as unknown as IncomingMessage).destroy = () => {
      emitter.emit("error", new Error("destroyed"));
    };
    process.nextTick(() => {
      // Emit a Uint8Array chunk (not Buffer, not string) to hit line 44
      emitter.emit("data", new Uint8Array([104, 101, 108, 108, 111])); // "hello"
      emitter.emit("end");
    });
    const req = emitter as unknown as IncomingMessage;
    const body = await readBody(req);
    expect(body).toBe("hello");
  });

  it("ignores data events after done is true (payload too large)", async () => {
    // After payload too large, subsequent data events are ignored (line 34-36)
    const emitter = new EventEmitter();
    let destroyCalled = false;
    (emitter as unknown as IncomingMessage).destroy = () => {
      destroyCalled = true;
      // Don't emit error - request is fully aborted
    };
    (emitter as unknown as IncomingMessage).removeListener =
      emitter.removeListener.bind(emitter);

    process.nextTick(() => {
      emitter.emit("data", Buffer.from("x".repeat(100)));
      // This chunk arrives after done=true, should be ignored
      emitter.emit("data", Buffer.from("more data after rejection"));
      emitter.emit("end");
    });
    const req = emitter as unknown as IncomingMessage;
    await expect(readBody(req, { maxBytes: 50 })).rejects.toThrow(
      "Payload too large"
    );
    expect(destroyCalled).toBe(true);
  });

  it("ignores error events after done is true (onError guard, lines 27-29)", async () => {
    // After rejection (done=true), a subsequent error event should be swallowed (not double-reject)
    const emitter = new EventEmitter();
    (emitter as unknown as IncomingMessage).destroy = () => {
      // simulate destroy triggering a new error event - but we already removed the listener
      // The new "swallow" listener catches it
    };
    (emitter as unknown as IncomingMessage).removeListener =
      emitter.removeListener.bind(emitter);

    process.nextTick(async () => {
      // Emit error directly while done=false to hit the onError path normally
      emitter.emit("error", new Error("first error"));
      // Emit a second error after done=true - should be swallowed (line 27: if (!done) returns)
      emitter.emit("error", new Error("second error should be ignored"));
    });
    const req = emitter as unknown as IncomingMessage;
    await expect(readBody(req)).rejects.toThrow("first error");
  });
});

describe("sendJson", () => {
  it("sends JSON response with default status and cors origin", () => {
    const mock = createMockResponse();
    sendJson(mock.res, { ok: true });
    expect(mock.getStatus()).toBe(200);
    expect(mock.getHeaders()["Content-Type"]).toBe("application/json");
    expect(mock.getHeaders()["Access-Control-Allow-Origin"]).toBe("*");
    expect(JSON.parse(mock.getBody())).toEqual({ ok: true });
  });

  it("accepts explicit response options", () => {
    const mock = createMockResponse();
    sendJson(mock.res, [1, 2, 3], {
      status: 201,
      corsOrigin: "https://example.com",
    });
    expect(mock.getStatus()).toBe(201);
    expect(mock.getHeaders()["Access-Control-Allow-Origin"]).toBe(
      "https://example.com"
    );
    expect(JSON.parse(mock.getBody())).toEqual([1, 2, 3]);
  });

  it("exports a short json alias", () => {
    const mock = createMockResponse();
    json(mock.res, { created: true }, { status: 201 });
    expect(mock.getStatus()).toBe(201);
    expect(JSON.parse(mock.getBody())).toEqual({ created: true });
  });
});
