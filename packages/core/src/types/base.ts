/**
 * Base context that all applications must extend.
 * Contains standard request metadata.
 */
export interface BaseContext {
  /** Unique request identifier */
  requestId: string;

  /** Optional trace ID for distributed tracing */
  traceId?: string;

  /** Tenant ID for multi-tenant applications */
  tenantId?: string;

  /** User ID who initiated the request */
  userId?: string;

  /** Locale for internationalization (e.g., 'en-US') */
  locale?: string;

  /** Timezone for date/time interpretation (e.g., 'America/New_York') */
  timezone?: string;

  /** Current timestamp (useful for testing) */
  now?: Date;
}

/**
 * Extended context passed to action handlers during execution.
 * Includes original context plus execution-specific data.
 */
export interface ExecutionContext<TContext extends BaseContext = BaseContext> {
  /** Original application context */
  appContext: TContext;

  /** Results from previously executed actions */
  previousResults: Map<string, { result: unknown; error?: Error }>;

  /** Conversation ID for multi-turn interactions */
  conversationId?: string;

  /** Current turn number in the conversation */
  turnNumber?: number;
}

/**
 * Message in conversation history
 */
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}
