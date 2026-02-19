import {
  createServer,
  type Server as HttpServer,
  type IncomingMessage,
  type ServerResponse,
} from "http";
import type { Duplex } from "stream";

import { type WebSocket, WebSocketServer } from "ws";

import { ConnectionHandler } from "./ConnectionHandler.js";
import type {
  HttpRequestHandler,
  WebSocketConnectionHandler,
  WorkerConnectedHandler,
  WorkerDisconnectedHandler,
  WorkerInfo,
  WorkerMessageHandler,
  WorkerServerLogger,
  WorkerServerOptions,
} from "./types.js";
import { toWorkerInfo, WorkerPool } from "./WorkerPool.js";

const DEFAULTS = {
  heartbeatTimeoutMs: 60_000,
  healthCheckIntervalMs: 10_000,
  heartbeatIntervalMs: 15_000,
} as const;

function noop(): void {
  // intentional no-op
}

const NO_OP_LOGGER: WorkerServerLogger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
};

/**
 * WebSocket server for managing remote worker connections.
 *
 * Handles all transport-level concerns:
 * - HTTP + WebSocket server with path-based routing
 * - Worker registration with optional auth
 * - Heartbeat protocol and health checks
 * - Message routing by `type` field to registered handlers
 * - Worker pool management (selection, request tracking)
 *
 * Consumers register handlers for domain-specific messages
 * via `onWorkerMessage()` and interact with workers via `send()`.
 */
export class WorkerServer {
  private readonly port: number;
  private readonly heartbeatTimeoutMs: number;
  private readonly healthCheckIntervalMs: number;
  private readonly logger: WorkerServerLogger;

  private httpServer: HttpServer | null = null;
  private workerWss: WebSocketServer | null = null;
  private readonly additionalEndpoints = new Map<
    string,
    { wss: WebSocketServer; handler: WebSocketConnectionHandler }
  >();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;
  private readonly httpHandlers: HttpRequestHandler[] = [];

  private readonly pool: WorkerPool;
  private readonly connectionHandler: ConnectionHandler;

  constructor(options: WorkerServerOptions) {
    this.port = options.port;
    this.heartbeatTimeoutMs =
      options.heartbeatTimeoutMs ?? DEFAULTS.heartbeatTimeoutMs;
    this.healthCheckIntervalMs =
      options.healthCheckIntervalMs ?? DEFAULTS.healthCheckIntervalMs;
    this.logger = options.logger ?? NO_OP_LOGGER;

    this.pool = new WorkerPool(this.logger);
    this.connectionHandler = new ConnectionHandler(
      this.pool,
      {
        authToken: options.authToken,
        heartbeatTimeoutMs: this.heartbeatTimeoutMs,
        heartbeatIntervalMs:
          options.heartbeatIntervalMs ?? DEFAULTS.heartbeatIntervalMs,
      },
      this.logger
    );
  }

  // ========== Lifecycle Events ==========

  /** Called when a worker successfully registers. Returns unsubscribe. */
  onWorkerConnected(handler: WorkerConnectedHandler): () => void {
    return this.connectionHandler.onWorkerConnected(handler);
  }

  /** Called when a worker disconnects. Returns unsubscribe. */
  onWorkerDisconnected(handler: WorkerDisconnectedHandler): () => void {
    return this.connectionHandler.onWorkerDisconnected(handler);
  }

  /**
   * Register a handler for a specific worker message type.
   * Messages are routed by the `type` field in the parsed JSON.
   * Returns an unsubscribe function.
   */
  onWorkerMessage<T = Record<string, unknown>>(
    type: string,
    handler: WorkerMessageHandler<T>
  ): () => void {
    return this.connectionHandler.onMessage(type, handler);
  }

  // ========== Send Messages ==========

  /** Send a JSON message to a specific worker. Returns false if failed. */
  send(workerId: string, message: Record<string, unknown>): boolean {
    return this.pool.send(workerId, message);
  }

  /** Broadcast a JSON message to all connected workers. */
  broadcast(message: Record<string, unknown>): void {
    this.pool.broadcast(message);
  }

  // ========== Pool Queries ==========

  /** Get the least-loaded available worker supporting the given model. */
  getAvailableWorker(model: string): WorkerInfo | null {
    const worker = this.pool.getAvailableWorker(model);
    return worker !== null ? toWorkerInfo(worker) : null;
  }

  /** Get any available worker (model-agnostic). */
  getAnyAvailableWorker(): WorkerInfo | null {
    const worker = this.pool.getAnyAvailableWorker();
    return worker !== null ? toWorkerInfo(worker) : null;
  }

