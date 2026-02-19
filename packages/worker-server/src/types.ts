import type { IncomingMessage, ServerResponse } from "http";

import type WebSocket from "ws";

/**
 * Status of a connected worker.
 * Managed automatically based on request tracking and heartbeat.
 */
export enum WorkerStatus {
  Available = "available",
  Busy = "busy",
  Draining = "draining",
  Unhealthy = "unhealthy",
}

/**
 * Describes a model that a worker can run.
 */
export interface ModelInfo {
  modelId: string;
  displayName: string;
  maxContextTokens: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsVision?: boolean;
  supportsTools?: boolean;
}

/**
 * Describes the capabilities and resources of a worker.
 */
export interface WorkerCapabilities {
  models: ModelInfo[];
  maxConcurrentRequests: number;
  metadata?: Record<string, unknown>;
}

/**
 * Public worker info exposed to consumers.
 * Does NOT include the raw WebSocket reference.
 */
export interface WorkerInfo {
  readonly id: string;
  readonly name: string;
  readonly status: WorkerStatus;
  readonly capabilities: WorkerCapabilities;
  readonly sessionId: string;
  readonly connectedAt: Date;
  readonly lastHeartbeat: Date;
  readonly activeRequests: number;
  readonly completedRequests: number;
  readonly pendingRequestIds: ReadonlySet<string>;
}

/**
 * Internal connected worker state (includes WebSocket).
 */
export interface ConnectedWorker {
  readonly id: string;
  readonly name: string;
  readonly websocket: WebSocket;
  readonly capabilities: WorkerCapabilities;
  status: WorkerStatus;
  readonly sessionId: string;
  readonly connectedAt: Date;
  lastHeartbeat: Date;
  activeRequests: number;
  readonly pendingRequests: Set<string>;
  completedRequests: number;
}

/** Configuration for the WorkerServer. */
export interface WorkerServerOptions {
  /** Port for the HTTP + WebSocket server */
  port: number;
  /** Authentication token required from workers (optional) */
  authToken?: string;
  /** How long before a missed heartbeat marks unhealthy (default: 60000) */
  heartbeatTimeoutMs?: number;
  /** How often to check for stale connections (default: 10000) */
  healthCheckIntervalMs?: number;
  /** Heartbeat interval communicated to workers (default: 15000) */
  heartbeatIntervalMs?: number;
  /** Logger instance (optional, defaults to no-op) */
  logger?: WorkerServerLogger;
}

/** Minimal logger interface compatible with @hardlydifficult/logger. */
export interface WorkerServerLogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

/** HTTP request handler. Return true if handled. */
export type HttpRequestHandler = (
  req: IncomingMessage,
  res: ServerResponse
) => Promise<boolean>;

/** Handler for typed worker messages. */
export type WorkerMessageHandler<T = Record<string, unknown>> = (
  worker: WorkerInfo,
  message: T
) => void;

/** Handler for worker lifecycle events. */
export type WorkerConnectedHandler = (worker: WorkerInfo) => void;
export type WorkerDisconnectedHandler = (
  worker: WorkerInfo,
  pendingRequestIds: ReadonlySet<string>
) => void;

/** Handler for additional WebSocket endpoints. */
export type WebSocketConnectionHandler = (ws: WebSocket) => void;

// ---------------------------------------------------------------------------
// Internal protocol types (not exported from package)
// ---------------------------------------------------------------------------

/** Worker registration message (worker → server) */
export interface RegistrationMessage {
  type: "worker_registration";
  workerId: string;
  workerName: string;
  capabilities: WorkerCapabilities;
  authToken?: string;
}

/** Registration acknowledgment (server → worker) */
export interface RegistrationAckMessage {
  type: "worker_registration_ack";
  success: boolean;
  error?: string;
  sessionId?: string;
  heartbeatIntervalMs?: number;
}

/** Heartbeat message (worker → server) */
export interface HeartbeatMessage {
  type: "heartbeat";
  workerId: string;
  timestamp: string;
}

/** Heartbeat acknowledgment (server → worker) */
export interface HeartbeatAckMessage {
  type: "heartbeat_ack";
  timestamp: string;
  nextHeartbeatDeadline: string;
}
