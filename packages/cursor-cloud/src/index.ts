import { CursorCloudClient } from "./CursorCloudClient.js";
import type { CursorCloudClientOptions } from "./types.js";

export { CursorCloudClient, CursorCloudRepo } from "./CursorCloudClient.js";

// Export all types from types.js (which includes schema types)
export type {
  CursorAgentStatus,
  CursorCloudClientOptions,
  CursorRunResult,
  LaunchCursorAgentInput,
  LaunchCursorAgentRequest,
  LaunchCursorAgentResponse,
  RunCursorAgentOptions,
  WaitForAgentOptions,
  ListAgentsQuery,
  ListAgentsResponse,
  CancelAgentRequest,
  CancelAgentResponse,
  UpdateAgentRequest,
  UpdateAgentResponse,
  AgentLogEntry,
  GetAgentLogsQuery,
  GetAgentLogsResponse,
  DeleteAgentResponse,
  FetchLike,
} from "./types.js";

// Export all Zod schemas for validation
export {
  LaunchCursorAgentInputSchema,
  LaunchCursorAgentRequestSchema,
  LaunchCursorAgentResponseSchema,
  CursorAgentStatusSchema,
  ListAgentsQuerySchema,
  ListAgentsResponseSchema,
  CancelAgentRequestSchema,
  CancelAgentResponseSchema,
  UpdateAgentRequestSchema,
  UpdateAgentResponseSchema,
  GetAgentLogsQuerySchema,
  GetAgentLogsResponseSchema,
  DeleteAgentResponseSchema,
  AgentLogEntrySchema,
  CursorCloudClientOptionsSchema,
  WaitForAgentOptionsSchema,
  RunCursorAgentOptionsSchema,
  CursorRunResultSchema,
  AgentIdSchema,
  RepositorySchema,
  BranchSchema,
  ModelSchema,
  PromptSchema,
  AgentStatusSchema,
} from "./schemas.js";

/** Create a Cursor Cloud client with opinionated defaults. */
export function createCursorCloud(
  options?: CursorCloudClientOptions
): CursorCloudClient {
  return new CursorCloudClient(options);
}
