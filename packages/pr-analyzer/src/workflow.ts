/**
 * PR Scanning Workflow
 *
 * Scans a single PR by repo and number for real-time event handling.
 */

import type { GitHubClient } from "@hardlydifficult/github";

import { analyzePR } from "./analysis.js";
import type { AnalyzerHooks, ScannedPR } from "./types.js";

/**
 * Scan a single PR by repo and number.
 * Used for real-time event handling - much faster than a full scan.
 */
export async function scanSinglePR(
  client: GitHubClient,
  botMention: string,
  owner: string,
  repo: string,
  prNumber: number,
  hooks?: AnalyzerHooks,
): Promise<ScannedPR> {
  const pr = await client.repo(owner, repo).pr(prNumber).get();
  return analyzePR(client, owner, repo, pr, botMention, hooks);
}
