import { CursorCloudClient } from "./CursorCloudClient.js";
import type { CursorCloudClientOptions } from "./types.js";

export { CursorCloudClient, CursorCloudRepo } from "./CursorCloudClient.js";
export type {
  CursorAgentStatus,
  CursorCloudClientOptions,
  CursorRunResult,
  LaunchCursorAgentInput,
  LaunchCursorAgentRequest,
  LaunchCursorAgentResponse,
  RunCursorAgentOptions,
  WaitForAgentOptions,
} from "./types.js";

/** Create a Cursor Cloud client with opinionated defaults. */
export function createCursorCloud(
  options?: CursorCloudClientOptions
): CursorCloudClient {
  return new CursorCloudClient(options);
}
