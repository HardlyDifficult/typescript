import type { IncomingMessage, ServerResponse } from "http";

export const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

export interface ReadBodyOptions {
  maxBytes?: number;
}

export interface SendJsonOptions {
  status?: number;
  corsOrigin?: string;
}

/** Read the full request body as a string, rejecting if it exceeds maxBytes. */
export function readBody(
  req: IncomingMessage,
  options: ReadBodyOptions = {}
): Promise<string> {
  const maxBytes = options.maxBytes ?? MAX_BODY_BYTES;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let done = false;

    const onError = (err: Error) => {
      if (!done) {
        done = true;
        reject(err);
      }
    };

    req.on("data", (chunk: Buffer | string | Uint8Array) => {
      if (done) {
        return;
      }

      let normalized: Buffer;
      if (Buffer.isBuffer(chunk)) {
        normalized = chunk;
      } else if (typeof chunk === "string") {
        normalized = Buffer.from(chunk);
      } else {
        normalized = Buffer.from(chunk);
      }

      totalBytes += normalized.length;
      if (totalBytes > maxBytes) {
        done = true;
        // Replace error handler with a no-op before destroying to prevent
        // the destroy-induced error event from becoming an uncaught exception.
        req.removeListener("error", onError);
        req.on("error", () => {
          // swallow errors after rejection
        });
        req.destroy();
        reject(new Error("Payload too large"));
        return;
      }
      chunks.push(normalized);
    });
    req.on("end", () => {
      if (!done) {
        done = true;
        resolve(Buffer.concat(chunks).toString());
      }
    });
    req.on("error", onError);
  });
}

/** Read and parse a JSON request body. */
export async function readJson<T>(
  req: IncomingMessage,
  options: ReadBodyOptions = {}
): Promise<T> {
  const body = await readBody(req, options);

  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error("Invalid JSON body");
  }
}

/** Send a JSON response */
export function sendJson(
  res: ServerResponse,
  body: unknown,
  options: SendJsonOptions = {}
): void {
  const { status = 200, corsOrigin = "*" } = options;

  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(body));
}

export const json = sendJson;
