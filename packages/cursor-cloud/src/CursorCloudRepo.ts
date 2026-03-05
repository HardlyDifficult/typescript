import type { CursorCloudClient } from "./CursorCloudClient.js";
import type {
  CancelAgentRequest,
  CancelAgentResponse,
  CursorRunResult,
  DeleteAgentResponse,
  GetAgentLogsQuery,
  GetAgentLogsResponse,
  GetConversationResponse,
  ListAgentsQuery,
  ListAgentsResponse,
  RunCursorAgentOptions,
  UpdateAgentRequest,
  UpdateAgentResponse,
  WaitForAgentOptions,
} from "./types.js";
import { requireNonEmpty } from "./utils.js";

interface RepoChainState {
  repository: string;
  branch: string;
  model: string | undefined;
}

/** Chainable repo-scoped Cursor Cloud helper. */
export class CursorCloudRepo {
  constructor(
    private readonly client: CursorCloudClient,
    private readonly state: RepoChainState
  ) {}

  branch(name: string): CursorCloudRepo {
    return new CursorCloudRepo(this.client, {
      ...this.state,
      branch: requireNonEmpty(name, "branch"),
    });
  }

  model(name: string): CursorCloudRepo {
    return new CursorCloudRepo(this.client, {
      ...this.state,
      model: requireNonEmpty(name, "model"),
    });
  }

  async launch(prompt: string, options: RunCursorAgentOptions = {}) {
    return this.client.launch({
      prompt,
      repository: this.state.repository,
      branch: this.state.branch,
      model: options.model ?? this.state.model,
    });
  }

  wait(agentId: string, options: WaitForAgentOptions = {}) {
    return this.client.wait(agentId, options);
  }

  async run(
    prompt: string,
    options: RunCursorAgentOptions = {}
  ): Promise<CursorRunResult> {
    const launch = await this.launch(prompt, options);
    const final = await this.wait(launch.id, options);
    return { agentId: launch.id, launch, final };
  }

  async list(
    query: Omit<ListAgentsQuery, "repository"> = {}
  ): Promise<ListAgentsResponse> {
    return this.client.listAgents({
      ...query,
      repository: this.state.repository,
    });
  }

  async cancel(
    agentId: string,
    request: CancelAgentRequest = {}
  ): Promise<CancelAgentResponse> {
    return this.client.cancelAgent(agentId, request);
  }

  async update(
    agentId: string,
    request: UpdateAgentRequest
  ): Promise<UpdateAgentResponse> {
    return this.client.updateAgent(agentId, request);
  }

  async logs(
    agentId: string,
    query: GetAgentLogsQuery = {}
  ): Promise<GetAgentLogsResponse> {
    return this.client.getAgentLogs(agentId, query);
  }

  async delete(agentId: string): Promise<DeleteAgentResponse> {
    return this.client.deleteAgent(agentId);
  }

  async conversation(agentId: string): Promise<GetConversationResponse> {
    return this.client.getConversation(agentId);
  }

  async followup(agentId: string, prompt: string): Promise<void> {
    return this.client.followup(agentId, prompt);
  }

  async stop(agentId: string): Promise<void> {
    return this.client.stop(agentId);
  }

  async interrupt(agentId: string, prompt: string): Promise<void> {
    return this.client.interrupt(agentId, prompt);
  }
}
