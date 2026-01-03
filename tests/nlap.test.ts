import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { nlap, defineAction, ConfigError } from '../src/index.js';

// Mock the OpenAI provider
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_123',
                      type: 'function',
                      function: {
                        name: 'createTask',
                        arguments: JSON.stringify({ title: 'Review budget' }),
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
            usage: { prompt_tokens: 100, completion_tokens: 50 },
          }),
        },
      };
    },
  };
});

describe('nlap', () => {
  const createTask = defineAction({
    name: 'createTask',
    description: 'Create a new task with a title',
    args: z.object({
      title: z.string(),
      dueDate: z.string().optional(),
    }),
  });

  const listTasks = defineAction({
    name: 'listTasks',
    description: 'List all tasks',
    args: z.object({
      status: z.enum(['pending', 'completed', 'all']).optional(),
    }),
  });

  describe('configuration', () => {
    it('should throw ConfigError if no actions provided', () => {
      expect(() =>
        nlap({
          provider: 'openai',
          apiKey: 'test-key',
          actions: [],
        })
      ).toThrow(ConfigError);
    });

    it('should throw ConfigError if OpenAI provider has no API key', () => {
      expect(() =>
        nlap({
          provider: 'openai',
          actions: [createTask],
        })
      ).toThrow(ConfigError);
    });

    it('should create engine with valid OpenAI config', () => {
      const engine = nlap({
        provider: 'openai',
        apiKey: 'test-key',
        actions: [createTask],
      });

      expect(engine).toBeDefined();
      expect(typeof engine.interpret).toBe('function');
      expect(typeof engine.clearConversation).toBe('function');
    });

    it('should create engine with Ollama config (no API key needed)', () => {
      const engine = nlap({
        provider: 'ollama',
        model: 'llama3.1:8b',
        actions: [createTask],
      });

      expect(engine).toBeDefined();
    });
  });

  describe('interpret', () => {
    it('should interpret natural language into action plan', async () => {
      const engine = nlap({
        provider: 'openai',
        apiKey: 'test-key',
        actions: [createTask, listTasks],
      });

      const plan = await engine.interpret('Create a task to review budget');

      expect(plan.input).toBe('Create a task to review budget');
      expect(plan.calls).toHaveLength(1);
      expect(plan.calls[0].action).toBe('createTask');
      expect(plan.calls[0].args).toEqual({ title: 'Review budget' });
      expect(plan.conversationId).toBeDefined();
    });

    it('should use provided conversationId', async () => {
      const engine = nlap({
        provider: 'openai',
        apiKey: 'test-key',
        actions: [createTask],
      });

      const plan = await engine.interpret('Create a task', 'my-conversation');

      expect(plan.conversationId).toBe('my-conversation');
    });
  });

  describe('conversation memory', () => {
    it('should clear conversation memory', async () => {
      const engine = nlap({
        provider: 'openai',
        apiKey: 'test-key',
        actions: [createTask],
      });

      // This should not throw
      engine.clearConversation('test-conversation');
    });
  });

  describe('multi-item handling', () => {
    it('should be configured in engine with multi-item prompt', async () => {
      // The enhanced system prompt now includes multi-item handling instructions
      // This test verifies the engine accepts actions that could generate multiple calls
      const engine = nlap({
        provider: 'openai',
        apiKey: 'test-key',
        actions: [createTask],
        maxActions: 10, // Allow more actions for multi-item scenarios
      });

      expect(engine).toBeDefined();
      // The actual multi-item behavior depends on LLM response
      // which is now guided by the enhanced system prompt
    });
  });

  describe('cross-action context', () => {
    it('should accept actions for cross-referencing scenarios', async () => {
      const createList = defineAction({
        name: 'createList',
        description: 'Create a new list',
        args: z.object({ name: z.string() }),
      });

      const addItem = defineAction({
        name: 'addItem',
        description: 'Add an item to a list',
        args: z.object({ listName: z.string(), item: z.string() }),
      });

      // The enhanced system prompt now includes cross-action context instructions
      const engine = nlap({
        provider: 'openai',
        apiKey: 'test-key',
        actions: [createList, addItem],
      });

      expect(engine).toBeDefined();
      // The actual cross-action resolution depends on LLM response
      // which is now guided by the enhanced system prompt
    });
  });

  describe('few-shot examples', () => {
    it('should accept actions with examples', async () => {
      const addItem = defineAction({
        name: 'addItem',
        description: 'Add an item to the shopping list',
        args: z.object({ item: z.string() }),
        examples: [
          { input: 'put milk on the list', args: { item: 'milk' } },
          { input: 'I need eggs', args: { item: 'eggs' } },
        ],
      });

      const engine = nlap({
        provider: 'openai',
        apiKey: 'test-key',
        actions: [addItem],
      });

      expect(engine).toBeDefined();
    });
  });
});
