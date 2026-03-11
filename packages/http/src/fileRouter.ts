/**
 * File-based API router.
 *
 * Scans a `routes/` directory at startup and builds a routing table where
 * the file path defines the URL endpoint (React / Next.js style).
 *
 * Conventions:
 *   - `routes/foo.ts`            → GET/POST/… /api/foo
 *   - `routes/foo/index.ts`      → GET/POST/… /api/foo
 *   - `routes/foo/[id].ts`       → GET/POST/… /api/foo/:id   (dynamic segment)
 *   - `routes/foo/[...slug].ts`  → GET/POST/… /api/foo/*     (catch-all)
 *   - Files starting with `_`    → skipped (private helpers)
 *
 * Each route file exports named HTTP methods and an optional `auth` override:
 *
 *   export const auth = 'debug';
 *   export async function GET(ctx) { … }
 *   export async function POST(ctx) { … }
 */

import fs from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import path from "path";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface RouteContext<TOptions = Record<string, unknown>> {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  url: URL;
  options: TOptions;
  corsOrigin: string;
  sendJson: (status: number, body: unknown) => void;
}

export type RouteHandler<TOptions = Record<string, unknown>> = (
  ctx: RouteContext<TOptions>
) => Promise<void>;

export interface RouteModule<TOptions = Record<string, unknown>> {
  GET?: RouteHandler<TOptions>;
  POST?: RouteHandler<TOptions>;
  PUT?: RouteHandler<TOptions>;
  DELETE?: RouteHandler<TOptions>;
  PATCH?: RouteHandler<TOptions>;
  auth?: string;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;

interface CompiledRoute<TOptions = Record<string, unknown>> {
  pattern: RegExp;
  paramNames: string[];
  handlers: Partial<Record<string, RouteHandler<TOptions>>>;
  auth: string;
  priority: number; // 0 = static, 1 = dynamic, 2 = catch-all
  routePath: string;
}

export interface MatchResult<TOptions = Record<string, unknown>> {
  handler: RouteHandler<TOptions>;
  auth: string;
  params: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Route scanning & compilation
// ---------------------------------------------------------------------------

function compileSegment(segment: string): {
  regex: string;
  paramName?: string;
  isCatchAll?: boolean;
} {
  // Catch-all: [...param]
  const catchAllMatch = /^\[\.\.\.(\w+)\]$/.exec(segment);
  if (catchAllMatch) {
    return { regex: "(.+)", paramName: catchAllMatch[1], isCatchAll: true };
  }

  // Dynamic: [param]
  const dynamicMatch = /^\[(\w+)\]$/.exec(segment);
  if (dynamicMatch) {
    return { regex: "([^/]+)", paramName: dynamicMatch[1] };
  }

  // Static
  return { regex: segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") };
}

function filePathToRoute(
  relativePath: string,
  prefix: string
): { urlPattern: string; paramNames: string[]; priority: number } {
  // Strip extension
  const withoutExt = relativePath.replace(/\.(js|ts)$/, "");

  // Split into segments and drop trailing 'index'
  const parts = withoutExt.split("/").filter(Boolean);
  if (parts[parts.length - 1] === "index") {
    parts.pop();
  }

  const paramNames: string[] = [];
  let priority = 0;
  const regexParts: string[] = [];

  for (const part of parts) {
    const compiled = compileSegment(part);
    regexParts.push(compiled.regex);
    if (compiled.paramName !== undefined && compiled.paramName !== "") {
      paramNames.push(compiled.paramName);
    }
    if (compiled.isCatchAll === true) {
      priority = 2;
    } else if (
      compiled.paramName !== undefined &&
      compiled.paramName !== "" &&
      priority < 1
    ) {
      priority = 1;
    }
  }

  const urlPath =
    regexParts.length > 0 ? `${prefix}/${regexParts.join("/")}` : prefix;

  return { urlPattern: `^${urlPath}$`, paramNames, priority };
}

/** Get the path relative to the routes root directory, accounting for recursive scanning */
function getRelativeToRoutesRoot(scanRoot: string, filePath: string): string {
  return path.relative(scanRoot, filePath);
}

async function scanRoutes<TOptions>(
  dir: string,
  prefix: string,
  scanRoot: string,
  defaultAuth: string,
  parentAuth?: string
): Promise<CompiledRoute<TOptions>[]> {
  const routes: CompiledRoute<TOptions>[] = [];

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  // Check for _auth.ts/_auth.js in this directory
  let dirAuth = parentAuth;
  for (const entry of entries) {
    if (entry.isFile() && /^_auth\.(js|ts)$/.test(entry.name)) {
      const mod = (await import(path.join(dir, entry.name))) as {
        auth?: string;
      };
      if (mod.auth !== undefined && mod.auth !== "") {
        dirAuth = mod.auth;
      }
    }
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    // Skip private files/dirs (starting with _)
    if (entry.name.startsWith("_")) {
      continue;
    }

    if (entry.isDirectory()) {
      const childRoutes = await scanRoutes<TOptions>(
        fullPath,
        prefix,
        scanRoot,
        defaultAuth,
        dirAuth
      );
      routes.push(...childRoutes);
    } else if (entry.isFile() && /\.(js|ts)$/.test(entry.name)) {
      // Skip .d.ts declaration files and .js.map files
      if (entry.name.endsWith(".d.ts") || entry.name.endsWith(".js.map")) {
        continue;
      }

      const routesRootRelative = getRelativeToRoutesRoot(scanRoot, fullPath);

      const { urlPattern, paramNames, priority } = filePathToRoute(
        routesRootRelative,
        prefix
      );

      const mod = (await import(fullPath)) as RouteModule<TOptions>;

      const handlers: Partial<Record<string, RouteHandler<TOptions>>> = {};
      for (const method of HTTP_METHODS) {
        if (typeof mod[method] === "function") {
          handlers[method] = mod[method];
        }
      }

      // Skip files that export no handlers
      if (Object.keys(handlers).length === 0) {
        continue;
      }

      routes.push({
        pattern: new RegExp(urlPattern),
        paramNames,
        handlers,
        auth: mod.auth ?? dirAuth ?? defaultAuth,
        priority,
        routePath: routesRootRelative,
      });
    }
  }

  return routes;
}

function sortRoutes<TOptions>(routes: CompiledRoute<TOptions>[]): void {
  routes.sort((a, b) => {
    // Static before dynamic before catch-all
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // More specific (longer path) first within same priority
    const aSegments = a.routePath.split("/").length;
    const bSegments = b.routePath.split("/").length;
    if (aSegments !== bSegments) {
      return bSegments - aSegments;
    }
    // Alphabetical for determinism
    return a.routePath.localeCompare(b.routePath);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface FileRouter<TOptions = Record<string, unknown>> {
  match(method: string, pathname: string): MatchResult<TOptions> | null;
}

export interface LoadFileRouterOptions {
  /** Default auth type assigned to routes that don't specify one. Defaults to `'dashboard'`. */
  defaultAuth?: string;
}

/**
 * Load and compile a file-based router from the given routes directory.
 */
export async function loadFileRouter<TOptions = Record<string, unknown>>(
  routesDir: string,
  prefix: string,
  options: LoadFileRouterOptions = {}
): Promise<FileRouter<TOptions>> {
  const { defaultAuth = "dashboard" } = options;
  const routes = await scanRoutes<TOptions>(
    routesDir,
    prefix,
    routesDir,
    defaultAuth
  );
  sortRoutes(routes);

  return {
    match(method: string, pathname: string): MatchResult<TOptions> | null {
      for (const route of routes) {
        const m = route.pattern.exec(pathname);
        if (!m) {
          continue;
        }

        const params: Record<string, string> = {};
        for (let i = 0; i < route.paramNames.length; i++) {
          params[route.paramNames[i]] = decodeURIComponent(m[i + 1]);
        }

        const handler = route.handlers[method];
        if (!handler) {
          // Route matched but method not supported — continue looking
          // (another route pattern might match with the right method)
          continue;
        }

        return { handler, auth: route.auth, params };
      }

      return null;
    },
  };
}
