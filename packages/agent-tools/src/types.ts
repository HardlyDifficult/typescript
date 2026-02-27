/**
 * Configuration and result types for OpenCode-based agent sessions.
 */

/** Configuration for running an agent session. */
export interface SessionConfig {
  /** The user's prompt. */
  prompt: string;

  /** Working directory for the session. */
  cwd: string;

  /**
   * Model identifier in `provider/model` format.
   *
   * @example 'anthropic/claude-sonnet-4-20250514'
   * @example 'openai/o3'
   * @example 'ollama/qwen3-coder-next'
   */
  model: string;

  /** System prompt to prepend. */
  systemPrompt?: string;

  /** Restrict to read-only tools (analysis mode). Default: false. */
  readOnly?: boolean;

  /**
   * Tool overrides — enable/disable specific OpenCode tools by name.
   * When provided, only tools set to `true` are available.
   *
   * @example { read: true, write: true, bash: true }
   */
  tools?: Partial<Record<string, boolean>>;

  /** Abort signal for cancellation. */
  abortSignal?: AbortSignal;

  /** Max agent iterations before stopping. */
  maxSteps?: number;

  /** Called with each text chunk as the agent streams its response. */
  onText?: (text: string) => void;

  /** Called when a tool execution starts. */
  onToolStart?: (toolName: string, input: unknown) => void;

  /** Called when a tool execution completes. */
  onToolEnd?: (toolName: string, output: string) => void;
}

/** Result of a completed agent session. */
export interface SessionResult {
  /** Whether the session completed successfully. */
  success: boolean;

  /** The agent's final text response. */
  text: string;

  /** Total wall-clock duration in milliseconds. */
  durationMs: number;

  /** OpenCode session identifier. */
  sessionId: string;
}