  /** Total connected worker count. */
  getWorkerCount(): number {
    return this.pool.getCount();
  }

  /** Available worker count. */
  getAvailableWorkerCount(): number {
    return this.pool.getAvailableCount();
  }

  /** Get public info about all connected workers. */
  getWorkerInfo(): WorkerInfo[] {
    return this.pool.getWorkerInfoList();
  }

  // ========== Request Tracking ==========

  /** Track a request as assigned to a worker. */
  trackRequest(workerId: string, requestId: string): void {
    this.pool.trackRequest(workerId, requestId);
  }

  /** Release a tracked request. */
  releaseRequest(
    requestId: string,
    options?: { incrementCompleted?: boolean }
  ): void {
    this.pool.releaseRequest(requestId, options);
  }

  // ========== HTTP & WebSocket Extensibility ==========

  /** Add an HTTP handler. Handlers are called in order until one returns true. */
  addHttpHandler(handler: HttpRequestHandler): void {
    this.httpHandlers.push(handler);
  }

  /** Add an additional WebSocket endpoint at a specific path. */
  addWebSocketEndpoint(
    path: string,
    handler: WebSocketConnectionHandler
  ): void {
    const wss = new WebSocketServer({ noServer: true });
    wss.on("connection", (ws: WebSocket) => {
      handler(ws);
    });
    wss.on("error", (error: Error) => {
      this.logger.error("WebSocket server error", {
        path,
        error: error.message,
      });
    });
    this.additionalEndpoints.set(path, { wss, handler });
  }

  // ========== Server Lifecycle ==========

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.httpServer !== null) {
        reject(new Error("WorkerServer is already running"));
        return;
      }

      this.httpServer = createServer((req, res) => {
        void this.handleHttpRequest(req, res);
      });

      this.workerWss = new WebSocketServer({ noServer: true });

      this.workerWss.on("connection", (ws: WebSocket) => {
        this.connectionHandler.handleConnection(ws);
      });

      this.workerWss.on("error", (error: Error) => {
        this.logger.error("Worker WebSocket server error", {
          error: error.message,
        });
      });

      // Route WebSocket upgrades by URL path
      this.httpServer.on(
        "upgrade",
        (request: IncomingMessage, socket: Duplex, head: Buffer) => {
          const pathname = request.url ?? "/";

          // Check additional endpoints first
          const endpoint = this.additionalEndpoints.get(pathname);
          if (endpoint !== undefined) {
            endpoint.wss.handleUpgrade(request, socket, head, (ws) => {
              endpoint.wss.emit("connection", ws, request);
            });
            return;
          }

          // Default: worker connections
          const wss = this.workerWss;
          if (wss !== null) {
            wss.handleUpgrade(request, socket, head, (ws) => {
              wss.emit("connection", ws, request);
            });
          }
        }
      );

      this.httpServer.on("error", (error: Error) => {
        this.logger.error("HTTP server error", { error: error.message });
        reject(error);
      });

      this.httpServer.listen(this.port, () => {
        this.logger.debug("HTTP + WebSocket server started", {
          port: this.port,
        });

        this.healthCheckInterval = setInterval(() => {
          this.runHealthCheck();
        }, this.healthCheckIntervalMs);

        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.healthCheckInterval !== null) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.httpServer === null) {
      return;
    }

    this.pool.closeAll();

    if (this.workerWss !== null) {
      this.workerWss.close();
      this.workerWss = null;
    }

    for (const { wss } of this.additionalEndpoints.values()) {
      wss.close();
    }
    this.additionalEndpoints.clear();

    const server = this.httpServer;
    return new Promise((resolve) => {
      server.close(() => {
        this.httpServer = null;
        this.logger.debug("HTTP + WebSocket server stopped");
        resolve();
      });
    });
  }

  // ========== Private ==========

  private runHealthCheck(): void {
    const deadWorkerIds = this.pool.checkHealth(this.heartbeatTimeoutMs);

    for (const workerId of deadWorkerIds) {
      const worker = this.pool.get(workerId);
      if (worker !== undefined) {
        this.logger.warn("Worker connection presumed dead, closing", {
          workerId,
        });
        try {
          worker.websocket.close(4003, "Heartbeat timeout");
        } catch {
          // Ignore close errors
        }
      }
    }
  }

  private async handleHttpRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    for (const handler of this.httpHandlers) {
      try {
        const handled = await handler(req, res);
        if (handled) {
          return;
        }
      } catch (err) {
        this.logger.error("HTTP handler error", {
          error: err instanceof Error ? err.message : String(err),
          url: req.url,
        });
      }
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
}
