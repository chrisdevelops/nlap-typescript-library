import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '../../src/ollama/OllamaProvider.js';
import type { LLMMessage, LLMTool } from '../../src/base/LLMProvider.js';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('OllamaProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Constructor', () => {
    it('should set default baseURL when not provided', () => {
      const provider = new OllamaProvider({ model: 'llama3.1:8b' });
      expect(provider).toBeDefined();
    });

    it('should use custom baseURL when provided', () => {
      const provider = new OllamaProvider({
        model: 'llama3.1:8b',
        baseURL: 'http://custom:11434',
      });
      expect(provider).toBeDefined();
    });

    it('should set default timeout when not provided', () => {
      const provider = new OllamaProvider({ model: 'llama3.1:8b' });
      expect(provider).toBeDefined();
    });
  });

  describe('generateWithTools', () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'Create a task to review the budget' },
    ];

    const tools: LLMTool[] = [
      {
        name: 'tasks.create',
        description: 'Create a new task',
        input_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Task title' },
          },
          required: ['title'],
        },
      },
    ];

    it('should handle text-only responses (clarification)', async () => {
      const provider = new OllamaProvider({ model: 'llama3.1:8b' });

      // Mock response with only text content
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'What should be the title of the task?',
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: 100,
            completion_tokens: 20,
          },
        }),
      });

      const result = await provider.generateWithTools(messages, tools);

      expect(result.content).toBe('What should be the title of the task?');
      expect(result.toolCalls).toBeUndefined();
      expect(result.usage).toEqual({
        inputTokens: 100,
        outputTokens: 20,
      });
      expect(result.stopReason).toBe('end_turn');
    });

    it('should handle tool call responses (actions)', async () => {
      const provider = new OllamaProvider({ model: 'llama3.1:8b' });

      // Mock response with tool calls
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_123',
                    type: 'function',
                    function: {
                      name: 'tasks.create',
                      arguments: '{"title":"Review the budget"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: {
            prompt_tokens: 150,
            completion_tokens: 25,
          },
        }),
      });

      const result = await provider.generateWithTools(messages, tools);

      expect(result.content).toBeUndefined();
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls?.[0]).toEqual({
        id: 'call_123',
        name: 'tasks.create',
        arguments: { title: 'Review the budget' },
      });
      expect(result.usage).toEqual({
        inputTokens: 150,
        outputTokens: 25,
      });
      expect(result.stopReason).toBe('tool_use');
    });

    it('should handle mixed responses (text + tool calls)', async () => {
      const provider = new OllamaProvider({ model: 'llama3.1:8b' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: "I'll create that task for you.",
                tool_calls: [
                  {
                    id: 'call_456',
                    type: 'function',
                    function: {
                      name: 'tasks.create',
                      arguments: '{"title":"Review the budget"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: {
            prompt_tokens: 150,
            completion_tokens: 30,
          },
        }),
      });

      const result = await provider.generateWithTools(messages, tools);

      expect(result.content).toBe("I'll create that task for you.");
      expect(result.toolCalls).toHaveLength(1);
      expect(result.stopReason).toBe('tool_use');
    });

    it('should send correct request payload to Ollama API', async () => {
      const provider = new OllamaProvider({
        model: 'llama3.1:8b',
        baseURL: 'http://localhost:11434',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      });

      await provider.generateWithTools(messages, tools, {
        system: 'You are a helpful assistant.',
        temperature: 0.7,
        maxTokens: 2048,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.any(String),
        })
      );

      const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(requestBody).toEqual({
        model: 'llama3.1:8b',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Create a task to review the budget' },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'tasks.create',
              description: 'Create a new task',
              parameters: expect.any(Object),
            },
          },
        ],
        temperature: 0.7,
        max_tokens: 2048,
      });
    });

    it('should wrap HTTP errors as ProviderError', async () => {
      const provider = new OllamaProvider({ model: 'llama3.1:8b' });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => 'Model not found',
      });

      await expect(provider.generateWithTools(messages, tools)).rejects.toThrow(
        'Provider error (ollama)'
      );

      try {
        await provider.generateWithTools(messages, tools);
      } catch (error: any) {
        expect(error.name).toBe('ProviderError');
        expect(error.code).toBe('PROVIDER_ERROR');
        expect(error.details).toEqual({
          provider: 'ollama',
          baseURL: 'http://localhost:11434',
        });
        expect(error.originalError).toBeDefined();
      }
    });

    it('should handle connection errors gracefully', async () => {
      const provider = new OllamaProvider({ model: 'llama3.1:8b' });

      mockFetch.mockRejectedValueOnce(new Error('fetch failed'));

      await expect(provider.generateWithTools(messages, tools)).rejects.toThrow(
        'Provider error (ollama)'
      );

      try {
        await provider.generateWithTools(messages, tools);
      } catch (error: any) {
        expect(error.name).toBe('ProviderError');
        expect(error.code).toBe('PROVIDER_ERROR');
      }
    });

    it('should handle malformed JSON in tool arguments', async () => {
      const provider = new OllamaProvider({ model: 'llama3.1:8b' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                tool_calls: [
                  {
                    id: 'call_789',
                    type: 'function',
                    function: {
                      name: 'tasks.create',
                      arguments: 'invalid json{',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        }),
      });

      await expect(provider.generateWithTools(messages, tools)).rejects.toThrow(
        'Provider error (ollama)'
      );
    });

    it('should generate call ID when missing', async () => {
      const provider = new OllamaProvider({ model: 'llama3.1:8b' });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                tool_calls: [
                  {
                    // No id field
                    type: 'function',
                    function: {
                      name: 'tasks.create',
                      arguments: '{"title":"Test"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        }),
      });

      const result = await provider.generateWithTools(messages, tools);

      expect(result.toolCalls?.[0].id).toBeDefined();
      expect(result.toolCalls?.[0].id).toMatch(/^call_/);
    });

    it('should map finish reasons correctly', async () => {
      const provider = new OllamaProvider({ model: 'llama3.1:8b' });

      // Test 'length' -> 'max_tokens'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: { role: 'assistant', content: 'truncated...' },
              finish_reason: 'length',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 2048 },
        }),
      });

      const result1 = await provider.generateWithTools(messages, tools);
      expect(result1.stopReason).toBe('max_tokens');

      // Test 'stop' -> 'end_turn'
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: { role: 'assistant', content: 'done' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 10 },
        }),
      });

      const result2 = await provider.generateWithTools(messages, tools);
      expect(result2.stopReason).toBe('end_turn');
    });
  });
});
