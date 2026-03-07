import { z } from "zod";

// Base schemas
export const AgentIdSchema = z.string().min(1, "Agent ID cannot be empty");

export const RepositorySchema = z.string().min(1, "Repository cannot be empty");

export const BranchSchema = z.string().min(1, "Branch cannot be empty");

export const ModelSchema = z.string().min(1, "Model cannot be empty");

export const PromptSchema = z.string().min(1, "Prompt cannot be empty");

// Agent status enum
export const AgentStatusSchema = z.enum([
  "queued",
  "running",
  "archived",
  "completed",
  "failed",
  "canceled",
  "cancelled",
  "timeout",
  "unknown",
]);

// Webhook schema
export const WebhookSchema = z.object({
  url: z.url(),
  secret: z.string().optional(),
});

// Launch agent schemas
export const LaunchCursorAgentInputSchema = z.object({
  prompt: PromptSchema,
  repo: RepositorySchema,
  branch: BranchSchema.optional(),
  model: ModelSchema.optional(),
  webhook: WebhookSchema.optional(),
});

export const LaunchCursorAgentRequestSchema = z.object({
  prompt: z.object({
    text: PromptSchema,
  }),
  source: z.object({
    repository: RepositorySchema,
    branch: BranchSchema,
  }),
  model: ModelSchema.optional(),
  webhook: WebhookSchema.optional(),
});

export const LaunchCursorAgentResponseSchema = z
  .object({
    id: z.string().min(1),
    status: AgentStatusSchema.optional(),
  })
  .catchall(z.unknown()); // Allow additional properties

// Agent status schemas
export const CursorAgentStatusSchema = z
  .object({
    id: z.string().min(1),
    status: AgentStatusSchema,
    model: ModelSchema.optional(),
    createdAt: z.string().optional(),
    startedAt: z.string().optional(),
    completedAt: z.string().optional(),
    gitBranch: z.string().optional(),
    branchUrl: z.url().optional(),
    repoName: z.string().optional(),
    pullRequestUrl: z.url().optional(),
  })
  .catchall(z.unknown()); // Allow additional properties

// List agents schemas
export const ListAgentsQuerySchema = z.object({
  repo: RepositorySchema.optional(),
  status: AgentStatusSchema.optional(),
  includeArchived: z.boolean().optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
  createdAfter: z.string().optional(),
  createdBefore: z.string().optional(),
});

export const ListAgentsResponseSchema = z.object({
  agents: z.array(CursorAgentStatusSchema),
  total: z.number().min(0),
  hasMore: z.boolean(),
});

// Cancel agent schemas
export const CancelAgentRequestSchema = z.object({
  reason: z.string().optional(),
});

export const CancelAgentResponseSchema = z
  .object({
    id: z.string().min(1),
    status: AgentStatusSchema,
    cancelledAt: z.string().optional(),
  })
  .catchall(z.unknown());

