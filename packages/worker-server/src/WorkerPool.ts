import WebSocket from "ws";

import {
  type ConnectedWorker,
  type WorkerInfo,
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

/** Convert internal ConnectedWorker to public WorkerInfo (strips websocket). */
export function toWorkerInfo(w: ConnectedWorker): WorkerInfo {
  return {
    id: w.id,
    name: w.name,
    status: w.status,
    capabilities: w.capabilities,
    sessionId: w.sessionId,
    connectedAt: w.connectedAt,
    lastHeartbeat: w.lastHeartbeat,
    activeRequests: w.activeRequests,
    completedRequests: w.completedRequests,
    pendingRequestIds: w.pendingRequests,
    categoryActiveRequests: w.categoryActiveRequests,
  };
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

  values(): IterableIterator<ConnectedWorker> {
    return this.workers.values();
  }

  /**
   * Get the least-loaded available worker supporting the given model.
   * If category is provided and the worker has a concurrencyLimits entry for
   * that category, the category slot count is checked in addition to the
   * overall maxConcurrentRequests limit.
   */
  getAvailableWorker(model: string, category?: string): ConnectedWorker | null {
    let bestWorker: ConnectedWorker | null = null;
    let lowestLoad = Infinity;

    for (const worker of this.workers.values()) {
      if (worker.status !== WorkerStatus.Available) {
        continue;
      }

      const supportsModel = worker.capabilities.models.some(
        (m) =>
          m.modelId === model ||
          m.modelId.includes(model) ||
          model.includes(m.modelId)
      );
      if (!supportsModel) {
        continue;
      }

      if (worker.activeRequests >= worker.capabilities.maxConcurrentRequests) {
        continue;
      }

      // Check per-category limit when applicable
      if (
        category !== undefined &&
        worker.capabilities.concurrencyLimits !== undefined
      ) {
        if (category in worker.capabilities.concurrencyLimits) {
          const categoryLimit = worker.capabilities.concurrencyLimits[category];
          const categoryCount =
            worker.categoryActiveRequests.get(category) ?? 0;
          if (categoryCount >= categoryLimit) {
            continue;
          }
        }
      }

      const load =
        worker.activeRequests / worker.capabilities.maxConcurrentRequests;
      if (load < lowestLoad) {
        lowestLoad = load;
        bestWorker = worker;
      }
    }

    return bestWorker;
  }

  /**
   * Get any available worker (for tasks that don't need a specific model).
   */
  getAnyAvailableWorker(): ConnectedWorker | null {
    for (const w of this.workers.values()) {
      if (
        w.status === WorkerStatus.Available ||
        w.status === WorkerStatus.Busy
      ) {
        return w;
      }
    }
    return null;
  }

  /**
   * Track a request as sent to a worker.
   * If category is provided it is stored for automatic lookup on release and
   * the per-category active count is incremented.
   */
  trackRequest(workerId: string, requestId: string, category?: string): void {
    const worker = this.workers.get(workerId);
    if (worker === undefined) {
      return;
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
  }

  /**
   * Release a request from whichever worker is handling it.
   * Category is looked up automatically from the stored requestCategories map.
   */
  releaseRequest(
    requestId: string,
    options?: { incrementCompleted?: boolean }
  ): void {
    for (const worker of this.workers.values()) {
      if (worker.pendingRequests.has(requestId)) {
        worker.pendingRequests.delete(requestId);
        worker.activeRequests = Math.max(0, worker.activeRequests - 1);

        // Decrement per-category count if this request had a category
        const category = worker.requestCategories.get(requestId);
        if (category !== undefined) {
          worker.requestCategories.delete(requestId);
          const prev = worker.categoryActiveRequests.get(category) ?? 0;
          worker.categoryActiveRequests.set(category, Math.max(0, prev - 1));
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
        break;
      }
    }
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
  send(workerId: string, message: Record<string, unknown>): boolean {
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
  broadcast(message: Record<string, unknown>): void {
    const json = JSON.stringify(message);
    for (const worker of this.workers.values()) {
      if (worker.websocket.readyState === WebSocket.OPEN) {
        try {
          worker.websocket.send(json);
        } catch {
          // Worker may be disconnecting
        }
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
