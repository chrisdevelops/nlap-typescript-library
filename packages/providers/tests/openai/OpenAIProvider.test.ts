import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIProvider } from '../../src/openai/OpenAIProvider.js';
import type { LLMMessage, LLMTool } from '../../src/base/LLMProvider.js';

// Create mock function at module level
const mockCreate = vi.fn();

// Mock the OpenAI SDK
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

describe('OpenAIProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with default model when not provided', () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });
      expect(provider).toBeDefined();
    });

    it('should use custom model when provided', () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'gpt-4',
      });
      expect(provider).toBeDefined();
    });

    it('should accept optional baseURL and organization', () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        baseURL: 'https://custom.openai.com',
        organization: 'org-123',
      });
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
      const provider = new OpenAIProvider({ apiKey: 'test-key' });

      mockCreate.mockResolvedValueOnce({
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
      const provider = new OpenAIProvider({ apiKey: 'test-key' });

      mockCreate.mockResolvedValueOnce({
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
      const provider = new OpenAIProvider({ apiKey: 'test-key' });

      mockCreate.mockResolvedValueOnce({
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
      });

      const result = await provider.generateWithTools(messages, tools);

      expect(result.content).toBe("I'll create that task for you.");
      expect(result.toolCalls).toHaveLength(1);
      expect(result.stopReason).toBe('tool_use');
    });

    it('should send correct request to OpenAI API', async () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        model: 'gpt-4',
      });

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { role: 'assistant', content: 'OK' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

      await provider.generateWithTools(messages, tools, {
        system: 'You are a helpful assistant.',
        temperature: 0.7,
        maxTokens: 2048,
      });

      expect(mockCreate).toHaveBeenCalledWith({
        model: 'gpt-4',
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

    it('should wrap SDK errors as ProviderError', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });

      mockCreate.mockRejectedValueOnce(new Error('Invalid API key'));

      await expect(provider.generateWithTools(messages, tools)).rejects.toThrow(
        'Provider error (openai)'
      );

      try {
        await provider.generateWithTools(messages, tools);
      } catch (error: any) {
        expect(error.name).toBe('ProviderError');
        expect(error.code).toBe('PROVIDER_ERROR');
        expect(error.details).toEqual({
          provider: 'openai',
        });
        expect(error.originalError).toBeDefined();
      }
    });

    it('should handle missing message in response', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });

      mockCreate.mockResolvedValueOnce({
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 0 },
      });

      await expect(provider.generateWithTools(messages, tools)).rejects.toThrow(
        'Provider error (openai)'
      );
    });

    it('should map finish reasons correctly', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });

      // Test 'length' -> 'max_tokens'
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { role: 'assistant', content: 'truncated...' },
            finish_reason: 'length',
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 2048 },
      });

      const result1 = await provider.generateWithTools(messages, tools);
      expect(result1.stopReason).toBe('max_tokens');

      // Test 'stop' -> 'end_turn'
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { role: 'assistant', content: 'done' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 10 },
      });

      const result2 = await provider.generateWithTools(messages, tools);
      expect(result2.stopReason).toBe('end_turn');

      // Test 'content_filter' -> 'stop_sequence'
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { role: 'assistant', content: 'filtered' },
            finish_reason: 'content_filter',
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 5 },
      });

      const result3 = await provider.generateWithTools(messages, tools);
      expect(result3.stopReason).toBe('stop_sequence');
    });

    it('should handle multiple tool calls in one response', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'tasks.create',
                    arguments: '{"title":"Task 1"}',
                  },
                },
                {
                  id: 'call_2',
                  type: 'function',
                  function: {
                    name: 'tasks.create',
                    arguments: '{"title":"Task 2"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 150, completion_tokens: 40 },
      });

      const result = await provider.generateWithTools(messages, tools);

      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls?.[0].name).toBe('tasks.create');
      expect(result.toolCalls?.[1].name).toBe('tasks.create');
    });

    it('should handle tools array being empty', async () => {
      const provider = new OpenAIProvider({ apiKey: 'test-key' });

      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: { role: 'assistant', content: 'No tools available' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 50, completion_tokens: 10 },
      });

      const result = await provider.generateWithTools(messages, []);

      expect(result.content).toBe('No tools available');
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          tools: undefined,
        })
      );
    });
  });
});
