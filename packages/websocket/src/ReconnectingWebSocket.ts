import WebSocket from "ws";

import type {
  AuthOptions,
  BackoffOptions,
  HeartbeatOptions,
  WebSocketEvents,
  WebSocketOptions,
} from "./types.js";

const BACKOFF_DEFAULTS: Required<BackoffOptions> = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  multiplier: 2,
};

const HEARTBEAT_DEFAULTS: Required<HeartbeatOptions> = {
  intervalMs: 30000,
  timeoutMs: 10000,
};

/**
 * Calculate exponential backoff delay for a given attempt number.
 *
 * @param attempt - Zero-based attempt index
 * @param options - Backoff configuration
 * @returns Delay in milliseconds, capped at maxDelayMs
 */
export function getBackoffDelay(
  attempt: number,
  options: Required<BackoffOptions>
): number {
  const delay = options.initialDelayMs * Math.pow(options.multiplier, attempt);
  return Math.min(delay, options.maxDelayMs);
}

/**
 * A generic WebSocket client that automatically reconnects on disconnection,
 * sends protocol-level pings for heartbeats, and parses JSON messages.
 *
 * Supports optional bearer-token auth via the `auth` option. The token is
 * fetched on every connect (including reconnects), so reconnects automatically
 * pick up fresh tokens.
 *
 * @typeParam T - The shape of messages exchanged over the socket (JSON-serializable)
 */
export class ReconnectingWebSocket<T> {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly backoff: Required<BackoffOptions>;
  private readonly heartbeat: Required<HeartbeatOptions>;
  private readonly auth: AuthOptions | undefined;
  private readonly protocols: string[] | undefined;
  private readonly extraHeaders: Record<string, string> | undefined;
  private reconnectAttempt = 0;
  private shouldReconnect = true;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

  private readonly eventListeners = new Map<
    keyof WebSocketEvents<T>,
    Set<WebSocketEvents<T>[keyof WebSocketEvents<T>]>
  >();

  constructor(options: WebSocketOptions) {
    this.url = options.url;
    this.backoff = { ...BACKOFF_DEFAULTS, ...options.backoff };
    this.heartbeat = { ...HEARTBEAT_DEFAULTS, ...options.heartbeat };
    this.auth = options.auth;
    this.protocols = options.protocols;
    this.extraHeaders = options.headers;
  }

  /**
   * Subscribe to a WebSocket lifecycle event.
   * Multiple listeners per event are supported.
   * Returns an unsubscribe function.
   */
  on<K extends keyof WebSocketEvents<T>>(
    event: K,
    listener: WebSocketEvents<T>[K]
  ): () => void {
    let set = this.eventListeners.get(event);
    if (!set) {
      set = new Set();
      this.eventListeners.set(event, set);
    }
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  /**
   * Connect to the WebSocket server.
   * Idempotent — no-op if already connected.
   * If a reconnect timer is pending, cancels it and connects immediately,
   * resetting the attempt counter.
   *
   * When `auth` is configured, fetches a bearer token before connecting.
   */
  connect(): void {
    void this.connectInternal();
  }

  private async connectInternal(): Promise<void> {
    if (this.ws) {
      return;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
      this.reconnectAttempt = 0;
    }

    this.shouldReconnect = true;

    const headers: Record<string, string> = { ...this.extraHeaders };

    if (this.auth) {
      try {
        const token = await this.auth.getToken();
        if (token !== "") {
          headers.Authorization = `Bearer ${token}`;
        }
      } catch (err) {
        this.emit("error", err instanceof Error ? err : new Error(String(err)));
        this.scheduleReconnect();
        return;
      }
    }

    const hasHeaders = Object.keys(headers).length > 0;
    this.ws = new WebSocket(
      this.url,
      this.protocols,
      hasHeaders ? { headers } : undefined
    );

    this.ws.on("open", () => {
      this.onOpen();
    });

    this.ws.on("message", (data: WebSocket.RawData) => {
      this.onMessage(data);
    });

    this.ws.on("close", (code: number, reason: Buffer) => {
      this.onClose(code, reason.toString());
    });

    this.ws.on("error", (error: Error) => {
      this.onError(error);
    });

    this.ws.on("pong", () => {
      this.onPong();
    });
  }

  /**
   * Disconnect from the server and stop all reconnection attempts.
   * Closes the socket with code 1000.
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close(1000, "Client disconnecting");
      this.ws = null;
    }
  }

  /**
   * Force close and reconnect. Useful for token refresh: close the current
   * connection and reconnect with a fresh token (fetched via `auth.getToken`).
   * Resets the backoff counter.
   */
  reconnect(): void {
    this.stopHeartbeat();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    this.reconnectAttempt = 0;

    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close(4000, "Token refresh");
      this.ws = null;
    }

    this.shouldReconnect = true;
    void this.connectInternal();
  }

  /**
   * Send a message as JSON. No-op if not currently connected.
   */
  send(message: T): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Prevent reconnection without closing the current connection.
   * Useful for draining: deliver in-flight results but do not reconnect if the socket drops.
   */
  stopReconnecting(): void {
    this.shouldReconnect = false;
  }

  /** Whether the socket is currently open */
  get connected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private onOpen(): void {
    this.reconnectAttempt = 0;
    this.startHeartbeat();
    this.emit("open");
  }

  private onClose(code: number, reason: string): void {
    this.ws = null;
    this.stopHeartbeat();
    this.emit("close", code, reason);

    if (this.shouldReconnect) {
      this.scheduleReconnect();
    }
  }

  private onError(error: Error): void {
    this.emit("error", error);
  }

  private onPong(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private onMessage(data: WebSocket.RawData): void {
    try {
      let raw: string;
      if (Buffer.isBuffer(data)) {
        raw = data.toString("utf8");
      } else if (Array.isArray(data)) {
        raw = Buffer.concat(data).toString("utf8");
      } else {
        raw = Buffer.from(data).toString("utf8");
      }
      const parsed = JSON.parse(raw) as T;
      this.emit("message", parsed);
    } catch (err) {
      this.emit("error", err instanceof Error ? err : new Error(String(err)));
    }
  }

  private sendHeartbeat(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.ping();
      this.heartbeatTimeout = setTimeout(() => {
        this.ws?.terminate();
      }, this.heartbeat.timeoutMs);
      this.heartbeatTimeout.unref();
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeat.intervalMs);
    this.heartbeatInterval.unref();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private scheduleReconnect(): void {
    const delay = getBackoffDelay(this.reconnectAttempt, this.backoff);
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempt++;
      this.reconnectTimeout = null;
      this.ws = null;
      void this.connectInternal();
    }, delay);
    this.reconnectTimeout.unref();
  }

  private emit(event: "open"): void;
  private emit(event: "close", code: number, reason: string): void;
  private emit(event: "error", error: Error): void;
  private emit(event: "message", data: T): void;
  private emit(event: keyof WebSocketEvents<T>, ...args: unknown[]): void {
    const set = this.eventListeners.get(event);
    if (!set) {
      return;
    }
    for (const listener of set) {
      (listener as (...a: unknown[]) => void)(...args);
    }
  }
}

