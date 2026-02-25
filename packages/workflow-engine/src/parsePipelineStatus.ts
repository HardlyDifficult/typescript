/**
 * Parsed pipeline status.
 *
 * Pipeline status strings follow the format `phase:step_name` for active states
 * (e.g. `running:create_plan`, `gate:approve`) or a bare phase for terminal
 * states (`completed`, `failed`, `cancelled`).
 */
export interface ParsedPipelineStatus {
  /** The phase of the pipeline: running, gate, completed, failed, cancelled */
  phase: string;
  /** The step name if the pipeline is active, undefined for terminal states */
  step?: string;
}

/**
 * Parse a pipeline status string into its phase and optional step name.
 *
 * @example
 * parsePipelineStatus('running:create_plan') // { phase: 'running', step: 'create_plan' }
 * parsePipelineStatus('gate:approve')        // { phase: 'gate', step: 'approve' }
 * parsePipelineStatus('completed')           // { phase: 'completed', step: undefined }
 * parsePipelineStatus('failed')              // { phase: 'failed', step: undefined }
 */
export function parsePipelineStatus(status: string): ParsedPipelineStatus {
  const normalizedStatus = status.trim();
  const colonIndex = normalizedStatus.indexOf(":");
  if (colonIndex === -1) {
    return { phase: normalizedStatus };
  }

  const phase = normalizedStatus.slice(0, colonIndex).trim();
  const step = normalizedStatus.slice(colonIndex + 1).trim();

  return {
    phase,
    ...(step.length > 0 ? { step } : {}),
  };
}
