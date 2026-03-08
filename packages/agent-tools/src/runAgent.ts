import { getClient } from "./server.js";
import type { AgentEvent, RunAgentOptions, RunAgentResult } from "./types.js";

const DEFAULT_PROVIDER = "anthropic";
const READ_ONLY_TOOLS = {
  read: true,
  glob: true,
  grep: true,
} as const;

interface AgentModel {
  providerID: string;
  modelID: string;
}

interface OpencodeEvent {
  type: string;
  properties: Record<string, unknown>;
}

interface TextPart {
  id: string;
  sessionID: string;
  type: "text";
  text: string;
}

interface ToolPart {
  id: string;
  sessionID: string;
  type: "tool";
  tool: string;
  state?: {
    status: string;
    input?: unknown;
    output?: string;
    error?: string;
  };
}

/**
 * Run one OpenCode task and stream back text/tool events through a single callback.
 */
export async function runAgent(
  options: RunAgentOptions
): Promise<RunAgentResult> {
  const startedAt = Date.now();
  const task = requireNonEmpty(options.task, "task");
  const directory = requireNonEmpty(options.directory, "directory");
  const outputParts: string[] = [];
  const model = resolveModel(options.model);
  const client = await getClient(directory);

  const session = await client.session.create({});
  const sessionId = String(session.id);
  let shouldStop = false;
  let error: string | undefined;

  const abortHandler = options.signal
    ? () => {
        void client.session.abort({ path: { id: sessionId } });
      }
    : undefined;

  if (abortHandler !== undefined && options.signal !== undefined) {
    options.signal.addEventListener("abort", abortHandler, { once: true });
  }

  const eventStream =
    (await client.event.subscribe()) as AsyncIterable<OpencodeEvent>;
  const eventPump = processSessionEvents(
    eventStream,
    sessionId,
    options.onEvent,
    outputParts,
    () => shouldStop,
    (message) => {
      error = message;
    }
  );

  let promptAccepted = true;

  try {
    await client.session.prompt({
      path: { id: sessionId },
      body: {
        model,
        ...(options.instructions !== undefined
          ? { system: options.instructions }
          : {}),
        ...(options.mode === "read" ? { tools: READ_ONLY_TOOLS } : {}),
        parts: [{ type: "text", text: task }],
      },
    });
  } catch (cause) {
    promptAccepted = false;
    error =
      options.signal?.aborted === true
        ? "Cancelled"
        : formatError(cause, "Agent run failed");
    shouldStop = true;
  }

  await Promise.race([eventPump, wait(promptAccepted ? 2_000 : 500)]);

  if (abortHandler !== undefined && options.signal !== undefined) {
    options.signal.removeEventListener("abort", abortHandler);
  }

  return {
    ok: promptAccepted && error === undefined,
    output: outputParts.join(""),
    ...(error !== undefined ? { error } : {}),
    durationMs: Date.now() - startedAt,
    sessionId,
  };
}

async function processSessionEvents(
  eventStream: AsyncIterable<OpencodeEvent>,
  sessionId: string,
  onEvent: RunAgentOptions["onEvent"],
  outputParts: string[],
  shouldStop: () => boolean,
  setError: (message: string) => void
): Promise<void> {
  const previousTextByPart = new Map<string, string>();
  const previousToolStatusByPart = new Map<string, string>();

  try {
    for await (const event of eventStream) {
      if (shouldStop()) {
        return;
      }

      switch (event.type) {
        case "message.part.updated": {
          const payload = event.properties as {
            part?: TextPart | ToolPart;
            delta?: string;
          };
          const { part } = payload;
          if (part?.sessionID !== sessionId) {
            break;
          }

          if (part.type === "text") {
            const delta = getTextDelta(part, payload.delta, previousTextByPart);
            if (delta !== "") {
              outputParts.push(delta);
              onEvent?.({ type: "text", text: delta });
            }
            break;
          }

          emitToolEvent(part, previousToolStatusByPart, onEvent);
          break;
        }

        case "session.idle": {
          const payload = event.properties as { sessionID?: string };
          if (payload.sessionID === sessionId) {
            return;
          }
          break;
        }

        case "session.error": {
          const payload = event.properties as {
            sessionID?: string;
            error?: unknown;
          };
          if (
            payload.sessionID === sessionId ||
            payload.sessionID === undefined
          ) {
            setError(extractSessionError(payload.error));
            return;
          }
          break;
        }

        default:
          break;
      }
    }
  } catch {
    // The server closes the SSE stream during shutdown and aborts.
  }
}

function emitToolEvent(
  part: ToolPart,
  previousToolStatusByPart: Map<string, string>,
  onEvent: ((event: AgentEvent) => void) | undefined
): void {
  const status = part.state?.status;
  if (
    status === undefined ||
    previousToolStatusByPart.get(part.id) === status
  ) {
    return;
  }

  previousToolStatusByPart.set(part.id, status);

  if (status === "running") {
    onEvent?.({
      type: "tool-start",
      tool: part.tool,
      input: part.state?.input ?? {},
    });
    return;
  }

  if (status === "completed") {
    onEvent?.({
      type: "tool-finish",
      tool: part.tool,
      input: part.state?.input ?? {},
      output: part.state?.output ?? "",
      ok: true,
    });
    return;
  }

  if (status === "error") {
    onEvent?.({
      type: "tool-finish",
      tool: part.tool,
      input: part.state?.input ?? {},
      output: part.state?.error ?? "Tool error",
      ok: false,
    });
  }
}

function getTextDelta(
  part: TextPart,
  delta: string | undefined,
  previousTextByPart: Map<string, string>
): string {
  const previousText = previousTextByPart.get(part.id) ?? "";
  previousTextByPart.set(part.id, part.text);

  if (delta !== undefined) {
    return delta;
  }

  if (part.text.startsWith(previousText)) {
    return part.text.slice(previousText.length);
  }

  return part.text;
}

function resolveModel(input?: string): AgentModel {
  const selectedModel = input ?? process.env.OPENCODE_MODEL;
  if (selectedModel === undefined || selectedModel.trim() === "") {
    throw new Error(
      "No model configured. Pass `model` to runAgent() or set OPENCODE_MODEL."
    );
  }

  const model = selectedModel.trim();
  const slashIndex = model.indexOf("/");

  if (slashIndex === -1) {
    return {
      providerID: process.env.OPENCODE_PROVIDER ?? DEFAULT_PROVIDER,
      modelID: model,
    };
  }

  const providerID = model.slice(0, slashIndex).trim();
  const modelID = model.slice(slashIndex + 1).trim();

  if (providerID === "" || modelID === "") {
    throw new Error(
      `Invalid model "${model}". Expected "provider/model" or just "model".`
    );
  }

  return { providerID, modelID };
}

function extractSessionError(error: unknown): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message !== ""
  ) {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof error.data === "object" &&
    error.data !== null &&
    "message" in error.data &&
    typeof error.data.message === "string" &&
    error.data.message !== ""
  ) {
    return error.data.message;
  }

  return "Unknown session error";
}

function formatError(error: unknown, prefix: string): string {
  if (error instanceof Error && error.message !== "") {
    return `${prefix}: ${error.message}`;
  }

  return `${prefix}: ${String(error)}`;
}

function requireNonEmpty(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new Error(`\`${fieldName}\` must not be empty.`);
  }
  return trimmed;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
