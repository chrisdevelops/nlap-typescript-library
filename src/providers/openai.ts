import OpenAI from 'openai';
import type { LLMProvider, LLMMessage, LLMTool, LLMResponse } from './index.js';
import { ProviderError } from '../errors.js';

/**
 * Configuration for OpenAI provider
 */
export interface OpenAIProviderConfig {
  /** OpenAI API key */
  apiKey: string;
  /** Model name (default: 'gpt-4-turbo') */
  model?: string;
  /** Base URL for API (optional, for custom endpoints) */
  baseURL?: string;
}

/**
 * OpenAI LLM provider implementation
 *
 * @example
 * ```typescript
 * const provider = new OpenAIProvider({
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'gpt-4-turbo',
 * });
 * ```
 */
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAIProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
    this.model = config.model ?? 'gpt-4-turbo';
  }

  async generateWithTools(
    messages: LLMMessage[],
    tools: LLMTool[],
    options?: { system?: string }
  ): Promise<LLMResponse> {
    try {
      // Build messages array
      const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        ...(options?.system ? [{ role: 'system' as const, content: options.system }] : []),
        ...messages.map((m) => ({
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        })),
      ];

      // Convert tools to OpenAI format
      const openaiTools: OpenAI.Chat.ChatCompletionTool[] = tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.input_schema,
        },
      }));

      // Make API call
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: openaiMessages,
        tools: openaiTools.length > 0 ? openaiTools : undefined,
      });

      // Extract message from first choice
      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error('No message in OpenAI response');
      }

      // Extract tool calls if present
      const toolCalls = message.tool_calls
        ?.filter((tc) => tc.type === 'function')
        .map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          arguments:
            typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments,
        }));

      return {
        content: message.content ?? undefined,
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
      };
    } catch (error) {
      throw new ProviderError('openai', (error as Error).message);
    }
  }
}
