import type { LLMProvider, LLMMessage, LLMTool, LLMResponse } from '../base/LLMProvider.js';

/**
 * Configuration for Ollama provider
 */
export interface OllamaProviderConfig {
  /** Base URL for Ollama server */
  baseURL?: string;
  /** Model name (e.g., 'llama3.1:8b', 'qwen2.5:7b', 'mistral:7b') */
  model: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Ollama LLM provider implementation for local models
 *
 * Supports tool calling via Ollama's OpenAI-compatible API.
 * Requires a running Ollama instance at the specified baseURL.
 *
 * @example
 * ```typescript
 * const provider = new OllamaProvider({
 *   baseURL: 'http://localhost:11434',
 *   model: 'llama3.1:8b',
 * });
 *
 * const interpreter = new Interpreter(provider);
 * ```
 */
export class OllamaProvider implements LLMProvider {
  private baseURL: string;
  private model: string;
  private timeout: number;

  constructor(config: OllamaProviderConfig) {
    this.baseURL = config.baseURL ?? 'http://localhost:11434';
    this.model = config.model;
    this.timeout = config.timeout ?? 60000; // 60s default for local inference
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
      // Build request payload in OpenAI format
      const requestBody = {
        model: this.model,
        messages: [
          // Add system message if provided
          ...(options?.system
            ? [{ role: 'system' as const, content: options.system }]
            : []
          ),
          // Convert NLAP messages to OpenAI format
          ...messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        ],
        // Convert NLAP tools to OpenAI function calling format
        tools: tools.map((t) => ({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: t.input_schema,
          },
        })),
        temperature: options?.temperature ?? 1.0,
        max_tokens: options?.maxTokens,
      };

      // Make request to Ollama's OpenAI-compatible endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(
          `Ollama API error (${response.status} ${response.statusText}): ${errorText}`
        );
      }

      // Parse response
      const data = (await response.json()) as any;

      // Extract message from first choice
      const message = data.choices?.[0]?.message;

      if (!message) {
        throw new Error('No message in Ollama response');
      }

      // Extract tool calls if present
      const toolCalls = message.tool_calls?.map((tc: any) => {
        // Parse arguments JSON string
        let parsedArguments: Record<string, unknown>;
        try {
          parsedArguments =
            typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments;
        } catch (error) {
          throw new Error(
            `Failed to parse tool call arguments: ${tc.function.arguments}`
          );
        }

        return {
          id: tc.id || `call_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name: tc.function.name,
          arguments: parsedArguments,
        };
      });

      // Extract text content
      const content = message.content || undefined;

      // Map finish reason to NLAP format
      const finishReason = data.choices?.[0]?.finish_reason;
      let stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | undefined;

      if (finishReason === 'tool_calls') {
        stopReason = 'tool_use';
      } else if (finishReason === 'length') {
        stopReason = 'max_tokens';
      } else if (finishReason === 'stop') {
        stopReason = 'end_turn';
      }

      return {
        content,
        toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
        stopReason,
      };
    } catch (error) {
      // Wrap in ProviderError
      const providerError = new Error(
        `Provider error (ollama): ${(error as Error).message}`
      );
      providerError.name = 'ProviderError';
      (providerError as any).code = 'PROVIDER_ERROR';
      (providerError as any).details = { provider: 'ollama', baseURL: this.baseURL };
      (providerError as any).originalError = error;
      throw providerError;
    }
  }
}
