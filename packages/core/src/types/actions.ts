import type { ZodType } from 'zod';
import type { BaseContext, ExecutionContext } from './base.js';

/**
 * Schema factory: static schema or dynamic function
 */
export type SchemaFactory<TInput, TContext extends BaseContext> =
  | ZodType<TInput>
  | ((ctx: TContext) => ZodType<TInput> | Promise<ZodType<TInput>>);

/**
 * Compensation handler for rollback
 */
export type CompensationHandler<TInput, TOutput, TContext extends BaseContext> = (
  args: TInput,
  result: TOutput,
  ctx: ExecutionContext<TContext>
) => Promise<void>;

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  backoff: 'linear' | 'exponential';
  delayMs: number;
}

/**
 * Searchable field specification for RAG
 */
export interface SearchableFieldSpec {
  /** Argument key to populate (e.g., 'contactId') */
  argKey: string;

  /** Query key from LLM output (defaults to `${argKey}Query`) */
  queryKey?: string;

  /** Retriever name to use */
  retriever: string;

  /** Additional filters for retrieval */
  filters?: Record<string, unknown>;

  /** Minimum similarity score (0-1) */
  minScore?: number;
}

/**
 * Action definition with full type safety
 */
export interface ActionDefinition<
  TName extends string = string,
  TInput = unknown,
  TOutput = unknown,
  TContext extends BaseContext = BaseContext,
> {
  /** Unique action identifier (e.g., 'tasks.create') */
  id: TName;

  /** Human-readable description for LLM */
  description: string;

  /** Zod schema for input validation (static or dynamic) */
  argsSchema: SchemaFactory<TInput, TContext>;

  /** Optional execution handler */
  handler?: (args: TInput, ctx: ExecutionContext<TContext>) => Promise<TOutput>;

  // Optional features

  /** Tags for categorization and filtering */
  tags?: string[];

  /** Actions that must be executed before this one */
  dependencies?: TName[];

  /** Priority for execution order (0-100, higher = earlier) */
  priority?: number;

  /** Fields that need RAG resolution */
  searchableFields?: SearchableFieldSpec[];

  /** Compensation logic for rollback */
  compensate?: CompensationHandler<TInput, TOutput, TContext>;

  /** Retry configuration */
  retry?: RetryConfig;

  /** Risk level for confirmation prompts */
  risk?: 'low' | 'medium' | 'high';

  /** Example usages for LLM few-shot learning */
  examples?: Array<{ input: string; args: TInput }>;
}

/**
 * Action call in a plan
 */
export interface ActionCall {
  /** Unique call identifier */
  callId: string;

  /** Action ID being called */
  actionId: string;

  /** Arguments for the action (validated later) */
  args: unknown;

  /** LLM's confidence in this call (0-1) */
  confidence: number;

  /** Call IDs this depends on */
  dependsOn?: string[];
}
