import type { IncomingMessage, ServerResponse } from "http";

export const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

/** Read the full request body as a string, rejecting if it exceeds maxBytes. */
export function readBody(
  req: IncomingMessage,
  maxBytes = MAX_BODY_BYTES
): Promise<string> {
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

      const normalized = Buffer.isBuffer(chunk)
        ? chunk
        : typeof chunk === "string"
          ? Buffer.from(chunk)
          : Buffer.from(chunk as Uint8Array);

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

/** Send a JSON response */
export function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  corsOrigin: string
): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(body));
}
