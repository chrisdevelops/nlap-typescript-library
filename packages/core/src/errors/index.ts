/**
 * Base NLAP error with structured code and details
 */
export class NLAPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Action not found in registry
 */
export class ActionNotFoundError extends NLAPError {
  constructor(actionId: string) {
    super(`Action "${actionId}" not found in registry`, 'ACTION_NOT_FOUND', { actionId });
  }
}

/**
 * Validation failed (Error class, not to be confused with ValidationError type)
 */
export class SchemaValidationError extends NLAPError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

/**
 * Circular dependency detected in action registry
 */
export class CircularDependencyError extends NLAPError {
  constructor(cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' → ')}`, 'CIRCULAR_DEPENDENCY', { cycle });
  }
}

/**
 * Provider API error
 */
export class ProviderError extends NLAPError {
  constructor(
    provider: string,
    message: string,
    public originalError?: Error
  ) {
    super(`Provider error (${provider}): ${message}`, 'PROVIDER_ERROR', { provider });
  }
}

/**
 * Execution timeout
 */
export class ExecutionTimeoutError extends NLAPError {
  constructor(actionId: string, timeoutMs: number) {
    super(
      `Action "${actionId}" timed out after ${timeoutMs}ms`,
      'EXECUTION_TIMEOUT',
      { actionId, timeoutMs }
    );
  }
}

/**
 * Retry exhausted after max attempts
 */
export class RetryExhaustedError extends NLAPError {
  constructor(actionId: string, attempts: number) {
    super(
      `Action "${actionId}" failed after ${attempts} retry attempts`,
      'RETRY_EXHAUSTED',
      { actionId, attempts }
    );
  }
}
