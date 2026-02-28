/**
 * OpenCode server lifecycle management.
 *
 * Manages starting the OpenCode Go binary as a subprocess and providing
 * a connected client. The server is started once per process and reused
 * across sessions.
 *
 * The `@opencode-ai/sdk` is ESM-only with `exports` maps, so we use
 * dynamic import() and untyped handles to avoid moduleResolution issues.
 */

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

/** Opaque handle to the OpenCode client (typed dynamically at runtime). */
export type OpencodeClient = any;

interface ServerHandle {
  client: OpencodeClient;
  close: () => void;
}

let _instance: ServerHandle | undefined;
let _starting: Promise<ServerHandle> | undefined;

/**
 * Get or create the OpenCode server instance.
 *
 * On first call, spawns the `opencode serve` process and waits for it to
 * become healthy. Subsequent calls return the same instance.
 *
 * @param cwd - Working directory passed as config to the server.
 */
export async function getOrCreateServer(cwd?: string): Promise<OpencodeClient> {
  if (_instance) {
    return _instance.client;
  }

  // Avoid double-starting if called concurrently
  _starting ??= startServer(cwd);

  // eslint-disable-next-line require-atomic-updates
  _instance = await _starting;
  // eslint-disable-next-line require-atomic-updates
  _starting = undefined;
  return _instance.client;
}

async function startServer(cwd?: string): Promise<ServerHandle> {
  // Dynamic import — the SDK is ESM-only. We use a variable for the module
  // specifier so TypeScript doesn't try to resolve it statically (our
  // moduleResolution is "node" but the SDK uses package.json "exports").
  const sdkModule = "@opencode-ai/sdk";
  const sdk: any = await import(/* webpackIgnore: true */ sdkModule);
  const createOpencode = sdk.createOpencode ?? sdk.default?.createOpencode;

  if (typeof createOpencode !== "function") {
    throw new Error(
      "Could not find createOpencode in @opencode-ai/sdk. " +
        "Ensure the package is installed and up to date."
    );
  }

  const result = await createOpencode({
    port: 0, // random available port
    timeout: 15_000,
    ...(cwd !== undefined ? { config: { cwd } } : {}),
  });

  return {
    client: result.client,
    close: () => result.server.close(),
  };
}

/**
 * Dispose the OpenCode server process.
 * Call this on worker shutdown to clean up the subprocess.
 */
export function disposeServer(): void {
  if (_instance) {
    _instance.close();
    _instance = undefined;
  }
  _starting = undefined;
}
