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
                    name: 'tasks_create', // Sanitized name returned by OpenAI
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
        name: 'tasks.create', // Restored to original
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
                    name: 'tasks_create', // Sanitized name returned by OpenAI
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
              name: 'tasks_create', // Sanitized name sent to OpenAI
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
                    name: 'tasks_create', // Sanitized name returned by OpenAI
                    arguments: '{"title":"Task 1"}',
                  },
                },
                {
                  id: 'call_2',
                  type: 'function',
                  function: {
                    name: 'tasks_create', // Sanitized name returned by OpenAI
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
      expect(result.toolCalls?.[0].name).toBe('tasks.create'); // Restored to original
      expect(result.toolCalls?.[1].name).toBe('tasks.create'); // Restored to original
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

  describe('Action ID Sanitization', () => {
    describe('Basic Sanitization', () => {
      it('should replace dots with underscores', async () => {
        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const tools: LLMTool[] = [
          {
            name: 'tasks.create',
            description: 'Create a task',
            input_schema: { type: 'object', properties: {} },
          },
        ];

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
                      name: 'tasks_create', // Sanitized name from OpenAI
                      arguments: '{"title":"Test"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        });

        const result = await provider.generateWithTools(
          [{ role: 'user', content: 'Create a task' }],
          tools
        );

        // Verify API was called with sanitized name
        expect(mockCreate).toHaveBeenCalledWith(
          expect.objectContaining({
            tools: [
              {
                type: 'function',
                function: expect.objectContaining({
                  name: 'tasks_create', // Sanitized
                }),
              },
            ],
          })
        );

        // Verify response has original name restored
        expect(result.toolCalls?.[0].name).toBe('tasks.create'); // Restored
      });

      it('should handle nested namespaces', async () => {
        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const tools: LLMTool[] = [
          {
            name: 'api.users.profile.update',
            description: 'Update user profile',
            input_schema: { type: 'object', properties: {} },
          },
        ];

        mockCreate.mockResolvedValueOnce({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_456',
                    type: 'function',
                    function: {
                      name: 'api_users_profile_update',
                      arguments: '{"userId":"123"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        });

        const result = await provider.generateWithTools(
          [{ role: 'user', content: 'Update profile' }],
          tools
        );

        expect(result.toolCalls?.[0].name).toBe('api.users.profile.update');
      });

      it('should handle action IDs with hyphens (already valid)', async () => {
        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const tools: LLMTool[] = [
          {
            name: 'create-task',
            description: 'Create a task',
            input_schema: { type: 'object', properties: {} },
          },
        ];

        mockCreate.mockResolvedValueOnce({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_789',
                    type: 'function',
                    function: {
                      name: 'create-task', // Unchanged
                      arguments: '{"title":"Test"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        });

        const result = await provider.generateWithTools(
          [{ role: 'user', content: 'Create task' }],
          tools
        );

        expect(result.toolCalls?.[0].name).toBe('create-task');
      });

      it('should handle multiple consecutive dots', async () => {
        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const tools: LLMTool[] = [
          {
            name: 'tasks..create',
            description: 'Create a task',
            input_schema: { type: 'object', properties: {} },
          },
        ];

        mockCreate.mockResolvedValueOnce({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_abc',
                    type: 'function',
                    function: {
                      name: 'tasks_create', // Collapsed to single underscore
                      arguments: '{"title":"Test"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        });

        const result = await provider.generateWithTools(
          [{ role: 'user', content: 'Create task' }],
          tools
        );

        expect(result.toolCalls?.[0].name).toBe('tasks..create');
      });

      it('should handle unicode characters', async () => {
        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const tools: LLMTool[] = [
          {
            name: 'tâsks.créate',
            description: 'Create a task',
            input_schema: { type: 'object', properties: {} },
          },
        ];

        mockCreate.mockResolvedValueOnce({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_def',
                    type: 'function',
                    function: {
                      name: 't_sks_cr_ate', // Unicode chars replaced
                      arguments: '{"title":"Test"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        });

        const result = await provider.generateWithTools(
          [{ role: 'user', content: 'Create task' }],
          tools
        );

        expect(result.toolCalls?.[0].name).toBe('tâsks.créate');
      });

      it('should prefix with underscore if starts with number', async () => {
        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const tools: LLMTool[] = [
          {
            name: '2fa.enable',
            description: 'Enable 2FA',
            input_schema: { type: 'object', properties: {} },
          },
        ];

        mockCreate.mockResolvedValueOnce({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_2fa',
                    type: 'function',
                    function: {
                      name: '_2fa_enable', // Prefixed with underscore
                      arguments: '{}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        });

        const result = await provider.generateWithTools(
          [{ role: 'user', content: 'Enable 2FA' }],
          tools
        );

        expect(result.toolCalls?.[0].name).toBe('2fa.enable');
      });
    });

    describe('Collision Detection', () => {
      it('should throw error when two action IDs sanitize to same name', async () => {
        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const tools: LLMTool[] = [
          {
            name: 'tasks.create',
            description: 'Create via dots',
            input_schema: { type: 'object', properties: {} },
          },
          {
            name: 'tasks_create',
            description: 'Create via underscore',
            input_schema: { type: 'object', properties: {} },
          },
        ];

        await expect(
          provider.generateWithTools([{ role: 'user', content: 'Create task' }], tools)
        ).rejects.toThrow(/collision detected.*tasks.create.*tasks_create/i);
      });

      it('should throw error for complex collision case', async () => {
        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const tools: LLMTool[] = [
          {
            name: 'user.profile.get',
            description: 'Get profile (dots)',
            input_schema: { type: 'object', properties: {} },
          },
          {
            name: 'user_profile.get',
            description: 'Get profile (mixed)',
            input_schema: { type: 'object', properties: {} },
          },
        ];

        await expect(
          provider.generateWithTools([{ role: 'user', content: 'Get profile' }], tools)
        ).rejects.toThrow(/collision detected/i);
      });

      it('should provide helpful error message for collisions', async () => {
        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const tools: LLMTool[] = [
          { name: 'a.b', description: 'Action 1', input_schema: {} },
          { name: 'a_b', description: 'Action 2', input_schema: {} },
        ];

        try {
          await provider.generateWithTools([{ role: 'user', content: 'Test' }], tools);
          expect.fail('Should have thrown error');
        } catch (error: any) {
          expect(error.message).toContain('collision detected');
          expect(error.message).toContain('a.b');
          expect(error.message).toContain('a_b');
          expect(error.message).toContain('rename');
        }
      });
    });

    describe('Multiple Tool Calls with Sanitization', () => {
      it('should handle multiple different action IDs correctly', async () => {
        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const tools: LLMTool[] = [
          {
            name: 'tasks.create',
            description: 'Create task',
            input_schema: { type: 'object', properties: {} },
          },
          {
            name: 'users.invite',
            description: 'Invite user',
            input_schema: { type: 'object', properties: {} },
          },
        ];

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
                      name: 'tasks_create',
                      arguments: '{"title":"Task 1"}',
                    },
                  },
                  {
                    id: 'call_2',
                    type: 'function',
                    function: {
                      name: 'users_invite',
                      arguments: '{"email":"test@example.com"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 150, completion_tokens: 40 },
        });

        const result = await provider.generateWithTools(
          [{ role: 'user', content: 'Create task and invite user' }],
          tools
        );

        expect(result.toolCalls).toHaveLength(2);
        expect(result.toolCalls?.[0].name).toBe('tasks.create');
        expect(result.toolCalls?.[1].name).toBe('users.invite');
      });
    });

    describe('Edge Cases', () => {
      it('should throw error for empty action ID', async () => {
        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const tools: LLMTool[] = [
          {
            name: '',
            description: 'Empty name',
            input_schema: { type: 'object', properties: {} },
          },
        ];

        await expect(
          provider.generateWithTools([{ role: 'user', content: 'Test' }], tools)
        ).rejects.toThrow(/Action ID cannot be empty/i);
      });

      it('should throw error for action ID that sanitizes to empty', async () => {
        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const tools: LLMTool[] = [
          {
            name: '...',
            description: 'Only dots',
            input_schema: { type: 'object', properties: {} },
          },
        ];

        await expect(
          provider.generateWithTools([{ role: 'user', content: 'Test' }], tools)
        ).rejects.toThrow(/sanitizes to empty string/i);
      });
    });

    describe('Backward Compatibility', () => {
      it('should not affect action IDs without dots or special chars', async () => {
        const provider = new OpenAIProvider({ apiKey: 'test-key' });
        const tools: LLMTool[] = [
          {
            name: 'createTask',
            description: 'Create task',
            input_schema: { type: 'object', properties: {} },
          },
        ];

        mockCreate.mockResolvedValueOnce({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_xyz',
                    type: 'function',
                    function: {
                      name: 'createTask', // Unchanged
                      arguments: '{"title":"Test"}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          usage: { prompt_tokens: 100, completion_tokens: 20 },
        });

        const result = await provider.generateWithTools(
          [{ role: 'user', content: 'Create task' }],
          tools
        );

        expect(result.toolCalls?.[0].name).toBe('createTask');
      });
    });
  });
});
