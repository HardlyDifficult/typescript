/**
 * OpenCode server lifecycle management.
 *
 * Manages starting the OpenCode server once per process. Clients are created
 * on demand so each run can target its own working directory cleanly.
 *
 * The `@opencode-ai/sdk` is ESM-only with `exports` maps, so we use
 * dynamic import() and untyped handles to avoid moduleResolution issues.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

/** Opaque handle to the OpenCode client (typed dynamically at runtime). */
export type OpencodeClient = any;

interface ServerHandle {
  sdk: {
    createOpencodeClient: (options?: {
      baseUrl?: string;
      directory?: string;
    }) => OpencodeClient;
  };
  url: string;
  close: () => void;
}

let _instance: ServerHandle | undefined;
let _starting: Promise<ServerHandle> | undefined;

/**
 * Create a client for the given directory, starting the shared server if needed.
 */
export async function getClient(directory?: string): Promise<OpencodeClient> {
  const server = await getOrCreateServer();
  return server.sdk.createOpencodeClient({
    baseUrl: server.url,
    ...(directory !== undefined ? { directory } : {}),
  });
}

async function getOrCreateServer(): Promise<ServerHandle> {
  if (_instance !== undefined) {
    return _instance;
  }

  _starting ??= startServer();
  _instance = await _starting;
  _starting = undefined;
  return _instance;
}

async function startServer(): Promise<ServerHandle> {
  const sdkModule = "@opencode-ai/sdk";
  const sdk: any = await import(/* webpackIgnore: true */ sdkModule);
  const createOpencodeServer =
    sdk.createOpencodeServer ?? sdk.default?.createOpencodeServer;
  const createOpencodeClient =
    sdk.createOpencodeClient ?? sdk.default?.createOpencodeClient;

  if (
    typeof createOpencodeServer !== "function" ||
    typeof createOpencodeClient !== "function"
  ) {
    throw new Error(
      "Could not load createOpencodeServer/createOpencodeClient from @opencode-ai/sdk."
    );
  }

  const server = await createOpencodeServer({
    port: 0,
    timeout: 15_000,
  });

  return {
    sdk: { createOpencodeClient },
    url: server.url,
    close: () => server.close(),
  };
}

/**
 * Dispose the OpenCode server process.
 * Call this on worker shutdown to clean up the subprocess.
 */
export function shutdownAgentServer(): void {
  if (_instance) {
    _instance.close();
    _instance = undefined;
  }
  _starting = undefined;
}
