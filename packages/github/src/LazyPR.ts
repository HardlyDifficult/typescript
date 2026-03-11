/**
 * LazyPR
 *
 * Wraps a PRClient and lazily fetches PR data on first access, caching results.
 * Use `field(name)` to resolve a named field to a string for prompt template substitution.
 */

import type { PRClient } from "./PRClient.js";
import type { TimelineEntry } from "./timeline.js";
import type {
  CheckRun,
  PullRequest,
  PullRequestComment,
  PullRequestFile,
  PullRequestReview,
} from "./types.js";

/** Lazily fetches and caches pull request data from a {@link PRClient}. */
export class LazyPR {
  private basicData?: PullRequest;
  private diffData?: string;
  private filesData?: readonly PullRequestFile[];
  private reviewsData?: readonly PullRequestReview[];
  private commentsData?: readonly PullRequestComment[];
  private checksData?: readonly CheckRun[];
  private timelineData?: readonly TimelineEntry[];

  constructor(private readonly prClient: PRClient) {}

  async basic(): Promise<PullRequest> {
    this.basicData ??= await this.prClient.get();
    return this.basicData;
  }

  async diff(): Promise<string> {
    this.diffData ??= await this.prClient.diff();
    return this.diffData;
  }

  async files(): Promise<readonly PullRequestFile[]> {
    this.filesData ??= await this.prClient.files();
    return this.filesData;
  }

  async reviews(): Promise<readonly PullRequestReview[]> {
    this.reviewsData ??= await this.prClient.reviews();
    return this.reviewsData;
  }

  async comments(): Promise<readonly PullRequestComment[]> {
    this.commentsData ??= await this.prClient.comments();
    return this.commentsData;
  }

  async checks(): Promise<readonly CheckRun[]> {
    this.checksData ??= await this.prClient.checks();
    return this.checksData;
  }

  async timeline(): Promise<readonly TimelineEntry[]> {
    this.timelineData ??= await this.prClient.timeline();
    return this.timelineData;
  }

  /**
   * Resolve a named field to a string for use in prompt templates.
   *
   * Supported field names:
   *   "title"   - PR title
   *   "body"    - PR body (empty string if null)
   *   "author"  - PR author login
   *   "state"   - "open" | "closed"
   *   "draft"   - "true" | "false"
   *   "diff"    - raw unified diff text
   *   "files"   - newline-joined list of changed filenames
   *   "checks"  - human-readable check run summary
   *   "reviews" - human-readable review summary
   *   unknown   - ""
   */
  async field(name: string): Promise<string> {
    switch (name) {
      case "title": {
        return (await this.basic()).title;
      }
      case "body": {
        return (await this.basic()).body ?? "";
      }
      case "author": {
        return (await this.basic()).user.login;
      }
      case "state": {
        return (await this.basic()).state;
      }
      case "draft": {
        return String((await this.basic()).draft);
      }
      case "diff": {
        return await this.diff();
      }
      case "files": {
        return (await this.files()).map((f) => f.filename).join("\n");
      }
      case "checks": {
        const runs = await this.checks();
        if (runs.length === 0) {
          return "(no checks)";
        }
        return runs
          .map((c) => {
            const status =
              c.status === "completed"
                ? (c.conclusion ?? "completed")
                : c.status;
            return `${c.name}: ${status}`;
          })
          .join("\n");
      }
      case "reviews": {
        const revs = await this.reviews();
        if (revs.length === 0) {
          return "(no reviews)";
        }
        return revs
          .map(
            (r) =>
              `${r.user.login} (${r.state}): ${r.body.length > 200 ? `${r.body.slice(0, 200)}…` : r.body}`
          )
          .join("\n\n");
      }
      default: {
        return "";
      }
    }
  }
}
