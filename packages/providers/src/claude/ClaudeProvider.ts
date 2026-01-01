import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, LLMMessage, LLMTool, LLMResponse } from '../base/LLMProvider.js';

/**
 * Configuration for Claude provider
 */
export interface ClaudeProviderConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
}

/**
 * Claude (Anthropic) LLM provider implementation
 */
export class ClaudeProvider implements LLMProvider {
  private client: Anthropic;
  private model: string;

  constructor(config: ClaudeProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      maxRetries: config.maxRetries ?? 2,
    });
    this.model = config.model ?? 'claude-3-5-sonnet-20241022';
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
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 1.0,
        system: options?.system,
        messages: messages.map((m) => ({
          role: m.role === 'system' ? 'user' : m.role,
          content: m.content,
        })),
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          input_schema: {
            type: 'object',
            ...t.input_schema,
          } as Anthropic.Tool.InputSchema,
        })),
      });

      // Extract tool calls
      const toolCalls = response.content
        .filter((block): block is Anthropic.ToolUseBlock => block.type === 'tool_use')
        .map((block) => ({
          id: block.id,
          name: block.name,
          arguments: block.input as Record<string, unknown>,
        }));

      // Extract text content
      const textBlocks = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text);

      return {
        content: textBlocks.length > 0 ? textBlocks.join('\n') : undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
        stopReason: response.stop_reason as any,
      };
    } catch (error) {
      // Wrap in ProviderError
      const providerError = new Error(
        `Provider error (claude): ${(error as Error).message}`
      );
      providerError.name = 'ProviderError';
      (providerError as any).code = 'PROVIDER_ERROR';
      (providerError as any).details = { provider: 'claude' };
      (providerError as any).originalError = error;
      throw providerError;
    }
  }
}
