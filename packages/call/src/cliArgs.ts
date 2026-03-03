import { randomBytes } from "node:crypto";

const DEFAULT_BOT_URL = "https://ai-bot-skpe.onrender.com";
const DEFAULT_SYSTEM_PROMPT = [
  "You are a concise phone assistant.",
  "Ask one question at a time.",
  "Do not read URLs, IDs, or file paths out loud unless requested.",
].join(" ");

export interface ParsedCliArgs {
  firstMessage?: string;
  systemPrompt?: string;
  source?: string;
  apiKey?: string;
  botUrl?: string;
  fallbackUrls: string[];
  timeoutSeconds?: number;
  pollIntervalSeconds?: number;
  requestTimeoutSeconds?: number;
  maxRetries?: number;
  retryBaseMs?: number;
  maxRetryDelayMs?: number;
  pollOnly: boolean;
  submitOnly: boolean;
  json: boolean;
  help: boolean;
}

export interface ResolvedCliArgs {
  firstMessage?: string;
  systemPrompt: string;
  source: string;
  apiKey: string;
  endpoints: string[];
  timeoutSeconds: number;
  pollIntervalSeconds: number;
  requestTimeoutSeconds: number;
  maxRetries: number;
  retryBaseMs: number;
  maxRetryDelayMs: number;
  pollOnly: boolean;
  submitOnly: boolean;
  json: boolean;
}

function readFlagValue(args: string[], index: number, flag: string): string {
  const value = args.at(index + 1);
  if (value === undefined || value.startsWith("-")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function parsePositiveInteger(value: string, fieldName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return parsed;
}

function parseIntegerFromEnv(
  value: string | undefined,
  fallback: number,
  fieldName: string,
): number {
  if (value === undefined || value.trim() === "") {
    return fallback;
  }
  return parsePositiveInteger(value, fieldName);
}

function parseFallbacks(value: string | undefined): string[] {
  if (value === undefined || value.trim() === "") {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");
}

function dedupe(values: readonly string[]): string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    unique.push(value);
  }
  return unique;
}

function createDefaultSource(): string {
  return `cowork-${randomBytes(8).toString("hex")}`;
}

/** Parse CLI args for the call command. */
export function parseCliArgs(argv: readonly string[]): ParsedCliArgs {
  const args = [...argv];
  const parsed: ParsedCliArgs = {
    fallbackUrls: [],
    pollOnly: false,
    submitOnly: false,
    json: false,
    help: false,
  };
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--first-message":
      case "-m":
        parsed.firstMessage = readFlagValue(args, i, arg);
        i += 1;
        break;
      case "--system-prompt":
      case "-p":
        parsed.systemPrompt = readFlagValue(args, i, arg);
        i += 1;
        break;
      case "--source":
      case "-s":
        parsed.source = readFlagValue(args, i, arg);
        i += 1;
        break;
      case "--api-key":
        parsed.apiKey = readFlagValue(args, i, arg);
        i += 1;
        break;
      case "--bot-url":
        parsed.botUrl = readFlagValue(args, i, arg);
        i += 1;
        break;
      case "--fallback-url":
        parsed.fallbackUrls.push(readFlagValue(args, i, arg));
        i += 1;
        break;
      case "--timeout-seconds":
        parsed.timeoutSeconds = parsePositiveInteger(
          readFlagValue(args, i, arg),
          "timeout-seconds",
        );
        i += 1;
        break;
      case "--poll-interval-seconds":
        parsed.pollIntervalSeconds = parsePositiveInteger(
          readFlagValue(args, i, arg),
          "poll-interval-seconds",
        );
        i += 1;
        break;
      case "--request-timeout-seconds":
        parsed.requestTimeoutSeconds = parsePositiveInteger(
          readFlagValue(args, i, arg),
          "request-timeout-seconds",
        );
        i += 1;
        break;
      case "--max-retries":
        parsed.maxRetries = parsePositiveInteger(
          readFlagValue(args, i, arg),
          "max-retries",
        );
        i += 1;
        break;
      case "--retry-base-ms":
        parsed.retryBaseMs = parsePositiveInteger(
          readFlagValue(args, i, arg),
          "retry-base-ms",
        );
        i += 1;
        break;
      case "--max-retry-delay-ms":
        parsed.maxRetryDelayMs = parsePositiveInteger(
          readFlagValue(args, i, arg),
          "max-retry-delay-ms",
        );
        i += 1;
        break;
      case "--poll-only":
        parsed.pollOnly = true;
        break;
      case "--submit-only":
        parsed.submitOnly = true;
        break;
      case "--json":
        parsed.json = true;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        positional.push(arg);
        break;
    }
  }

  if (parsed.firstMessage === undefined && positional.length > 0) {
    parsed.firstMessage = positional.join(" ").trim();
  }

  return parsed;
}

