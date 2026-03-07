import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "http";
import type { Duplex } from "stream";

import { type WebSocket, WebSocketServer } from "ws";

import { ConnectionHandler } from "./ConnectionHandler.js";
import type {
  DispatchedRequest,
  HttpRequestHandler,
  WebSocketConnectionHandler,
  WorkerConnectedHandler,
  WorkerDisconnectedHandler,
  WorkerInfo,
  WorkerMessage,
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
 * Handles transport concerns, worker registration, health monitoring,
 * message routing, and the opinionated request dispatch lifecycle.
 */
export class WorkerServer {
  private readonly configuredPort: number;
  private currentPort: number;
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
    this.configuredPort = options.port;
    this.currentPort = options.port;
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
      (requestId) => this.createRequestSettlement(requestId),
      this.logger
    );
  }

  get port(): number {
    return this.currentPort;
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
  onWorkerMessage<T extends WorkerMessage = WorkerMessage>(
    type: string,
    handler: WorkerMessageHandler<T>
  ): () => void {
    return this.connectionHandler.onMessage(type, handler);
  }

  // ========== Dispatch ==========

  /**
   * Pick an eligible worker, send the message, and begin tracking its request.
   * Returns null when there is no worker that can accept the work.
   */
  dispatch<T extends WorkerMessage & { requestId: string }>(options: {
    model?: string;
    category?: string;
    message: T;
  }): DispatchedRequest<T> | null {
    const candidates = this.pool.getDispatchCandidates({
      model: options.model,
      category: options.category,
    });

    for (const candidate of candidates) {
      if (!this.pool.send(candidate.id, options.message)) {
        this.logger.warn("Failed to send dispatched message to worker", {
          workerId: candidate.id,
          requestId: options.message.requestId,
          type: options.message.type,
        });
        continue;
      }

      this.pool.trackRequest(
        candidate.id,
        options.message.requestId,
        options.category
      );
      const trackedWorker = this.pool.get(candidate.id) ?? candidate;

      return Object.freeze({
        worker: toWorkerInfo(trackedWorker),
        message: options.message,
        requestId: options.message.requestId,
        ...this.createRequestSettlement(options.message.requestId),
      });
    }

    return null;
  }

  /** Broadcast a JSON message to all connected workers. */
  broadcast(message: WorkerMessage): void {
    this.pool.broadcast(message);
  }

  // ========== Read APIs ==========

  /** Get public info about all connected workers. */
  listWorkers(): WorkerInfo[] {
    return this.pool.getWorkerInfoList();
  }

  /** Count total free slots for the given model across all available workers. */
  availableSlots(model: string, category?: string): number {
    return this.pool.getAvailableSlotCount(model, category);
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

      this.httpServer.on(
        "upgrade",
        (request: IncomingMessage, socket: Duplex, head: Buffer) => {
          const pathname = request.url ?? "/";
          const endpoint = this.additionalEndpoints.get(pathname);

          if (endpoint !== undefined) {
            endpoint.wss.handleUpgrade(request, socket, head, (ws) => {
              endpoint.wss.emit("connection", ws, request);
            });
            return;
          }

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

      this.httpServer.listen(this.configuredPort, () => {
        this.currentPort = this.resolveBoundPort();
        this.logger.debug("HTTP + WebSocket server started", {
          port: this.currentPort,
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

  private createRequestSettlement(requestId: string | null): {
    complete(): void;
    fail(): void;
  } {
    let settled = false;

    const settle = (incrementCompleted: boolean): void => {
      if (settled || requestId === null) {
        return;
      }

      settled = true;
      this.pool.releaseRequest(requestId, { incrementCompleted });
    };

    return {
      complete: () => {
        settle(true);
      },
      fail: () => {
        settle(false);
      },
    };
  }

  private resolveBoundPort(): number {
    const address = this.httpServer?.address();
    if (
      address !== null &&
      address !== undefined &&
      typeof address === "object"
    ) {
      return address.port;
    }

    return this.configuredPort;
  }

  private runHealthCheck(): void {
    const deadWorkerIds = this.pool.checkHealth(this.heartbeatTimeoutMs);

    for (const workerId of deadWorkerIds) {
      const worker = this.pool.get(workerId);
      if (worker === undefined) {
        continue;
      }

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
      } catch (error) {
        this.logger.error("HTTP handler error", {
          error: error instanceof Error ? error.message : String(error),
          url: req.url,
        });
      }
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  }
}
