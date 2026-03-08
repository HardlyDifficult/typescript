/**
 * OpenCode server lifecycle management.
 *
 * Manages starting the OpenCode server once per process. Clients are created
 * on demand so each run can target its own working directory cleanly.
 *
 * The `@opencode-ai/sdk` is ESM-only with `exports` maps, so we use
 * dynamic import() and untyped handles to avoid moduleResolution issues.
 */

export interface OpencodeClient {
  session: {
    create: (
      options: Record<string, never>
    ) => Promise<{ id: string | number }>;
    abort: (options: { path: { id: string } }) => Promise<unknown>;
    prompt: (options: {
      path: { id: string };
      body: Record<string, unknown>;
    }) => Promise<unknown>;
  };
  event: {
    subscribe: () => Promise<AsyncIterable<unknown>>;
  };
}

interface OpencodeServer {
  url: string;
  close: () => void;
}

interface OpencodeSdk {
  createOpencodeServer: (options: {
    port: number;
    timeout: number;
  }) => Promise<OpencodeServer>;
  createOpencodeClient: (options?: {
    baseUrl?: string;
    directory?: string;
  }) => OpencodeClient;
}

interface ServerHandle {
  sdk: Pick<OpencodeSdk, "createOpencodeClient">;
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

  _starting ??= startServer()
    .then((server) => {
      _instance = server;
      return server;
    })
    .finally(() => {
      _starting = undefined;
    });

  return _starting;
}

async function startServer(): Promise<ServerHandle> {
  const sdkModule = "@opencode-ai/sdk";
  const sdk = (await import(/* webpackIgnore: true */ sdkModule)) as unknown;
  const resolvedSdk = resolveSdk(sdk);

  const server = await resolvedSdk.createOpencodeServer({
    port: 0,
    timeout: 15_000,
  });

  return {
    sdk: { createOpencodeClient: resolvedSdk.createOpencodeClient },
    url: server.url,
    close: () => {
      server.close();
    },
  };
}

function resolveSdk(sdk: unknown): OpencodeSdk {
  const maybeSdk = sdk as {
    createOpencodeServer?: unknown;
    createOpencodeClient?: unknown;
    default?: {
      createOpencodeServer?: unknown;
      createOpencodeClient?: unknown;
    };
  };
  const createOpencodeServer =
    maybeSdk.createOpencodeServer ?? maybeSdk.default?.createOpencodeServer;
  const createOpencodeClient =
    maybeSdk.createOpencodeClient ?? maybeSdk.default?.createOpencodeClient;

  if (
    typeof createOpencodeServer !== "function" ||
    typeof createOpencodeClient !== "function"
  ) {
    throw new Error(
      "Could not load createOpencodeServer/createOpencodeClient from @opencode-ai/sdk."
    );
  }

  return {
    createOpencodeServer:
      createOpencodeServer as OpencodeSdk["createOpencodeServer"],
    createOpencodeClient:
      createOpencodeClient as OpencodeSdk["createOpencodeClient"],
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
