/**
 * Backoff configuration for reconnection delays.
 */
export interface BackoffOptions {
  /** Initial delay in milliseconds. Default: 1000 */
  initialDelayMs?: number;
  /** Maximum delay in milliseconds. Default: 30000 */
  maxDelayMs?: number;
  /** Multiplier applied per attempt. Default: 2 */
  multiplier?: number;
}

/**
 * Heartbeat configuration for detecting dead connections.
 */
export interface HeartbeatOptions {
  /** Interval between pings in milliseconds. Default: 30000 */
  intervalMs?: number;
  /** Time to wait for pong before terminating. Default: 10000 */
  timeoutMs?: number;
}

/**
 * Auth configuration. Token is fetched on each connection (initial and reconnects),
 * so reconnects automatically pick up a fresh token.
 */
export interface AuthOptions {
  /** Returns a bearer token. Called on every connect and reconnect. */
  getToken: () => Promise<string> | string;
}

/**
 * Configuration options for ReconnectingWebSocket.
 */
export interface WebSocketOptions {
  /** WebSocket server URL */
  url: string;
  /** Backoff configuration for reconnection */
  backoff?: BackoffOptions;
  /** Heartbeat configuration */
  heartbeat?: HeartbeatOptions;
  /** Auth configuration. Token is added as an Authorization header on each connect. */
  auth?: AuthOptions;
  /** WebSocket subprotocols. */
  protocols?: string[];
  /** Additional headers for the WebSocket handshake. */
  headers?: Record<string, string>;
}

/**
 * Event callbacks for ReconnectingWebSocket.
 */
export interface WebSocketEvents<T> {
  /** Fired when the connection is established */
  open: () => void;
  /** Fired when the connection is closed */
  close: (code: number, reason: string) => void;
  /** Fired on connection or parse errors */
  error: (error: Error) => void;
  /** Fired when a message is received and parsed */
  message: (data: T) => void;
}

/**
 * Event callbacks for RequestTracker.
 */
export interface RequestTrackerEvents {
  /** Fired when draining mode is entered */
  draining: (reason: string) => void;
  /** Fired when all active requests complete during drain */
  drained: () => void;
}