/** Resolve parsed args with environment defaults and validate required values. */
export function resolveCliArgs(
  parsed: ParsedCliArgs,
  env: NodeJS.ProcessEnv,
): ResolvedCliArgs {
  const source = parsed.source ?? env.COWORK_SOURCE ?? createDefaultSource();
  const systemPrompt =
    parsed.systemPrompt ?? env.COWORK_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT;
  const firstMessage = parsed.firstMessage ?? env.COWORK_FIRST_MESSAGE;
  const apiKey = parsed.apiKey ?? env.COWORK_API_KEY;
  const botUrl = parsed.botUrl ?? env.COWORK_BOT_URL ?? DEFAULT_BOT_URL;
  const endpointFallbacks = parseFallbacks(env.COWORK_BOT_URL_FALLBACKS);
  const endpoints = dedupe([
    botUrl,
    ...parsed.fallbackUrls,
    ...endpointFallbacks,
  ]);

  if (apiKey === undefined || apiKey.trim() === "") {
    throw new Error("API key is required. Set --api-key or COWORK_API_KEY.");
  }
  if (source.trim() === "") {
    throw new Error("source cannot be empty");
  }
  if (systemPrompt.trim() === "") {
    throw new Error("system prompt cannot be empty");
  }

  const timeoutSeconds =
    parsed.timeoutSeconds ??
    parseIntegerFromEnv(env.COWORK_TIMEOUT_SECONDS, 600, "COWORK_TIMEOUT_SECONDS");
  const pollIntervalSeconds =
    parsed.pollIntervalSeconds ??
    parseIntegerFromEnv(
      env.COWORK_POLL_INTERVAL_SECONDS,
      10,
      "COWORK_POLL_INTERVAL_SECONDS",
    );
  const requestTimeoutSeconds =
    parsed.requestTimeoutSeconds ??
    parseIntegerFromEnv(
      env.COWORK_REQUEST_TIMEOUT_SECONDS,
      20,
      "COWORK_REQUEST_TIMEOUT_SECONDS",
    );
  const maxRetries =
    parsed.maxRetries ??
    parseIntegerFromEnv(env.COWORK_MAX_RETRIES, 6, "COWORK_MAX_RETRIES");
  const retryBaseMs =
    parsed.retryBaseMs ??
    parseIntegerFromEnv(env.COWORK_RETRY_BASE_MS, 500, "COWORK_RETRY_BASE_MS");
  const maxRetryDelayMs =
    parsed.maxRetryDelayMs ??
    parseIntegerFromEnv(
      env.COWORK_MAX_RETRY_DELAY_MS,
      10_000,
      "COWORK_MAX_RETRY_DELAY_MS",
    );

  if (parsed.pollOnly && parsed.submitOnly) {
    throw new Error("--poll-only and --submit-only cannot be combined");
  }
  if (!parsed.pollOnly && (firstMessage === undefined || firstMessage.trim() === "")) {
    throw new Error(
      "First message is required. Pass a positional message, --first-message, or COWORK_FIRST_MESSAGE.",
    );
  }

  return {
    firstMessage,
    systemPrompt,
    source,
    apiKey,
    endpoints,
    timeoutSeconds,
    pollIntervalSeconds,
    requestTimeoutSeconds,
    maxRetries,
    retryBaseMs,
    maxRetryDelayMs,
    pollOnly: parsed.pollOnly,
    submitOnly: parsed.submitOnly,
    json: parsed.json,
  };
}

/** Build human-readable CLI help text. */
export function buildHelpText(): string {
  return [
    "Usage:",
    "  npx @hardlydifficult/call [message] [options]",
    "",
    "Options:",
    "  -m, --first-message <text>      First message spoken on the call",
    "  -p, --system-prompt <text>      System prompt for the voice agent",
    "  -s, --source <id>               Stable source identifier (default: random)",
    "      --api-key <token>           API token (or COWORK_API_KEY)",
    "      --bot-url <url>             Primary API endpoint",
    "      --fallback-url <url>        Fallback endpoint (repeatable)",
    "      --timeout-seconds <n>       Max poll duration (default: 600)",
    "      --poll-interval-seconds <n> Poll interval (default: 10)",
    "      --request-timeout-seconds <n> HTTP timeout per request (default: 20)",
    "      --max-retries <n>           Retries per request (default: 6)",
    "      --retry-base-ms <n>         Base backoff delay (default: 500)",
    "      --max-retry-delay-ms <n>    Max backoff delay (default: 10000)",
    "      --poll-only                 Skip submit and only poll existing source",
    "      --submit-only               Submit call and exit without polling",
    "      --json                      Print machine-readable JSON summary",
    "  -h, --help                      Show help",
  ].join("\n");
}
