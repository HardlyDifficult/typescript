import type { CursorCloudClient } from "./CursorCloudClient.js";
import type { CursorCloudSession } from "./CursorCloudSession.js";
import { requireNonEmpty } from "./utils.js";

interface SelectionState {
  repo: string;
  branch: string;
  model?: string;
}

/** Repo/branch/model selection before prompting an agent session. */
export class CursorCloudSelection {
  constructor(
    private readonly client: CursorCloudClient,
    private readonly state: SelectionState
  ) {}

  prompt(message: string): CursorCloudSession {
    return this.client.startSession({
      prompt: requireNonEmpty(message, "prompt"),
      repo: this.state.repo,
      branch: this.state.branch,
      ...(this.state.model !== undefined && { model: this.state.model }),
    });
  }
}
