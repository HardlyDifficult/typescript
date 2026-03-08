import type { Octokit } from "@octokit/rest";

import { runWithThrottle } from "../runWithThrottle.js";
import type { PushEvent, WatchThrottle } from "../types.js";

export interface BranchHeadCheckResult {
  readonly events: readonly PushEvent[];
  readonly errors: readonly Error[];
}

/** Tracks HEAD SHA of each watched repository's default branch across poll cycles. */
export class BranchHeadTracker {
  private readonly defaultBranches = new Map<string, string>();
  private readonly headShas = new Map<string, string>();

  /** Record a default branch name discovered from PR data (zero API cost). */
  harvestDefaultBranch(repoKey: string, branch: string): void {
    this.defaultBranches.set(repoKey, branch);
  }

  /** Check each repo's default branch HEAD and return events for any changes. */
  async check(
    octokit: Octokit,
    repos: readonly string[],
    throttle?: WatchThrottle
  ): Promise<BranchHeadCheckResult> {
    const events: PushEvent[] = [];
    const errors: Error[] = [];
    const seen = new Set(repos);

    for (const repoSpec of seen) {
      const [owner, name] = repoSpec.split("/");
      const repoKey = `${owner}/${name}`;
      try {
        const cachedBranch = this.defaultBranches.get(repoKey);
        const branch =
          cachedBranch ??
          (await (async () => {
            const { data } = await runWithThrottle(
              throttle,
              () =>
                octokit.repos.get({
                  owner,
                  repo: name,
                }),
              1
            );
            const discoveredBranch = (
              data as unknown as { default_branch: string }
            ).default_branch;
            this.defaultBranches.set(repoKey, discoveredBranch);
            return discoveredBranch;
          })());

        const { data: ref } = await runWithThrottle(
          throttle,
          () =>
            octokit.git.getRef({
              owner,
              repo: name,
              ref: `heads/${branch}`,
            }),
          1
        );
        const currentSha = ref.object.sha;
        const previousSha = this.headShas.get(repoKey);
        this.headShas.set(repoKey, currentSha);

        if (previousSha !== undefined && previousSha !== currentSha) {
          events.push({
            repo: { owner, name },
            branch,
            sha: currentSha,
            previousSha,
          });
        }
      } catch (error: unknown) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    return { events, errors };
  }

  /** Clean up cached state for a removed repo. */
  removeRepo(repo: string): void {
    this.defaultBranches.delete(repo);
    this.headShas.delete(repo);
  }
}
