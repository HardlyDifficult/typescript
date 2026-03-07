import WebSocket from "ws";

import {
  type ConnectedWorker,
  type ModelInfo,
  type WorkerCapabilities,
  type WorkerInfo,
  type WorkerMessage,
  type WorkerServerLogger,
  WorkerStatus,
} from "./types.js";

function noop(): void {
  // intentional no-op
}

const NO_OP_LOGGER: WorkerServerLogger = {
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
};

function cloneModelInfo(model: ModelInfo): ModelInfo {
  return Object.freeze({ ...model });
}

function cloneCapabilities(
  capabilities: WorkerCapabilities
): WorkerCapabilities {
  return Object.freeze({
    maxConcurrentRequests: capabilities.maxConcurrentRequests,
    models: Object.freeze(capabilities.models.map(cloneModelInfo)),
    ...(capabilities.metadata !== undefined && {
      metadata: Object.freeze({ ...capabilities.metadata }),
    }),
    ...(capabilities.concurrencyLimits !== undefined && {
      concurrencyLimits: Object.freeze({
        ...capabilities.concurrencyLimits,
      }),
    }),
  });
}

function getLoad(worker: ConnectedWorker): number {
  return worker.activeRequests / worker.capabilities.maxConcurrentRequests;
}

function supportsModel(worker: ConnectedWorker, model: string): boolean {
  return worker.capabilities.models.some(
    (candidate) =>
      candidate.modelId === model ||
      candidate.modelId.includes(model) ||
      model.includes(candidate.modelId)
  );
}

function hasCategoryCapacity(
  worker: ConnectedWorker,
  category?: string
): boolean {
  if (category === undefined) {
    return true;
  }

  const categoryLimit = worker.capabilities.concurrencyLimits?.[category];
  if (categoryLimit === undefined) {
    return true;
  }

  return (worker.categoryActiveRequests.get(category) ?? 0) < categoryLimit;
}

function isDispatchCandidate(
  worker: ConnectedWorker,
  options: { model?: string; category?: string }
): boolean {
  if (worker.status !== WorkerStatus.Available) {
    return false;
  }

  if (worker.activeRequests >= worker.capabilities.maxConcurrentRequests) {
    return false;
  }

  if (options.model !== undefined && !supportsModel(worker, options.model)) {
    return false;
  }

  return hasCategoryCapacity(worker, options.category);
}

function createRequestSnapshot(
  worker: ConnectedWorker
): WorkerInfo["requests"] {
  const activeByCategory = Object.freeze(
    Object.fromEntries(
      Array.from(worker.categoryActiveRequests.entries()).filter(
        ([, count]) => count > 0
      )
    ) as Record<string, number>
  );

  return Object.freeze({
    active: worker.activeRequests,
    completed: worker.completedRequests,
    pendingIds: Object.freeze(Array.from(worker.pendingRequests)),
    activeByCategory,
  });
}

/** Convert internal ConnectedWorker to public WorkerInfo (strips websocket). */
export function toWorkerInfo(worker: ConnectedWorker): WorkerInfo {
  return Object.freeze({
    id: worker.id,
    name: worker.name,
    status: worker.status,
    capabilities: cloneCapabilities(worker.capabilities),
    sessionId: worker.sessionId,
    connectedAt: new Date(worker.connectedAt),
    lastHeartbeat: new Date(worker.lastHeartbeat),
    requests: createRequestSnapshot(worker),
  });
}

/**
 * Manages connected worker state and selection.
 */
export class WorkerPool {
  private readonly workers = new Map<string, ConnectedWorker>();
  private readonly logger: WorkerServerLogger;

  constructor(logger?: WorkerServerLogger) {
    this.logger = logger ?? NO_OP_LOGGER;
  }

  add(worker: ConnectedWorker): void {
    this.workers.set(worker.id, worker);
  }

  remove(id: string): ConnectedWorker | undefined {
    const worker = this.workers.get(id);
    if (worker !== undefined) {
      this.workers.delete(id);
    }
    return worker;
  }

  get(id: string): ConnectedWorker | undefined {
    return this.workers.get(id);
  }

  has(id: string): boolean {
    return this.workers.has(id);
  }

  getCount(): number {
    return this.workers.size;
  }

  getAvailableCount(): number {
    let count = 0;
    for (const worker of this.workers.values()) {
      if (worker.status === WorkerStatus.Available) {
        count++;
      }
    }
    return count;
  }

  getDispatchCandidates(options: {
    model?: string;
    category?: string;
  }): ConnectedWorker[] {
    return Array.from(this.workers.values())
      .filter((worker) => isDispatchCandidate(worker, options))
      .sort((left, right) => {
        const loadDifference = getLoad(left) - getLoad(right);
        if (loadDifference !== 0) {
          return loadDifference;
        }

        return left.id.localeCompare(right.id);
      });
  }

  /**
   * Get the least-loaded available worker supporting the given model.
   * If category is provided and the worker has a concurrency limit for that
   * category, the category slot count is checked in addition to overall load.
   */
  getAvailableWorker(model: string, category?: string): ConnectedWorker | null {
    return this.getDispatchCandidates({ model, category })[0] ?? null;
  }

