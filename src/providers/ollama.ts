import type { LLMProvider, LLMMessage, LLMTool, LLMResponse } from './index.js';
import { ProviderError } from '../errors.js';

/**
 * Configuration for Ollama provider
 */
export interface OllamaProviderConfig {
  /** Base URL for Ollama server (default: http://localhost:11434) */
  baseURL?: string;
  /** Model name (e.g., 'llama3.1:8b') */
  model: string;
  /** Request timeout in milliseconds (default: 60000) */
  timeout?: number;
}

/**
 * Ollama LLM provider for local models
 *
 * @example
 * ```typescript
 * const provider = new OllamaProvider({
 *   model: 'llama3.1:8b',
 * });
 * ```
 */
export class OllamaProvider implements LLMProvider {
  private baseURL: string;
  private model: string;
  private timeout: number;

  constructor(config: OllamaProviderConfig) {
    this.baseURL = config.baseURL ?? 'http://localhost:11434';
    this.model = config.model;
    this.timeout = config.timeout ?? 60000;
  }

  async generateWithTools(
    messages: LLMMessage[],
    tools: LLMTool[],
    options?: { system?: string }
  ): Promise<LLMResponse> {
    try {
      const requestBody = {
        model: this.model,
        messages: [
          ...(options?.system ? [{ role: 'system', content: options.system }] : []),
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        tools: tools.map((t) => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.input_schema,
          },
        })),
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Ollama API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as any;
      const message = data.choices?.[0]?.message;

      if (!message) {
        throw new Error('No message in Ollama response');
      }

      // Extract tool calls if present
      const toolCalls = message.tool_calls?.map((tc: any) => {
        const args =
          typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments;

        return {
          id: tc.id ?? `call_${Date.now()}`,
          name: tc.function.name,
          arguments: args,
        };
      });

      return {
        content: message.content ?? undefined,
        toolCalls: toolCalls?.length ? toolCalls : undefined,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        },
      };
    } catch (error) {
      throw new ProviderError('ollama', (error as Error).message);
    }
  }
}
