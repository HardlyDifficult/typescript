import type { Octokit } from "@octokit/rest";

import type { PushEvent, WatchThrottle } from "../types.js";

/** Checks a repo's default branch HEAD SHA and emits a push event if it changed. */
export async function checkDefaultBranch(
  octokit: Octokit,
  owner: string,
  name: string,
  defaultBranches: Map<string, string>,
  branchShas: Map<string, string>,
  throttle: WatchThrottle | undefined,
  initialized: boolean,
  emitPush: (event: PushEvent) => void
): Promise<void> {
  const key = `${owner}/${name}`;
  try {
    let branch = defaultBranches.get(key);
    if (branch === undefined) {
      await throttle?.wait(1);
      const { data } = await octokit.repos.get({ owner, repo: name });
      branch = data.default_branch;
      defaultBranches.set(key, branch);
    }

    await throttle?.wait(1);
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo: name,
      ref: `heads/${branch}`,
    });
    const { sha } = ref.object;
    const previousSha = branchShas.get(key);
    branchShas.set(key, sha);

    if (initialized && previousSha !== undefined && previousSha !== sha) {
      emitPush({ repo: { owner, name }, branch, sha, previousSha });
    }
  } catch {
    // Skip — repo may be private, deleted, or API error
  }
}
