import type { CursorCloudClient } from "./CursorCloudClient.js";
import type {
  CancelAgentRequest,
  CancelAgentResponse,
  CursorAgentStatus,
  DeleteAgentResponse,
  GetAgentLogsQuery,
  GetAgentLogsResponse,
  GetConversationResponse,
  LaunchCursorAgentResponse,
  UpdateAgentRequest,
  UpdateAgentResponse,
  WaitForAgentOptions,
} from "./types.js";

/**
 * Thenable handle for one launched Cursor Cloud agent.
 * Awaiting this object resolves to the final terminal status.
 */
export class CursorCloudAgent implements PromiseLike<CursorAgentStatus> {
  private actions: Promise<void> = Promise.resolve();

  constructor(
    private readonly client: CursorCloudClient,
    private readonly launchPromise: Promise<LaunchCursorAgentResponse>,
    private readonly defaultWaitOptions: WaitForAgentOptions = {}
  ) {}

  /** Resolve to the launched agent id. */
  get id(): Promise<string> {
    return this.launchPromise.then((launch) => launch.id);
  }

  /** Resolve to the raw launch response. */
  launched(): Promise<LaunchCursorAgentResponse> {
    return this.launchPromise;
  }

  /** Queue a follow-up instruction and return this agent for chaining. */
  followUp(message: string): this {
    return this.enqueue(async (agentId) => {
      await this.client.sendFollowUp(agentId, message);
    });
  }

  /** Queue stop and return this agent for chaining. */
  stop(): this {
    return this.enqueue(async (agentId) => {
      await this.client.stopAgent(agentId);
    });
  }

  /** Queue stop + follow-up and return this agent for chaining. */
  interrupt(message: string): this {
    return this.enqueue(async (agentId) => {
      await this.client.interruptAgent(agentId, message);
    });
  }

  /** Get latest status. */
  async status(): Promise<CursorAgentStatus> {
    const agentId = await this.id;
    return this.client.getAgent(agentId);
  }

  /** Poll until terminal status or timeout. */
  async wait(options: WaitForAgentOptions = {}): Promise<CursorAgentStatus> {
    await this.actions;
    const agentId = await this.id;
    return this.client.waitForAgent(agentId, {
      ...this.defaultWaitOptions,
      ...options,
    });
  }

  async cancel(request: CancelAgentRequest = {}): Promise<CancelAgentResponse> {
    await this.actions;
    const agentId = await this.id;
    return this.client.cancelAgent(agentId, request);
  }

  async update(request: UpdateAgentRequest): Promise<UpdateAgentResponse> {
    await this.actions;
    const agentId = await this.id;
    return this.client.updateAgent(agentId, request);
  }

  async logs(query: GetAgentLogsQuery = {}): Promise<GetAgentLogsResponse> {
    await this.actions;
    const agentId = await this.id;
    return this.client.getAgentLogs(agentId, query);
  }

  async conversation(): Promise<GetConversationResponse> {
    await this.actions;
    const agentId = await this.id;
    return this.client.getConversation(agentId);
  }

  async delete(): Promise<DeleteAgentResponse> {
    await this.actions;
    const agentId = await this.id;
    return this.client.deleteAgent(agentId);
  }

  then<TResult1 = CursorAgentStatus, TResult2 = never>(
    onfulfilled?:
      | ((value: CursorAgentStatus) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.wait().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null
  ): Promise<CursorAgentStatus | TResult> {
    return this.wait().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<CursorAgentStatus> {
    return this.wait().finally(onfinally);
  }

  private enqueue(operation: (agentId: string) => Promise<void>): this {
    this.actions = this.actions.then(async () => {
      const agentId = await this.id;
      await operation(agentId);
    });
    return this;
  }
}
