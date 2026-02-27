/**
 * OpenCode session runner — the main entry point for running agent sessions.
 *
 * Wraps the OpenCode SDK to provide a simple `runSession()` function that
 * handles server lifecycle, session creation, streaming, tool callbacks,
 * and cleanup.
 */

import type { SessionConfig, SessionResult } from "./types.js";
import { getOrCreateServer } from "./server.js";

/**
 * Run an agent session through OpenCode.
 *
 * Spawns the OpenCode server if needed, creates a session, sends the prompt,
 * and streams events back through the provided callbacks. Returns when the
 * agent has finished its full turn (including all tool use).
 *
 * @example
 * ```typescript
 * const result = await runSession({
 *   prompt: 'Fix the bug in auth.ts',
 *   cwd: '/path/to/repo',
 *   model: 'anthropic/claude-sonnet-4-20250514',
 *   onText: (text) => console.log(text),
 * });
 * ```
 */
export async function runSession(config: SessionConfig): Promise<SessionResult> {
  const startTime = Date.now();
  const textParts: string[] = [];

  const client = await getOrCreateServer(config.cwd);

  // Parse provider/model from the combined model string
  const slashIndex = config.model.indexOf("/");
  if (slashIndex === -1) {
    throw new Error(
      `Invalid model format "${config.model}". Expected "provider/model" (e.g. "anthropic/claude-sonnet-4-20250514").`
    );
  }
  const providerID = config.model.slice(0, slashIndex);
  const modelID = config.model.slice(slashIndex + 1);

  // Create a session
  const session = await client.session.create();
  const sessionId = session.id;

  // Set up abort handling
  const abortHandler = config.abortSignal
    ? () => { client.session.abort(sessionId).catch(() => {}); }
    : undefined;
  if (abortHandler && config.abortSignal) {
    config.abortSignal.addEventListener("abort", abortHandler, { once: true });
  }

  // Subscribe to the event stream for real-time updates
  const eventStream = await client.event.list();

  // Track whether we've seen our session complete
  let sessionDone = false;
  let sessionError: string | undefined;

  // Process events in the background
  const eventProcessing = processEvents(
    eventStream,
    sessionId,
    config,
    textParts,
    () => sessionDone,
    (done) => { sessionDone = done; },
    (err) => { sessionError = err; },
  );

  // Optionally inject system prompt as a no-reply context message
  if (config.systemPrompt) {
    await client.session.chat(sessionId, {
      providerID,
      modelID,
      parts: [{ type: "text", text: config.systemPrompt }],
      system: config.systemPrompt,
      ...(config.tools ? { tools: config.tools } : {}),
    });
  }

  // Send the actual prompt — this blocks until the agent finishes its full turn
  let success = true;
  try {
    const chatParams: Record<string, unknown> = {
      providerID,
      modelID,
      parts: [{ type: "text", text: config.prompt }],
    };

    // Apply tool configuration
    if (config.readOnly) {
      chatParams.tools = { read: true, glob: true, grep: true };
    } else if (config.tools) {
      chatParams.tools = config.tools;
    }

    await client.session.chat(sessionId, chatParams);
  } catch (error) {
    success = false;
    if (config.abortSignal?.aborted) {
      sessionError = "Cancelled";
    } else {
      sessionError = error instanceof Error ? error.message : String(error);
    }
  }

  // Signal event processing to stop and wait for it to drain
  sessionDone = true;

  // Give the event stream a moment to flush remaining events, then stop
  await Promise.race([
    eventProcessing,
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);

  // Cleanup
  if (abortHandler && config.abortSignal) {
    config.abortSignal.removeEventListener("abort", abortHandler);
  }

  return {
    success: success && !sessionError,
    text: textParts.join(""),
    durationMs: Date.now() - startTime,
    sessionId,
  };
}

/**
 * Process the SSE event stream, dispatching to callbacks.
 */
async function processEvents(
  eventStream: AsyncIterable<{
    type: string;
    properties: Record<string, unknown>;
  }>,
  sessionId: string,
  config: SessionConfig,
  textParts: string[],
  isDone: () => boolean,
  setDone: (done: boolean) => void,
  setError: (error: string) => void,
): Promise<void> {
  try {
    for await (const event of eventStream) {
      if (isDone()) break;

      // Only process events for our session
      const props = event.properties;

      switch (event.type) {
        case "message.part.updated": {
          const part = props as Record<string, unknown>;
          if (part.sessionID !== sessionId) break;

          handlePartUpdate(part, config, textParts);
          break;
        }

        case "session.idle": {
          if ((props as { sessionID?: string }).sessionID === sessionId) {
            setDone(true);
          }
          break;
        }

        case "session.error": {
          const errorProps = props as {
            sessionID?: string;
            error?: { message?: string };
          };
          if (
            errorProps.sessionID === sessionId ||
            errorProps.sessionID === undefined
          ) {
            setError(errorProps.error?.message ?? "Unknown session error");
            setDone(true);
          }
          break;
        }
      }
    }
  } catch {
    // Stream closed or aborted — expected during cleanup
  }
}

/**
 * Handle a `message.part.updated` event, dispatching to the appropriate callback.
 */
function handlePartUpdate(
  part: Record<string, unknown>,
  config: SessionConfig,
  textParts: string[],
): void {
  const partType = part.type as string;

  switch (partType) {
    case "text": {
      const text = part.text as string | undefined;
      if (text) {
        textParts.push(text);
        config.onText?.(text);
      }
      break;
    }

    case "tool": {
      const toolName = part.tool as string;
      const state = part.state as Record<string, unknown> | undefined;
      if (!state) break;

      const status = state.status as string;

      if (status === "running") {
        config.onToolStart?.(toolName, state.input ?? {});
      } else if (status === "completed") {
        config.onToolEnd?.(toolName, (state.output as string) ?? "");
      } else if (status === "error") {
        config.onToolEnd?.(
          toolName,
          (state.error as string) ?? "Tool error",
        );
      }
      break;
    }
  }
}
