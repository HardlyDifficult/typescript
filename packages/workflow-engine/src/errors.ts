export class WorkflowEngineError extends Error {
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.details = details;
  }
}

export class InvalidInitialStatusError extends WorkflowEngineError {
  constructor(initialStatus: string, transitionKeys: readonly string[]) {
    super(
      `initialStatus "${initialStatus}" is not a key in the transitions map`,
      "INVALID_INITIAL_STATUS",
      { initialStatus, transitionKeys }
    );
  }
}

export class TerminalTransitionError extends WorkflowEngineError {
  constructor(from: string) {
    super(
      `Cannot transition from terminal status "${from}"`,
      "TERMINAL_TRANSITION",
      { from }
    );
  }
}

export class InvalidTransitionError extends WorkflowEngineError {
  constructor(from: string, to: string, allowed: readonly string[]) {
    super(
      `Cannot transition from "${from}" to "${to}". Allowed: [${allowed.join(", ")}]`,
      "INVALID_TRANSITION",
      { from, to, allowed }
    );
  }
}

export class PipelineHasNoStepsError extends WorkflowEngineError {
  constructor() {
    super("Pipeline requires at least one step", "PIPELINE_NO_STEPS");
  }
}

export class DuplicatePipelineStepNameError extends WorkflowEngineError {
  constructor(stepName: string) {
    super(`Duplicate step name: "${stepName}"`, "DUPLICATE_STEP_NAME", {
      stepName,
    });
  }
}

export class PipelineResumeError extends WorkflowEngineError {
  constructor(status: string) {
    super(
      `Cannot resume: pipeline is not at a gate (status: "${status}")`,
      "PIPELINE_NOT_AT_GATE",
      { status }
    );
  }
}

export class CursorTargetNotFoundError extends WorkflowEngineError {
  constructor() {
    super("Cursor target not found", "CURSOR_TARGET_NOT_FOUND");
  }
}

export class StepExecutionMissingError extends WorkflowEngineError {
  constructor(stepName: string) {
    super(
      `Step "${stepName}" has no execute function and is not a gate`,
      "STEP_EXECUTION_MISSING",
      { stepName }
    );
  }
}
