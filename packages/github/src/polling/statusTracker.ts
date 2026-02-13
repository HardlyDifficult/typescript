import type { ClassifyPR, PREvent, StatusChangedEvent } from "../types.js";

import type { PRActivity } from "./fetchPRActivity.js";
import type { PRSnapshot } from "./processSnapshot.js";

export interface StatusResult {
  status: string;
  changed: StatusChangedEvent | null;
}

export async function classifyAndDetectChange(
  classifyPR: ClassifyPR,
  event: PREvent,
  activity: PRActivity,
  previous: PRSnapshot | undefined,
  initialized: boolean
): Promise<StatusResult> {
  const status = await classifyPR(event, activity);

  if (
    !initialized ||
    previous?.status === undefined ||
    previous.status === null
  ) {
    return { status, changed: null };
  }

  if (previous.status !== status) {
    return {
      status,
      changed: { ...event, status, previousStatus: previous.status },
    };
  }

  return { status, changed: null };
}
