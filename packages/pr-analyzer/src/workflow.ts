/**
 * PR Scanning Workflow
 *
 * Scans a single PR by repo and number for real-time event handling.
 */

import { analyzePR } from "./analysis.js";
import type { AnalyzerHooks, PRAnalyzerClient, ScannedPR } from "./types.js";

/**
 * Scan a single PR by repo and number.
 * Used for real-time event handling - much faster than a full scan.
 */
export async function scanSinglePR(
  client: PRAnalyzerClient,
  botMention: string,
  owner: string,
  repo: string,
  prNumber: number,
  hooks?: AnalyzerHooks
): Promise<ScannedPR> {
  return analyzePR(client, owner, repo, prNumber, botMention, hooks);
}
