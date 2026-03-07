import { randomUUID } from "crypto";

import type WebSocket from "ws";

import { safeCompare } from "./safeCompare.js";
import {
  type ConnectedWorker,
  type HeartbeatAckMessage,
  type HeartbeatMessage,
  type RegistrationAckMessage,
  type RegistrationMessage,
  type WorkerConnectedHandler,
  type WorkerDisconnectedHandler,
  type WorkerInfo,
  type WorkerMessage,
  type WorkerMessageEvent,
  type WorkerMessageHandler,
  type WorkerServerLogger,
  WorkerStatus,
} from "./types.js";
import { toWorkerInfo, type WorkerPool } from "./WorkerPool.js";

function noop(): void {
  // intentional no-op
}

const NO_OP_LOGGER: WorkerServerLogger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
};

interface RequestSettlement {
  complete(): void;
  fail(): void;
}

export interface ConnectionHandlerConfig {
  authToken?: string;
  heartbeatTimeoutMs: number;
  heartbeatIntervalMs: number;
}

/**
 * Handles WebSocket connection lifecycle and message routing.
 *
 * Protocol messages (registration, heartbeat) are handled internally.
 * All other messages are dispatched by `type` to registered handlers.
 */
export class ConnectionHandler {
  private readonly messageHandlers = new Map<
    string,
    Set<WorkerMessageHandler>
  >();
  private readonly connectedHandlers = new Set<WorkerConnectedHandler>();
  private readonly disconnectedHandlers = new Set<WorkerDisconnectedHandler>();
  private readonly logger: WorkerServerLogger;

  constructor(
    private readonly pool: WorkerPool,
    private readonly config: ConnectionHandlerConfig,
    private readonly createRequestSettlement: (
      requestId: string | null
    ) => RequestSettlement,
    logger?: WorkerServerLogger
  ) {
    this.logger = logger ?? NO_OP_LOGGER;
  }

  /**
   * Register a handler for a specific message type.
   * Returns an unsubscribe function.
   */
  onMessage<T extends WorkerMessage = WorkerMessage>(
    type: string,
    handler: WorkerMessageHandler<T>
  ): () => void {
    let set = this.messageHandlers.get(type);
    if (set === undefined) {
      set = new Set();
      this.messageHandlers.set(type, set);
    }

    const typedHandler = handler as WorkerMessageHandler;
    set.add(typedHandler);

    return () => {
      set.delete(typedHandler);
    };
  }

  onWorkerConnected(handler: WorkerConnectedHandler): () => void {
    this.connectedHandlers.add(handler);
    return () => {
      this.connectedHandlers.delete(handler);
    };
  }

  onWorkerDisconnected(handler: WorkerDisconnectedHandler): () => void {
    this.disconnectedHandlers.add(handler);
    return () => {
      this.disconnectedHandlers.delete(handler);
    };
  }

  /** Set up event handlers for a new WebSocket connection. */
  handleConnection(ws: WebSocket): void {
    this.logger.debug("New WebSocket connection from potential worker");

    ws.on("message", (data: Buffer) => {
      this.handleMessage(ws, data);
    });

    ws.on("close", (code: number, reason: Buffer) => {
      this.handleDisconnect(ws, code, reason.toString());
    });

    ws.on("error", (error: Error) => {
      this.logger.error("Worker WebSocket error", {
        error: error.message,
      });
    });
  }

