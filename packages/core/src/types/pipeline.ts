import type { Plan } from './plans.js';
import type { BaseContext } from './base.js';
import type { Router } from './routing.js';

/**
 * Trace event for observability
 */
export interface TraceEvent {
  stage: string;
  status: 'start' | 'complete' | 'failed';
  timestamp: number;
  duration?: number;
  data?: Record<string, unknown>;
  error?: Error;
}

/**
 * Execution result
 */
export interface ExecutionResult<_TContext extends BaseContext = BaseContext> {
  succeeded: number;
  failed: number;
  results: Map<string, { result: unknown; error?: Error }>;
}

/**
 * Retriever interface (forward declaration)
 */
export interface Retriever<_TContext extends BaseContext = BaseContext> {
  search(
    retrieverName: string,
    query: string,
    context: _TContext,
    filters?: Record<string, unknown>
  ): Promise<Array<{ id: string; score?: number; data?: unknown }>>;
}

/**
 * Executor interface (forward declaration)
 */
export interface Executor<TContext extends BaseContext = BaseContext> {
  execute(plan: Plan, context: TContext): Promise<ExecutionResult<TContext>>;
}

/**
 * Conversation memory interface (forward declaration)
 */
export interface ConversationMemory<_TContext extends BaseContext = BaseContext> {
  getMessagesForLLM(conversationId: string): any[]; // Message[]
  addMessage(conversationId: string, message: any): void; // Message
  getState(conversationId: string): { turnCount: number } | undefined;
}

/**
 * Telemetry interface (forward declaration)
 */
export interface Telemetry {
  startSpan(name: string): any;
  endSpan(span: any, status: 'success' | 'error', error?: Error): void;
  recordEvent(span: any, event: Omit<TraceEvent, 'timestamp'>): void;
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig<TContext extends BaseContext = BaseContext> {
  registry: any; // ActionRegistry<TContext>
  router: Router<TContext>;
  interpreter: any; // Interpreter

  // Optional components
  validator?: any; // Validator<TContext>
  retriever?: Retriever<TContext>;
  executor?: Executor<TContext>;
  memory?: ConversationMemory<TContext>;
  telemetry?: Telemetry;

  // Configuration
  maxCandidates?: number; // default: 12
  maxActions?: number; // default: 5
  confidenceThreshold?: number; // default: 0.7
  repairMaxRetries?: number; // default: 2
  enableAutoRepair?: boolean; // default: true
}

/**
 * Pipeline result
 */
export interface PipelineResult<TContext extends BaseContext = BaseContext> {
  plan: Plan;
  execution?: ExecutionResult<TContext>;
  trace: TraceEvent[];
  duration: number;
}