  /**
   * Track a request as sent to a worker.
   * If category is provided it is stored for automatic lookup on release and
   * the per-category active count is incremented.
   */
  trackRequest(
    workerId: string,
    requestId: string,
    category?: string
  ): boolean {
    const worker = this.workers.get(workerId);
    if (worker === undefined) {
      return false;
    }

    worker.activeRequests++;
    worker.pendingRequests.add(requestId);

    if (category !== undefined) {
      worker.requestCategories.set(requestId, category);
      worker.categoryActiveRequests.set(
        category,
        (worker.categoryActiveRequests.get(category) ?? 0) + 1
      );
    }

    if (worker.activeRequests >= worker.capabilities.maxConcurrentRequests) {
      worker.status = WorkerStatus.Busy;
    }

    return true;
  }

  /**
   * Release a request from whichever worker is handling it.
   * Category is looked up automatically from the stored requestCategories map.
   */
  releaseRequest(
    requestId: string,
    options?: { incrementCompleted?: boolean }
  ): boolean {
    for (const worker of this.workers.values()) {
      if (!worker.pendingRequests.has(requestId)) {
        continue;
      }

      worker.pendingRequests.delete(requestId);
      worker.activeRequests = Math.max(0, worker.activeRequests - 1);

      const category = worker.requestCategories.get(requestId);
      if (category !== undefined) {
        worker.requestCategories.delete(requestId);
        const nextCount = Math.max(
          0,
          (worker.categoryActiveRequests.get(category) ?? 0) - 1
        );

        if (nextCount === 0) {
          worker.categoryActiveRequests.delete(category);
        } else {
          worker.categoryActiveRequests.set(category, nextCount);
        }
      }

      if (options?.incrementCompleted === true) {
        worker.completedRequests++;
      }

      if (
        worker.status === WorkerStatus.Busy &&
        worker.activeRequests < worker.capabilities.maxConcurrentRequests
      ) {
        worker.status = WorkerStatus.Available;
      }

      return true;
    }

    return false;
  }

  /**
   * Count total free slots for the given model across all available workers.
   * Accounts for per-category limits when category is provided.
   */
  getAvailableSlotCount(model: string, category?: string): number {
    let count = 0;

    for (const worker of this.workers.values()) {
      if (worker.status !== WorkerStatus.Available) {
        continue;
      }

      if (!supportsModel(worker, model)) {
        continue;
      }

      const workerFreeSlots =
        worker.capabilities.maxConcurrentRequests - worker.activeRequests;

      if (
        category !== undefined &&
        worker.capabilities.concurrencyLimits?.[category] !== undefined
      ) {
        const categoryLimit = worker.capabilities.concurrencyLimits[category];
        const categoryCount = worker.categoryActiveRequests.get(category) ?? 0;
        count += Math.min(
          workerFreeSlots,
          Math.max(0, categoryLimit - categoryCount)
        );
        continue;
      }

      count += workerFreeSlots;
    }

    return count;
  }

  /** Get public info about all connected workers. */
  getWorkerInfoList(): WorkerInfo[] {
    return Array.from(this.workers.values()).map(toWorkerInfo);
  }

  /**
   * Check health of all workers based on heartbeat timeout.
   * Returns IDs of workers that are presumed dead (heartbeat > timeout * 3).
   */
  checkHealth(heartbeatTimeoutMs: number): string[] {
    const now = Date.now();
    const deadWorkerIds: string[] = [];

    for (const worker of this.workers.values()) {
      const timeSinceHeartbeat = now - worker.lastHeartbeat.getTime();

      if (timeSinceHeartbeat > heartbeatTimeoutMs) {
        if (worker.status !== WorkerStatus.Unhealthy) {
          this.logger.warn("Worker heartbeat timeout", {
            workerId: worker.id,
            timeSinceHeartbeat,
            threshold: heartbeatTimeoutMs,
          });
          worker.status = WorkerStatus.Unhealthy;
        }

        if (timeSinceHeartbeat > heartbeatTimeoutMs * 3) {
          deadWorkerIds.push(worker.id);
        }
      }
    }

    return deadWorkerIds;
  }

  /** Send a JSON message to a specific worker. */
  send(workerId: string, message: WorkerMessage): boolean {
    const worker = this.workers.get(workerId);
    if (worker === undefined) {
      return false;
    }

    if (worker.websocket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      worker.websocket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  /** Broadcast a JSON message to all connected workers with open sockets. */
  broadcast(message: WorkerMessage): void {
    const json = JSON.stringify(message);

    for (const worker of this.workers.values()) {
      if (worker.websocket.readyState !== WebSocket.OPEN) {
        continue;
      }

      try {
        worker.websocket.send(json);
      } catch {
        // Worker may be disconnecting
      }
    }
  }

  /** Close all worker connections. */
  closeAll(): void {
    for (const worker of this.workers.values()) {
      try {
        worker.websocket.close(1001, "Server shutting down");
      } catch {
        // Ignore close errors
      }
    }

    this.workers.clear();
  }
}