// Update agent schemas
export const UpdateAgentRequestSchema = z.object({
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UpdateAgentResponseSchema = CursorAgentStatusSchema;

// Agent logs schemas
export const AgentLogEntrySchema = z.object({
  timestamp: z.string(),
  level: z.enum(["debug", "info", "warn", "error"]),
  message: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const GetAgentLogsQuerySchema = z.object({
  since: z.string().optional(),
  limit: z.number().min(1).max(1000).optional(),
  level: z.enum(["debug", "info", "warn", "error"]).optional(),
});

export const GetAgentLogsResponseSchema = z.object({
  logs: z.array(AgentLogEntrySchema),
  hasMore: z.boolean(),
});

// Delete agent schemas
export const DeleteAgentResponseSchema = z.object({
  id: z.string().min(1),
  deletedAt: z.string(),
});

// Conversation schemas
export const ConversationMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
    createdAt: z.string().optional(),
  })
  .catchall(z.unknown());

export const GetConversationResponseSchema = z
  .object({
    messages: z.array(ConversationMessageSchema),
  })
  .catchall(z.unknown());

// Followup schemas
export const FollowupRequestSchema = z.object({
  prompt: PromptSchema,
});

// Stop agent schemas
export const StopAgentResponseSchema = z
  .object({
    id: z.string().min(1),
    status: AgentStatusSchema,
  })
  .catchall(z.unknown());

// Me (API key info) schemas
export const GetMeResponseSchema = z
  .object({
    apiKeyName: z.string(),
    createdAt: z.string(),
    userEmail: z.email(),
  })
  .catchall(z.unknown());

// Models schemas
export const ListModelsResponseSchema = z.object({
  models: z.array(z.string()),
});

// Repositories schemas
export const RepositoryInfoSchema = z.object({
  owner: z.string(),
  name: z.string(),
  repository: z.string(),
});

export const ListRepositoriesResponseSchema = z.object({
  repositories: z.array(RepositoryInfoSchema),
});

// Artifacts schemas
export const ArtifactSchema = z.object({
  absolutePath: z.string(),
  sizeBytes: z.number(),
  updatedAt: z.string(),
});

export const ListArtifactsResponseSchema = z.object({
  artifacts: z.array(ArtifactSchema),
});

export const DownloadArtifactQuerySchema = z.object({
  path: z.string().min(1, "Artifact path cannot be empty"),
});

export const DownloadArtifactResponseSchema = z.object({
  url: z.url(),
  expiresAt: z.string(),
});

// Configuration schemas
export const CursorCloudClientOptionsSchema = z.object({
  apiKey: z.string().optional(),
  baseUrl: z.url().optional(),
  webhook: WebhookSchema.optional(),
  pollIntervalMs: z.number().min(100).optional(),
  timeoutMs: z.number().min(1000).optional(),
});

export const WaitForAgentOptionsSchema = z.object({
  pollIntervalMs: z.number().min(100).optional(),
  timeoutMs: z.number().min(1000).optional(),
});

// Export inferred types
export type Webhook = z.infer<typeof WebhookSchema>;
export type LaunchCursorAgentInput = z.infer<
  typeof LaunchCursorAgentInputSchema
>;
export type LaunchCursorAgentRequest = z.infer<
  typeof LaunchCursorAgentRequestSchema
>;
export type LaunchCursorAgentResponse = z.infer<
  typeof LaunchCursorAgentResponseSchema
>;
export type CursorAgentStatus = z.infer<typeof CursorAgentStatusSchema>;
export type ListAgentsQuery = z.infer<typeof ListAgentsQuerySchema>;
export type ListAgentsResponse = z.infer<typeof ListAgentsResponseSchema>;
export type CancelAgentRequest = z.infer<typeof CancelAgentRequestSchema>;
export type CancelAgentResponse = z.infer<typeof CancelAgentResponseSchema>;
export type UpdateAgentRequest = z.infer<typeof UpdateAgentRequestSchema>;
export type UpdateAgentResponse = z.infer<typeof UpdateAgentResponseSchema>;
export type AgentLogEntry = z.infer<typeof AgentLogEntrySchema>;
export type GetAgentLogsQuery = z.infer<typeof GetAgentLogsQuerySchema>;
export type GetAgentLogsResponse = z.infer<typeof GetAgentLogsResponseSchema>;
export type DeleteAgentResponse = z.infer<typeof DeleteAgentResponseSchema>;
export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;
export type GetConversationResponse = z.infer<
  typeof GetConversationResponseSchema
>;
export type FollowupRequest = z.infer<typeof FollowupRequestSchema>;
export type StopAgentResponse = z.infer<typeof StopAgentResponseSchema>;
export type GetMeResponse = z.infer<typeof GetMeResponseSchema>;
export type ListModelsResponse = z.infer<typeof ListModelsResponseSchema>;
export type RepositoryInfo = z.infer<typeof RepositoryInfoSchema>;
export type ListRepositoriesResponse = z.infer<
  typeof ListRepositoriesResponseSchema
>;
export type Artifact = z.infer<typeof ArtifactSchema>;
export type ListArtifactsResponse = z.infer<typeof ListArtifactsResponseSchema>;
export type DownloadArtifactQuery = z.infer<typeof DownloadArtifactQuerySchema>;
export type DownloadArtifactResponse = z.infer<
  typeof DownloadArtifactResponseSchema
>;
export type CursorCloudClientOptions = z.infer<
  typeof CursorCloudClientOptionsSchema
>;
export type WaitForAgentOptions = z.infer<typeof WaitForAgentOptionsSchema>;
