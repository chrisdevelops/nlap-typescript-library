import OpenAI from 'openai';
import type { LLMProvider, LLMMessage, LLMTool, LLMResponse } from '../base/LLMProvider.js';

/**
 * Configuration for OpenAI provider
 */
export interface OpenAIProviderConfig {
  /** OpenAI API key */
  apiKey: string;
  /** Model name (e.g., 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo') */
  model?: string;
  /** Base URL for API (optional, for custom endpoints) */
  baseURL?: string;
  /** Organization ID (optional) */
  organization?: string;
  /** Maximum number of retries on failure */
  maxRetries?: number;
}

/**
 * OpenAI LLM provider implementation
 *
 * Supports function calling via OpenAI's chat completions API.
 *
 * @example
 * ```typescript
 * const provider = new OpenAIProvider({
 *   apiKey: process.env.OPENAI_API_KEY,
 *   model: 'gpt-4-turbo',
 * });
 *
 * const interpreter = new Interpreter(provider);
 * ```
 */
export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: OpenAIProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      organization: config.organization,
      maxRetries: config.maxRetries ?? 2,
    });
    this.model = config.model ?? 'gpt-4-turbo';
  }

  async generateWithTools(
    messages: LLMMessage[],
    tools: LLMTool[],
    options?: {
      maxTokens?: number;
      temperature?: number;
      system?: string;
    }
  ): Promise<LLMResponse> {
    try {
      // Build messages array
      const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        // Add system message if provided
        ...(options?.system
          ? [{ role: 'system' as const, content: options.system }]
          : []
        ),
        // Convert NLAP messages to OpenAI format
        ...messages.map((m) => ({
          role: m.role === 'system' ? ('system' as const) : m.role,
          content: m.content,
        })),
      ];

      // Convert NLAP tools to OpenAI function format
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
        temperature: options?.temperature ?? 1.0,
        max_tokens: options?.maxTokens,
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

      // Extract text content
      const content = message.content || undefined;

      // Map finish reason to NLAP format
      const finishReason = response.choices[0]?.finish_reason;
      let stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | undefined;

      if (finishReason === 'tool_calls') {
        stopReason = 'tool_use';
      } else if (finishReason === 'length') {
        stopReason = 'max_tokens';
      } else if (finishReason === 'stop') {
        stopReason = 'end_turn';
      } else if (finishReason === 'content_filter') {
        stopReason = 'stop_sequence';
      }

      return {
        content,
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
        },
        stopReason,
      };
    } catch (error) {
      // Wrap in ProviderError
      const providerError = new Error(
        `Provider error (openai): ${(error as Error).message}`
      );
      providerError.name = 'ProviderError';
      (providerError as any).code = 'PROVIDER_ERROR';
      (providerError as any).details = { provider: 'openai' };
      (providerError as any).originalError = error;
      throw providerError;
    }
  }
}
