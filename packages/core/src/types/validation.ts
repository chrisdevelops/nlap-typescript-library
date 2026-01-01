import type { ActionCall } from './actions.js';

/**
 * Validation error details
 */
export interface ValidationError {
  /** Action ID that failed validation */
  actionId: string;

  /** Call ID that failed */
  callId: string;

  /** Error code */
  code: 'INVALID_ARGS' | 'ACTION_NOT_FOUND' | 'DEPENDENCY_FAILED' | 'SCHEMA_ERROR';

  /** Human-readable error message */
  message: string;

  /** Zod error details (if applicable) */
  zodErrors?: Array<{
    path: (string | number)[];
    message: string;
  }>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;

  /** Validation errors (empty if valid) */
  errors: ValidationError[];

  /** Validated calls with typed args */
  validatedCalls?: ActionCall[];
}
