#!/usr/bin/env node

import { buildHelpText, parseCliArgs, resolveCliArgs } from "./cliArgs.js";
import { CallClient } from "./client.js";

const POLL_TIMEOUT_MS = 600_000;
const POLL_INTERVAL_MS = 10_000;

function writeLine(message: string): void {
  process.stdout.write(`${message}\n`);
}

function writeError(message: string): void {
  process.stderr.write(`${message}\n`);
}

function formatClock(ms: number): string {
  const date = new Date(ms);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/** Runs the CLI command and returns process exit code. */
export async function runCli(argv: readonly string[]): Promise<number> {
  const parsed = parseCliArgs(argv);
  if (parsed.help) {
    writeLine(buildHelpText());
    return 0;
  }

  const resolved = resolveCliArgs(parsed, process.env);
  const client = new CallClient({
    endpoint: resolved.endpoint,
    apiToken: resolved.apiToken,
  });

  writeLine(`SOURCE:${resolved.source}`);

  const submitResponse = await client.submitCall({
    firstMessage: resolved.firstMessage,
    systemPrompt: resolved.systemPrompt,
    source: resolved.source,
  });
  writeLine(`SUBMIT:${JSON.stringify(submitResponse)}`);

  const pollResult = await client.pollStatus({
    source: resolved.source,
    timeoutMs: POLL_TIMEOUT_MS,
    pollIntervalMs: POLL_INTERVAL_MS,
    onPoll: (event) => {
      if (event.error !== undefined && event.error !== "") {
        writeLine(
          `${formatClock(event.atMs)} POLL ${String(event.attempt)}: error (${event.error})`,
        );
      } else {
        writeLine(
          `${formatClock(event.atMs)} POLL ${String(event.attempt)}: ${event.status}`,
        );
      }
    },
  });

  writeLine(`FINAL_STATUS:${pollResult.status}`);
  writeLine(`FINAL_PAYLOAD:${JSON.stringify(pollResult.payload)}`);

  const { transcript } = pollResult.payload;
  if (typeof transcript === "string" && transcript !== "") {
    writeLine("=== TRANSCRIPT START ===");
    writeLine(transcript);
    writeLine("=== TRANSCRIPT END ===");
  }

  return pollResult.status === "completed" ? 0 : 1;
}

async function main(): Promise<void> {
  try {
    const exitCode = await runCli(process.argv.slice(2));
    process.exitCode = exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeError(`ERROR:${message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
