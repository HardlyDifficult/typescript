import {
  parseGitHubPullRequestReference,
  parseGitHubRepoReference,
  type PullRequest,
} from "@hardlydifficult/github";

import { getAvailableActions, type PRActionDescriptor } from "./actions.js";
import { analyzePR } from "./analysis.js";
import { classifyPRs } from "./classification.js";
import type {
  ActionContext,
  ActionDefinition,
  AnalyzerHooks,
  ClassificationConfig,
  DiscoveredPR,
  Logger,
  PRAnalyzerClient,
  ScannedPR,
  ScanResult,
} from "./types.js";

export const DEFAULT_BOT_MENTION = "@cursor";

export type PRReference = number | string | PullRequest | DiscoveredPR;

export interface ActionablePR extends ScannedPR {
  readonly actions: readonly PRActionDescriptor[];
}

export type PRInbox = ScanResult<ActionablePR>;

export interface PRAnalyzerConfig {
  readonly client: PRAnalyzerClient;
  readonly repo?: string;
  readonly bot?: string;
  readonly hooks?: AnalyzerHooks;
  readonly logger?: Logger;
  readonly classify?: ClassificationConfig;
  readonly actions?: readonly ActionDefinition[];
  readonly actionContext?: ActionContext;
}

export interface PRAnalyzer {
  readonly repo?: string;
  analyze(pr: PRReference): Promise<ActionablePR>;
  analyzeMany(prs: readonly PRReference[]): Promise<readonly ActionablePR[]>;
  inbox(prs: readonly PRReference[]): Promise<PRInbox>;
  mine(): Promise<PRInbox>;
  classify(prs: readonly ScannedPR[]): PRInbox;
  actionsFor(pr: ScannedPR): readonly PRActionDescriptor[];
}

interface RepoContext {
  readonly owner: string;
  readonly repo: string;
}

/**
 * Create a PR analyzer with optional repo scoping, classification, and actions.
 */
export function createPRAnalyzer(config: PRAnalyzerConfig): PRAnalyzer {
  const repo = resolveConfiguredRepo(config.repo);
  const bot = config.bot ?? DEFAULT_BOT_MENTION;
  const extraActions = config.actions ?? [];
  const classification = config.classify;
  const actionContext = config.actionContext ?? {};

  const withActions = (pr: ScannedPR): ActionablePR => ({
    ...pr,
    actions: getAvailableActions(pr, extraActions, actionContext),
  });

  const analyze = async (ref: PRReference): Promise<ActionablePR> =>
    withActions(
      await analyzeReference(config.client, ref, repo, bot, config.hooks)
    );

  const analyzeMany = async (
    refs: readonly PRReference[]
  ): Promise<readonly ActionablePR[]> => {
    const settled = await Promise.allSettled(refs.map((ref) => analyze(ref)));
    const results: ActionablePR[] = [];

    for (const [index, result] of settled.entries()) {
      if (result.status === "fulfilled") {
        results.push(result.value);
        continue;
      }

      const ref = refs[index];
      config.logger?.error("Failed to analyze PR", {
        ref: describeReference(ref),
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }

    return results;
  };

  const buildInbox = (prs: readonly ScannedPR[]): PRInbox =>
    classifyPRs(
      prs.map((pr) => withActions(pr)),
      classification
    );

  const inbox = async (refs: readonly PRReference[]): Promise<PRInbox> =>
    buildInbox(await analyzeMany(refs));

  const mine = async (): Promise<PRInbox> => {
    const myPRs = await listMyOpenPRs(config.client);
    const refs = myPRs
      .filter(({ repo: current }) =>
        repo === undefined
          ? true
          : current.owner === repo.owner && current.name === repo.repo
      )
      .map(
        ({ pr, repo: current }) =>
          ({
            pr,
            repoOwner: current.owner,
            repoName: current.name,
          }) satisfies DiscoveredPR
      );

    return inbox(refs);
  };

  return {
    repo: repo === undefined ? undefined : `${repo.owner}/${repo.repo}`,
    analyze,
    analyzeMany,
    inbox,
    mine,
    classify: buildInbox,
    actionsFor: (pr) => getAvailableActions(pr, extraActions, actionContext),
  };
}

async function analyzeReference(
  client: PRAnalyzerClient,
  ref: PRReference,
  repo: RepoContext | undefined,
  bot: string,
  hooks: AnalyzerHooks | undefined
): Promise<ScannedPR> {
  if (typeof ref === "number") {
    const configuredRepo = requireConfiguredRepo(repo);
    return analyzePR(
      client,
      configuredRepo.owner,
      configuredRepo.repo,
      ref,
      bot,
      hooks
    );
  }

  if (typeof ref === "string") {
    const trimmed = ref.trim();
    if (/^\d+$/.test(trimmed)) {
      return analyzeReference(
        client,
        Number.parseInt(trimmed, 10),
        repo,
        bot,
        hooks
      );
    }

    const parsed = parseGitHubPullRequestReference(trimmed);
    if (parsed === null) {
      throw new Error(
        `Invalid pull request reference: ${trimmed}. Expected "owner/repo#123" or a GitHub pull request URL.`
      );
    }

    return analyzePR(
      client,
      parsed.owner,
      parsed.repo,
      parsed.number,
      bot,
      hooks
    );
  }

  if (isDiscoveredPR(ref)) {
    return analyzePR(client, ref.repoOwner, ref.repoName, ref.pr, bot, hooks);
  }

  return analyzePR(
    client,
    ref.base.repo.owner.login,
    ref.base.repo.name,
    ref,
    bot,
    hooks
  );
}

function resolveConfiguredRepo(
  repo: string | undefined
): RepoContext | undefined {
  if (repo === undefined) {
    return undefined;
  }

  const parsed = parseGitHubRepoReference(repo);
  if (parsed === null) {
    throw new Error(
      `Invalid repository reference: ${repo}. Expected "owner/repo" or a GitHub repository URL.`
    );
  }

  return parsed;
}

function requireConfiguredRepo(repo: RepoContext | undefined): RepoContext {
  if (repo === undefined) {
    throw new Error(
      "A repository is required when analyzing PR numbers. Pass `repo` to createPRAnalyzer({ repo }) first."
    );
  }

  return repo;
}

function isDiscoveredPR(ref: PRReference): ref is DiscoveredPR {
  return (
    typeof ref === "object" &&
    "pr" in ref &&
    "repoOwner" in ref &&
    "repoName" in ref
  );
}

function describeReference(ref: PRReference | undefined): string {
  if (ref === undefined) {
    return "unknown";
  }

  if (typeof ref === "number") {
    return `#${String(ref)}`;
  }

  if (typeof ref === "string") {
    return ref;
  }

  if (isDiscoveredPR(ref)) {
    return `${ref.repoOwner}/${ref.repoName}#${String(ref.pr.number)}`;
  }

  return `${ref.base.repo.full_name}#${String(ref.number)}`;
}

async function listMyOpenPRs(client: PRAnalyzerClient): Promise<
  readonly {
    readonly pr: PullRequest;
    readonly repo: { readonly owner: string; readonly name: string };
  }[]
> {
  if (client.myOpenPRs !== undefined) {
    return client.myOpenPRs();
  }

  throw new Error("The GitHub client must implement myOpenPRs().");
}
