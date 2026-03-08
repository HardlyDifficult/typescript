import type { Octokit } from "@octokit/rest";

import { runWithThrottle } from "../runWithThrottle.js";
import type { PullRequest, WatchThrottle } from "../types.js";

export interface WatchedPR {
  readonly pr: PullRequest;
  readonly owner: string;
  readonly name: string;
}

/** Fetches all open PRs from the given repos, optionally including the authenticated user's own PRs across GitHub. */
export async function fetchWatchedPRs(
  octokit: Octokit,
  username: string | undefined,
  repos: readonly string[],
  myPRs: boolean,
  throttle?: WatchThrottle
): Promise<readonly WatchedPR[]> {
  const results: WatchedPR[] = [];
  const seen = new Set<string>();

  for (const repoSpec of repos) {
    const [owner, name] = repoSpec.split("/");
    const response = await runWithThrottle(
      throttle,
      () =>
        octokit.pulls.list({
          owner,
          repo: name,
          state: "open",
          per_page: 100,
          sort: "updated",
          direction: "desc",
        }),
      1
    );

    for (const pr of response.data) {
      const key = `${owner}/${name}#${String(pr.number)}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({ pr: pr as unknown as PullRequest, owner, name });
      }
    }
  }

  if (myPRs) {
    if (username === undefined) {
      throw new Error(
        "Authenticated username is required when myPRs is enabled"
      );
    }

    const response = await runWithThrottle(
      throttle,
      () =>
        octokit.search.issuesAndPullRequests({
          q: `is:pr is:open author:${username}`,
          per_page: 100,
          sort: "updated",
        }),
      1
    );

    const pattern = /repos\/([^/]+)\/([^/]+)$/;
    for (const item of response.data.items) {
      const match = pattern.exec(item.repository_url);
      if (match !== null) {
        const [, owner, name] = match;
        const key = `${owner}/${name}#${String(item.number)}`;
        if (!seen.has(key)) {
          seen.add(key);
          const prResponse = await runWithThrottle(
            throttle,
            () =>
              octokit.pulls.get({
                owner,
                repo: name,
                pull_number: item.number,
              }),
            1
          );
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
