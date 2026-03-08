/** Streaming event emitted while an agent run is in progress. */
export type AgentEvent =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "tool-start";
      tool: string;
      input: unknown;
    }
  | {
      type: "tool-finish";
      tool: string;
      input: unknown;
      output: string;
      ok: boolean;
    };

/** Configuration for running a single agent task. */
export interface RunAgentOptions {
  /** What the agent should do. */
  task: string;

  /** Directory the agent should operate in. */
  directory: string;

  /**
   * Model to use.
   *
   * Accepts either `provider/model` or just `model`.
   * When only the model is provided, `OPENCODE_PROVIDER` is used if present
   * and otherwise defaults to `anthropic`.
   * When omitted entirely, `OPENCODE_MODEL` is used.
   */
  model?: string;

  /** Extra top-level instructions for the run. */
  instructions?: string;

  /**
   * Execution mode.
   *
   * `edit` uses the default OpenCode tool permissions.
   * `read` restricts the run to read-only file tools.
   */
  mode?: "edit" | "read";

  /** Abort signal for cancellation. */
  signal?: AbortSignal;

  /** Called for streamed text and tool lifecycle events. */
  onEvent?: (event: AgentEvent) => void;
}

/** Result returned after the agent finishes or fails. */
export interface RunAgentResult {
  /** Whether the run completed without a session error. */
  ok: boolean;

  /** The streamed text output from the assistant. */
  output: string;

  /** Session error, when one occurred. */
  error?: string;

  /** Total wall-clock duration in milliseconds. */
  durationMs: number;

  /** OpenCode session identifier. */
  sessionId: string;
}