  private handleMessage(ws: WebSocket, data: Buffer): void {
    let message: WorkerMessage;

    try {
      message = JSON.parse(data.toString()) as WorkerMessage;
    } catch {
      this.logger.warn("Invalid JSON message from worker");
      return;
    }

    const { type } = message;
    if (typeof type !== "string") {
      this.logger.warn("Message missing type field");
      return;
    }

    if (type === "worker_registration") {
      this.handleRegistration(ws, message as unknown as RegistrationMessage);
      return;
    }

    if (type === "heartbeat") {
      this.handleHeartbeat(ws, message as unknown as HeartbeatMessage);
      return;
    }

    const handlers = this.messageHandlers.get(type);
    if (handlers === undefined || handlers.size === 0) {
      this.logger.warn("Unhandled message type from worker", { type });
      return;
    }

    const { workerId } = ws as WebSocket & { workerId?: string };
    const worker = workerId !== undefined ? this.pool.get(workerId) : undefined;
    const info =
      worker !== undefined
        ? toWorkerInfo(worker)
        : this.unknownWorkerInfo(workerId);
    const requestId =
      typeof message.requestId === "string" ? message.requestId : null;
    const settlement = this.createRequestSettlement(requestId);
    const event = Object.freeze({
      worker: info,
      message,
      requestId,
      complete: settlement.complete,
      fail: settlement.fail,
    }) as WorkerMessageEvent;

    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error("Error in message handler", {
          type,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private handleRegistration(
    ws: WebSocket,
    message: RegistrationMessage
  ): void {
    if (
      this.config.authToken !== undefined &&
      !safeCompare(message.authToken ?? "", this.config.authToken)
    ) {
      this.logger.warn("Worker registration rejected: invalid auth token", {
        workerId: message.workerId,
      });
      const ack: RegistrationAckMessage = {
        type: "worker_registration_ack",
        success: false,
        error: "Invalid authentication token",
      };
      ws.send(JSON.stringify(ack));
      ws.close(4001, "Authentication failed");
      return;
    }

    const existing = this.pool.get(message.workerId);
    if (existing !== undefined) {
      this.logger.debug("Replacing existing worker connection", {
        workerId: message.workerId,
      });

      (existing.websocket as WebSocket & { workerId?: string }).workerId =
        undefined;

      try {
        existing.websocket.close(4003, "Replaced by new connection");
      } catch {
        // Old socket may already be dead
      }

      if (existing.pendingRequests.size > 0) {
        this.logger.warn("Replaced worker had pending requests", {
          workerId: message.workerId,
          count: existing.pendingRequests.size,
        });
        const info = toWorkerInfo(existing);
        for (const handler of this.disconnectedHandlers) {
          try {
            handler(info);
          } catch (error) {
            this.logger.error("Error in disconnected handler", {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      this.pool.remove(message.workerId);
    }

    const sessionId = randomUUID();
    const now = new Date();
    const worker: ConnectedWorker = {
      id: message.workerId,
      name: message.workerName,
      websocket: ws,
      capabilities: message.capabilities,
      status: WorkerStatus.Available,
      sessionId,
      connectedAt: now,
      lastHeartbeat: now,
      activeRequests: 0,
      pendingRequests: new Set(),
      completedRequests: 0,
      requestCategories: new Map(),
      categoryActiveRequests: new Map(),
    };

    this.pool.add(worker);
    (ws as WebSocket & { workerId?: string }).workerId = message.workerId;

    const ack: RegistrationAckMessage = {
      type: "worker_registration_ack",
      success: true,
      sessionId,
      heartbeatIntervalMs: this.config.heartbeatIntervalMs,
    };
    ws.send(JSON.stringify(ack));

    this.logger.debug("Worker registered", {
      workerId: message.workerId,
      workerName: message.workerName,
      models: message.capabilities.models.map((model) => model.modelId),
      maxConcurrentRequests: message.capabilities.maxConcurrentRequests,
    });

    const info = toWorkerInfo(worker);
    for (const handler of this.connectedHandlers) {
      try {
        handler(info);
      } catch (error) {
        this.logger.error("Error in connected handler", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private handleHeartbeat(ws: WebSocket, message: HeartbeatMessage): void {
    const worker = this.pool.get(message.workerId);
    if (worker === undefined) {
      this.logger.warn("Heartbeat from unknown worker", {
        workerId: message.workerId,
      });
      return;
    }

    worker.lastHeartbeat = new Date();

    if (worker.status === WorkerStatus.Unhealthy) {
      worker.status =
        worker.activeRequests < worker.capabilities.maxConcurrentRequests
          ? WorkerStatus.Available
          : WorkerStatus.Busy;
    }

    const nextDeadline = new Date(Date.now() + this.config.heartbeatTimeoutMs);
    const ack: HeartbeatAckMessage = {
      type: "heartbeat_ack",
      timestamp: message.timestamp,
      nextHeartbeatDeadline: nextDeadline.toISOString(),
    };
    ws.send(JSON.stringify(ack));
  }

  private handleDisconnect(ws: WebSocket, code: number, reason: string): void {
    const { workerId } = ws as WebSocket & { workerId?: string };
    if (workerId === undefined) {
      this.logger.debug("Unregistered WebSocket connection closed", {
        code,
        reason,
      });
      return;
    }

    const worker = this.pool.get(workerId);
    if (worker === undefined) {
      return;
    }

    const info = toWorkerInfo(worker);

    if (worker.pendingRequests.size > 0) {
      this.logger.warn("Worker disconnected with pending requests", {
        workerId,
        count: worker.pendingRequests.size,
      });
    }

    this.pool.remove(workerId);
    this.logger.debug("Worker disconnected", { workerId, code, reason });

    for (const handler of this.disconnectedHandlers) {
      try {
        handler(info);
      } catch (error) {
        this.logger.error("Error in disconnected handler", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private unknownWorkerInfo(workerId?: string): WorkerInfo {
    return Object.freeze({
      id: workerId ?? "unknown",
      name: "unknown",
      status: WorkerStatus.Unhealthy,
      capabilities: Object.freeze({
        models: Object.freeze([]),
        maxConcurrentRequests: 0,
      }),
      sessionId: "",
      connectedAt: new Date(0),
      lastHeartbeat: new Date(0),
      requests: Object.freeze({
        active: 0,
        completed: 0,
        pendingIds: Object.freeze([]),
        activeByCategory: Object.freeze({}),
      }),
    });
  }
}
