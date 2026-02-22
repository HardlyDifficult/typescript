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
  const colonIndex = status.indexOf(":");
  if (colonIndex === -1) {
    return { phase: status };
  }
  return {
    phase: status.slice(0, colonIndex),
    step: status.slice(colonIndex + 1),
  };
}
