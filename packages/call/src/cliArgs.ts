import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";

const DEFAULT_SYSTEM_PROMPT = [
  "You are a concise phone assistant.",
  "Ask one question at a time.",
  "Do not read URLs, IDs, or file paths out loud unless requested.",
].join(" ");

interface ParseResultValues {
  "first-message"?: string;
  "system-prompt"?: string;
  source?: string;
  "api-token"?: string;
  endpoint?: string;
  help?: boolean;
}

export interface ParsedCliArgs {
  firstMessage?: string;
  systemPrompt?: string;
  source?: string;
  apiToken?: string;
  endpoint?: string;
  help: boolean;
}

export interface ResolvedCliArgs {
  firstMessage: string;
  systemPrompt: string;
  source: string;
  apiToken: string;
  endpoint: string;
}

function createDefaultSource(): string {
  return `call-${randomBytes(8).toString("hex")}`;
}

/** Parse CLI args for the call command using Node's built-in parser. */
export function parseCliArgs(argv: readonly string[]): ParsedCliArgs {
  const { values, positionals } = parseArgs({
    args: [...argv],
    options: {
      "first-message": { type: "string", short: "m" },
      "system-prompt": { type: "string", short: "p" },
      source: { type: "string", short: "s" },
      "api-token": { type: "string" },
      endpoint: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
    strict: true,
  });

  const typedValues = values as ParseResultValues;
  const positionalMessage = positionals.length > 0 ? positionals.join(" ") : undefined;

  return {
    firstMessage: typedValues["first-message"] ?? positionalMessage,
    systemPrompt: typedValues["system-prompt"],
    source: typedValues.source,
    apiToken: typedValues["api-token"],
    endpoint: typedValues.endpoint,
    help: typedValues.help === true,
  };
}

/** Resolve parsed args with environment defaults and validate required values. */
export function resolveCliArgs(
  parsed: ParsedCliArgs,
  env: NodeJS.ProcessEnv,
): ResolvedCliArgs {
  const firstMessage = parsed.firstMessage ?? env.CALL_FIRST_MESSAGE;
  const systemPrompt =
    parsed.systemPrompt ?? env.CALL_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT;
  const source = parsed.source ?? env.CALL_SOURCE ?? createDefaultSource();
  const apiToken = parsed.apiToken ?? env.CALL_API_TOKEN;
  const endpoint = parsed.endpoint ?? env.CALL_API_ENDPOINT;

  if (firstMessage === undefined || firstMessage.trim() === "") {
    throw new Error(
      "First message is required. Pass a positional message, --first-message, or CALL_FIRST_MESSAGE.",
    );
  }
  if (systemPrompt.trim() === "") {
    throw new Error("System prompt cannot be empty");
  }
  if (source.trim() === "") {
    throw new Error("Source cannot be empty");
  }
  if (apiToken === undefined || apiToken.trim() === "") {
    throw new Error("API token is required. Set --api-token or CALL_API_TOKEN.");
  }
  if (endpoint === undefined || endpoint.trim() === "") {
    throw new Error("Endpoint is required. Set --endpoint or CALL_API_ENDPOINT.");
  }

  return {
    firstMessage,
    systemPrompt,
    source,
    apiToken,
    endpoint,
  };
}

/** Build human-readable CLI help text. */
export function buildHelpText(): string {
  return [
    "Usage:",
    "  npx @hardlydifficult/call [message] [options]",
    "",
    "Required (flag or env):",
    "      --endpoint <url>           API base endpoint (or CALL_API_ENDPOINT)",
    "      --api-token <token>        API token (or CALL_API_TOKEN)",
    "",
    "Optional:",
    "  -m, --first-message <text>     First message spoken on the call",
    "  -p, --system-prompt <text>     System prompt for the voice agent",
    "  -s, --source <id>              Stable source ID (default: random)",
    "  -h, --help                     Show help",
  ].join("\n");
}
