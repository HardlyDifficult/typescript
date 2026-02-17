import type { Octokit } from "@octokit/rest";

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
    initialized: boolean,
    throttle?: WatchThrottle
  ): Promise<BranchHeadCheckResult> {
    const events: PushEvent[] = [];
    const errors: Error[] = [];
    const seen = new Set(repos);

    for (const repoSpec of seen) {
      const [owner, name] = repoSpec.split("/");
      const repoKey = `${owner}/${name}`;
      try {
        let branch = this.defaultBranches.get(repoKey);
        if (branch === undefined) {
          await throttle?.wait(1);
          const { data } = await octokit.repos.get({
            owner: owner!,
            repo: name!,
          });
          branch = (data as unknown as { default_branch: string })
            .default_branch;
          this.defaultBranches.set(repoKey, branch);
        }

        await throttle?.wait(1);
        const { data: ref } = await octokit.git.getRef({
          owner: owner!,
          repo: name!,
          ref: `heads/${branch}`,
        });
        const currentSha = ref.object.sha;
        const previousSha = this.headShas.get(repoKey);
        this.headShas.set(repoKey, currentSha);

        if (
          initialized &&
          previousSha !== undefined &&
          previousSha !== currentSha
        ) {
          events.push({
            repo: { owner: owner!, name: name! },
            branch,
            sha: currentSha,
            previousSha,
          });
        }
      } catch (error: unknown) {
        errors.push(
          error instanceof Error ? error : new Error(String(error))
        );
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
