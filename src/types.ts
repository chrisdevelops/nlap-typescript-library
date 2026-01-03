import type { ZodType } from 'zod';

/**
 * LLM message for conversation history
 */
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Action definition - what you register with the engine
 */
export interface Action<TArgs = unknown> {
  name: string;
  description: string;
  args: ZodType<TArgs>;
  examples?: Array<{ input: string; args: TArgs }>;
}

/**
 * A single action call in a plan
 */
export interface ActionCall {
  action: string;
  args: unknown;
  confidence: number;
}

/**
 * The result of interpreting natural language
 */
export interface ActionPlan {
  input: string;
  calls: ActionCall[];
  conversationId: string;
  clarification?: string;
}

/**
 * Configuration for creating an NLAP engine
 */
export interface NLAPConfig {
  /** Provider to use: 'openai' or 'ollama' */
  provider: 'openai' | 'ollama';
  /** API key (required for OpenAI) */
  apiKey?: string;
  /** Base URL for the provider (for Ollama: default http://localhost:11434) */
  baseURL?: string;
  /** Model to use (optional, uses provider defaults) */
  model?: string;
  /** Actions available to the engine */
  actions: Action<any>[];
  /** Maximum actions per interpretation (default: 5) */
  maxActions?: number;
  /** Number of conversation turns to remember (default: 5) */
  memoryTurns?: number;
}

/**
 * The NLAP engine interface
 */
export interface NLAPEngine {
  /**
   * Interpret natural language into an action plan
   */
  interpret(input: string, conversationId?: string): Promise<ActionPlan>;

  /**
   * Clear conversation memory for a given conversation
   */
  clearConversation(conversationId: string): void;
}
