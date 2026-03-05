import { CursorCloudClient } from "./CursorCloudClient.js";
import type { CursorCloudClientOptions } from "./types.js";

export { CursorCloudAgent } from "./CursorCloudAgent.js";
export { CursorCloudClient } from "./CursorCloudClient.js";

// Export all types from types.js (which includes schema types)
export type {
  CursorAgentStatus,
  CursorCloudClientOptions,
  Webhook,
  LaunchCursorAgentInput,
  LaunchCursorAgentRequest,
  LaunchCursorAgentResponse,
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
  ConversationMessage,
  GetConversationResponse,
  FollowupRequest,
  StopAgentResponse,
  FetchLike,
} from "./types.js";

// Export all Zod schemas for validation
export {
  WebhookSchema,
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
  ConversationMessageSchema,
  GetConversationResponseSchema,
  FollowupRequestSchema,
  StopAgentResponseSchema,
  CursorCloudClientOptionsSchema,
  WaitForAgentOptionsSchema,
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
