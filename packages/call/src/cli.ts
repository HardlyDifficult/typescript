#!/usr/bin/env node

import {
  formatClockTime,
  minutesToMilliseconds,
  secondsToMilliseconds,
} from "@hardlydifficult/date-time";
import { ConsolePlugin, Logger } from "@hardlydifficult/logger";
import { NotionClient, type NotionPropertyValue } from "@hardlydifficult/notion";

import { buildHelpText, parseCliArgs, resolveCliArgs } from "./cliArgs.js";
import { CallClient } from "./client.js";

const POLL_TIMEOUT_MS = minutesToMilliseconds(10);
const POLL_INTERVAL_MS = secondsToMilliseconds(10);

const logger = new Logger("info").use(new ConsolePlugin());

/** Runs the CLI command and returns process exit code. */
export async function runCli(argv: readonly string[]): Promise<number> {
  const parsed = parseCliArgs(argv);
  if (parsed.help) {
    logger.info(buildHelpText());
    return 0;
  }

  const resolved = resolveCliArgs(parsed, process.env);
  const client = new CallClient({
    endpoint: resolved.endpoint,
    apiToken: resolved.apiToken,
  });

  logger.info(`SOURCE:${resolved.source}`);

  const submitResponse = await client.submitCall({
    firstMessage: resolved.firstMessage,
    systemPrompt: resolved.systemPrompt,
    source: resolved.source,
  });
  logger.info(`SUBMIT:${JSON.stringify(submitResponse)}`);

  const pollResult = await client.pollStatus({
    source: resolved.source,
    timeoutMs: POLL_TIMEOUT_MS,
    pollIntervalMs: POLL_INTERVAL_MS,
    onPoll: (event) => {
      if (event.error !== undefined && event.error !== "") {
        logger.warn(
          `${formatClockTime(event.atMs)} POLL ${String(event.attempt)}: error (${event.error})`
        );
      } else {
        logger.info(
          `${formatClockTime(event.atMs)} POLL ${String(event.attempt)}: ${event.status}`
        );
      }
    },
  });

  logger.info(`FINAL_STATUS:${pollResult.status}`);
  logger.info(`FINAL_PAYLOAD:${JSON.stringify(pollResult.payload)}`);

  const { transcript, transcriptSummary } = pollResult.payload;
  if (typeof transcript === "string" && transcript !== "") {
    logger.info("=== TRANSCRIPT START ===");
    logger.info(transcript);
    logger.info("=== TRANSCRIPT END ===");
  }

  if (
    resolved.notionApiToken !== undefined &&
    resolved.notionDatabaseId !== undefined
  ) {
    await saveToNotion({
      apiToken: resolved.notionApiToken,
      databaseId: resolved.notionDatabaseId,
      source: resolved.source,
      status: pollResult.status,
      transcript: typeof transcript === "string" ? transcript : undefined,
      summary:
        typeof transcriptSummary === "string" ? transcriptSummary : undefined,
      logger,
    });
  }

  return pollResult.status === "completed" ? 0 : 1;
}

interface SaveToNotionOptions {
  apiToken: string;
  databaseId: string;
  source: string;
  status: string;
  transcript?: string;
  summary?: string;
  logger: Logger;
}

async function saveToNotion(options: SaveToNotionOptions): Promise<void> {
  const { apiToken, databaseId, source, status, transcript, summary, logger } =
    options;

  try {
    const notion = new NotionClient({ apiToken });

    const properties: Record<string, NotionPropertyValue> = {
      Name: {
        title: [{ type: "text", text: { content: source } }],
      },
      Status: {
        select: { name: status },
      },
      Date: {
        date: { start: new Date().toISOString() },
      },
    };

    if (summary !== undefined && summary !== "") {
      properties["Summary"] = {
        rich_text: [{ type: "text", text: { content: summary.slice(0, 2000) } }],
      };
    }

    const bodyBlocks =
      transcript !== undefined && transcript !== ""
        ? NotionClient.buildTranscriptBlocks(transcript)
        : undefined;

    const page = await notion.createPage(databaseId, properties, bodyBlocks);

    logger.info(`NOTION_PAGE:${page.url}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn(`Failed to save call to Notion: ${message}`);
  }
}

async function main(): Promise<void> {
  try {
    const exitCode = await runCli(process.argv.slice(2));
    process.exitCode = exitCode;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`ERROR:${message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void main();
}
