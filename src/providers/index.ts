import type { NLAPConfig } from '../types.js';
import { ConfigError } from '../errors.js';
import { OpenAIProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';

/**
 * LLM message format
 */
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * LLM tool definition (for function calling)
 */
export interface LLMTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * LLM tool call result
 */
export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * LLM response from a provider
 */
export interface LLMResponse {
  content?: string;
  toolCalls?: LLMToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Interface that all LLM providers must implement
 */
export interface LLMProvider {
  generateWithTools(
    messages: LLMMessage[],
    tools: LLMTool[],
    options?: { system?: string }
  ): Promise<LLMResponse>;
}

/**
 * Create an LLM provider based on configuration
 */
export function createProvider(config: NLAPConfig): LLMProvider {
  switch (config.provider) {
    case 'openai':
      if (!config.apiKey) {
        throw new ConfigError('OpenAI provider requires an apiKey');
      }
      return new OpenAIProvider({
        apiKey: config.apiKey,
        model: config.model,
        baseURL: config.baseURL,
      });

    case 'ollama':
      return new OllamaProvider({
        baseURL: config.baseURL,
        model: config.model ?? 'llama3.1:8b',
      });

    default:
      throw new ConfigError(`Unknown provider: ${config.provider}`);
  }
}

export { OpenAIProvider } from './openai.js';
export { OllamaProvider } from './ollama.js';
