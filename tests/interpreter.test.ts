import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { Interpreter } from '../src/interpreter.js';
import type { LLMProvider, LLMMessage, LLMTool } from '../src/providers/index.js';
import type { Action } from '../src/types.js';

describe('Interpreter', () => {
  // Create a mock provider for testing
  const createMockProvider = (
    response: { content?: string; toolCalls?: any[] }
  ): LLMProvider => ({
    generateWithTools: vi.fn().mockResolvedValue(response),
  });

  describe('multi-item handling', () => {
    it('should process multiple tool calls from LLM response', async () => {
      const mockProvider = createMockProvider({
        toolCalls: [
          { id: '1', name: 'addItem', arguments: { item: 'apples' } },
          { id: '2', name: 'addItem', arguments: { item: 'oranges' } },
          { id: '3', name: 'addItem', arguments: { item: 'steak' } },
        ],
      });

      const interpreter = new Interpreter(mockProvider);

      const result = await interpreter.interpret({
        input: 'Add apples, oranges, and steak',
        actions: [
          {
            name: 'addItem',
            description: 'Add item to list',
            args: z.object({ item: z.string() }),
          },
        ],
        history: [],
        maxActions: 10,
      });

      expect(result.calls).toHaveLength(3);
      expect(result.calls[0].args).toEqual({ item: 'apples' });
      expect(result.calls[1].args).toEqual({ item: 'oranges' });
      expect(result.calls[2].args).toEqual({ item: 'steak' });
    });
  });

  describe('cross-action context', () => {
    it('should process cross-referencing tool calls from LLM response', async () => {
      const mockProvider = createMockProvider({
        toolCalls: [
          { id: '1', name: 'createList', arguments: { name: 'groceries' } },
          {
            id: '2',
            name: 'addItem',
            arguments: { listName: 'groceries', item: 'milk' },
          },
        ],
      });

      const interpreter = new Interpreter(mockProvider);

      const result = await interpreter.interpret({
        input: 'Create a groceries list and add milk to it',
        actions: [
          {
            name: 'createList',
            description: 'Create a list',
            args: z.object({ name: z.string() }),
          },
          {
            name: 'addItem',
            description: 'Add item to list',
            args: z.object({ listName: z.string(), item: z.string() }),
          },
        ],
        history: [],
        maxActions: 10,
      });

      expect(result.calls).toHaveLength(2);
      expect(result.calls[0].action).toBe('createList');
      expect(result.calls[0].args).toEqual({ name: 'groceries' });
      expect(result.calls[1].action).toBe('addItem');
      expect(result.calls[1].args).toEqual({ listName: 'groceries', item: 'milk' });
    });
  });

  describe('few-shot examples', () => {
    it('should include examples in system prompt sent to provider', async () => {
      const mockProvider = createMockProvider({
        toolCalls: [{ id: '1', name: 'addItem', arguments: { item: 'milk' } }],
      });

      const interpreter = new Interpreter(mockProvider);

      const actionWithExamples: Action<{ item: string }> = {
        name: 'addItem',
        description: 'Add an item to the shopping list',
        args: z.object({ item: z.string() }),
        examples: [
          { input: 'put milk on the list', args: { item: 'milk' } },
          { input: 'I need eggs', args: { item: 'eggs' } },
        ],
      };

      await interpreter.interpret({
        input: 'put milk on the list',
        actions: [actionWithExamples],
        history: [],
        maxActions: 5,
      });

      // Verify the provider was called with a system prompt containing examples
      expect(mockProvider.generateWithTools).toHaveBeenCalledTimes(1);
      const callArgs = (mockProvider.generateWithTools as any).mock.calls[0];
      const options = callArgs[2];

      expect(options.system).toContain('## Few-Shot Examples');
      expect(options.system).toContain('put milk on the list');
      expect(options.system).toContain('addItem');
      expect(options.system).toContain('"item":"milk"');
    });

    it('should include first example in tool description', async () => {
      const mockProvider = createMockProvider({
        toolCalls: [],
        content: 'Clarification needed',
      });

      const interpreter = new Interpreter(mockProvider);

      const actionWithExamples: Action<{ item: string }> = {
        name: 'addItem',
        description: 'Add an item to the shopping list',
        args: z.object({ item: z.string() }),
        examples: [{ input: 'put milk on the list', args: { item: 'milk' } }],
      };

      await interpreter.interpret({
        input: 'test',
        actions: [actionWithExamples],
        history: [],
        maxActions: 5,
      });

      // Verify the tool description includes the example
      const callArgs = (mockProvider.generateWithTools as any).mock.calls[0];
      const tools = callArgs[1] as LLMTool[];

      expect(tools[0].description).toContain('Add an item to the shopping list');
      expect(tools[0].description).toContain('Example: "put milk on the list"');
    });

    it('should handle actions without examples gracefully', async () => {
      const mockProvider = createMockProvider({
        toolCalls: [{ id: '1', name: 'addItem', arguments: { item: 'milk' } }],
      });

      const interpreter = new Interpreter(mockProvider);

      const actionWithoutExamples: Action<{ item: string }> = {
        name: 'addItem',
        description: 'Add an item to the shopping list',
        args: z.object({ item: z.string() }),
      };

      await interpreter.interpret({
        input: 'add milk',
        actions: [actionWithoutExamples],
        history: [],
        maxActions: 5,
      });

      // Verify the provider was called and no errors occurred
      expect(mockProvider.generateWithTools).toHaveBeenCalledTimes(1);
      const callArgs = (mockProvider.generateWithTools as any).mock.calls[0];
      const options = callArgs[2];

      // No examples section when no examples defined
      expect(options.system).not.toContain('## Few-Shot Examples');
    });

    it('should limit examples to 3 per action', async () => {
      const mockProvider = createMockProvider({
        toolCalls: [],
        content: 'test',
      });

      const interpreter = new Interpreter(mockProvider);

      const actionWithManyExamples: Action<{ item: string }> = {
        name: 'addItem',
        description: 'Add an item',
        args: z.object({ item: z.string() }),
        examples: [
          { input: 'example 1', args: { item: 'one' } },
          { input: 'example 2', args: { item: 'two' } },
          { input: 'example 3', args: { item: 'three' } },
          { input: 'example 4', args: { item: 'four' } },
          { input: 'example 5', args: { item: 'five' } },
        ],
      };

      await interpreter.interpret({
        input: 'test',
        actions: [actionWithManyExamples],
        history: [],
        maxActions: 5,
      });

      const callArgs = (mockProvider.generateWithTools as any).mock.calls[0];
      const options = callArgs[2];

      // Should include first 3 examples only
      expect(options.system).toContain('example 1');
      expect(options.system).toContain('example 2');
      expect(options.system).toContain('example 3');
      expect(options.system).not.toContain('example 4');
      expect(options.system).not.toContain('example 5');
    });
  });

  describe('system prompt', () => {
    it('should include multi-item handling instructions', async () => {
      const mockProvider = createMockProvider({
        toolCalls: [],
        content: 'test',
      });

      const interpreter = new Interpreter(mockProvider);

      await interpreter.interpret({
        input: 'test',
        actions: [
          {
            name: 'addItem',
            description: 'Add item',
            args: z.object({ item: z.string() }),
          },
        ],
        history: [],
        maxActions: 5,
      });

      const callArgs = (mockProvider.generateWithTools as any).mock.calls[0];
      const options = callArgs[2];

      expect(options.system).toContain('## Multi-Item Handling');
      expect(options.system).toContain('SEPARATE action call for EACH item');
    });

    it('should include cross-action context instructions', async () => {
      const mockProvider = createMockProvider({
        toolCalls: [],
        content: 'test',
      });

      const interpreter = new Interpreter(mockProvider);

      await interpreter.interpret({
        input: 'test',
        actions: [
          {
            name: 'addItem',
            description: 'Add item',
            args: z.object({ item: z.string() }),
          },
        ],
        history: [],
        maxActions: 5,
      });

      const callArgs = (mockProvider.generateWithTools as any).mock.calls[0];
      const options = callArgs[2];

      expect(options.system).toContain('## Cross-Action Context Resolution');
      expect(options.system).toContain('pronouns');
    });
  });
});
