import type { Octokit } from "@octokit/rest";

import type { PullRequest, WatchThrottle } from "../types.js";

export interface WatchedPR {
  readonly pr: PullRequest;
  readonly owner: string;
  readonly name: string;
}

/** Fetches all open PRs from the given repos, optionally including the authenticated user's own PRs across GitHub. */
export async function fetchWatchedPRs(
  octokit: Octokit,
  username: string,
  repos: readonly string[],
  myPRs: boolean,
  throttle?: WatchThrottle
): Promise<readonly WatchedPR[]> {
  const results: WatchedPR[] = [];
  const seen = new Set<string>();

  for (const repoSpec of repos) {
    const [owner, name] = repoSpec.split("/");
    await throttle?.wait(1);
    const response = await octokit.pulls.list({
      owner,
      repo: name,
      state: "open",
      per_page: 100,
      sort: "updated",
      direction: "desc",
    });

    for (const pr of response.data) {
      const key = `${owner}/${name}#${String(pr.number)}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ pr: pr as unknown as PullRequest, owner, name });
      }
    }
  }

  if (myPRs) {
    await throttle?.wait(1);
    const response = await octokit.search.issuesAndPullRequests({
      q: `is:pr is:open author:${username}`,
      per_page: 100,
      sort: "updated",
    });

    const pattern = /repos\/([^/]+)\/([^/]+)$/;
    for (const item of response.data.items) {
      const match = pattern.exec(item.repository_url);
      if (match !== null) {
        const [, owner, name] = match;
        const key = `${owner}/${name}#${String(item.number)}`;
        if (!seen.has(key)) {
          seen.add(key);
          await throttle?.wait(1);
          const prResponse = await octokit.pulls.get({
            owner,
            repo: name,
            pull_number: item.number,
          });
          results.push({
            pr: prResponse.data as unknown as PullRequest,
            owner,
            name,
          });
        }
      }
    }
  }

  return results;
}
