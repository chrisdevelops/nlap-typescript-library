import type { ActionCall } from './actions.js';
import type { BaseContext } from './base.js';

/**
 * Normalized input
 */
export interface NormalizedInput<TContext extends BaseContext = BaseContext> {
  raw: string;
  normalized: string;
  context: TContext;
  conversationId: string;
  turnNumber: number;
}

/**
 * Clarification request when plan is ambiguous
 */
export interface ClarificationRequest {
  /** Question to ask the user */
  question: string;

  /** Action IDs that need clarification */
  actionIds: string[];

  /** Suggested responses (optional) */
  suggestions?: string[];
}

/**
 * Execution plan output
 */
export interface Plan {
  /** Unique plan identifier */
  planId: string;

  /** Original and normalized input */
  input: NormalizedInput;

  /** Action calls to execute */
  calls: ActionCall[];

  /** Clarification needed (if any) */
  clarification?: ClarificationRequest;

  /** Overall confidence (average of call confidences) */
  confidence: number;

  /** Conversation ID */
  conversationId: string;

  /** Turn number in conversation */
  turnNumber: number;

  /** Plan creation timestamp */
  createdAt: Date;
}
