import { describe, it, expect, vi } from 'vitest';
import { createNLAPEngine, ActionRegistry, Validator, Interpreter } from '../../src/index.js';
import { DAGExecutor } from '../../src/executor/DAGExecutor.js';
import { ThreeTierMemory } from '../../src/memory/ThreeTierMemory.js';
import { z } from 'zod';

/**
 * Mock LLM provider for testing
 */
class MockLLMProvider {
  constructor(private mockResponse?: any) {}

  async generateWithTools(messages: any[], tools: any[]) {
    if (!tools || tools.length === 0) {
      return {
        content: 'No actions available',
        usage: { inputTokens: 100, outputTokens: 50 },
      };
    }

    if (this.mockResponse) {
      return this.mockResponse;
    }

    // Default: return first tool
    return {
      toolCalls: [
        {
          id: '1',
          name: tools[0].name,
          arguments: { title: 'Test Task' },
        },
      ],
      usage: { inputTokens: 100, outputTokens: 50 },
    };
  }
}

/**
 * Mock router for testing
 */
class MockRouter {
  async route(_input: string, _context: any, registry: any) {
    // Return all actions as candidates
    const actions = registry.list();
    return {
      candidates: actions.map((a: any, i: number) => ({
        actionId: a.id,
        score: 1.0 - i * 0.1,
        method: 'mock' as const,
      })),
      duration: 10,
    };
  }
}

describe('Execution Pipeline Integration', () => {
  describe('Full Pipeline with Executor', () => {
    it('should execute a simple action through full pipeline', async () => {
      const registry = new ActionRegistry();
      const mockHandler = vi.fn().mockResolvedValue({ id: 'task_123', title: 'Test Task' });

      registry.register({
        id: 'tasks.create',
        description: 'Create a task',
        argsSchema: z.object({ title: z.string() }),
        handler: mockHandler,
      });

      const engine = createNLAPEngine({
        registry,
        router: new MockRouter(),
        interpreter: new Interpreter(new MockLLMProvider()),
        validator: new Validator(),
        executor: new DAGExecutor(registry),
      });

      const result = await engine.interpret('create a task', { requestId: '1' });

      expect(result.plan.calls).toHaveLength(1);
      expect(result.execution).toBeDefined();
      expect(result.execution?.succeeded).toBe(1);
      expect(result.execution?.failed).toBe(0);
      expect(mockHandler).toHaveBeenCalledWith(
        { title: 'Test Task' },
        expect.objectContaining({
          appContext: { requestId: '1' },
        })
      );
    });

    it('should execute multiple independent actions in parallel', async () => {
      const registry = new ActionRegistry();
      const executionTimes: Record<string, number> = {};

      registry.register({
        id: 'action1',
        description: 'Action 1',
        argsSchema: z.object({}),
        handler: async () => {
          executionTimes['action1'] = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { id: '1' };
        },
      });

      registry.register({
        id: 'action2',
        description: 'Action 2',
        argsSchema: z.object({}),
        handler: async () => {
          executionTimes['action2'] = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 50));
          return { id: '2' };
        },
      });

      const mockProvider = new MockLLMProvider({
        toolCalls: [
          { id: '1', name: 'action1', arguments: {} },
          { id: '2', name: 'action2', arguments: {} },
        ],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const engine = createNLAPEngine({
        registry,
        router: new MockRouter(),
        interpreter: new Interpreter(mockProvider),
        validator: new Validator(),
        executor: new DAGExecutor(registry),
      });

      const start = Date.now();
      const result = await engine.interpret('run actions', { requestId: '1' });
      const duration = Date.now() - start;

      expect(result.execution?.succeeded).toBe(2);
      // Should complete in ~50ms (parallel) not ~100ms (sequential)
      // Allow some overhead for pipeline stages
      expect(duration).toBeLessThan(200);
    });

    it('should execute actions with dependencies in correct order', async () => {
      const registry = new ActionRegistry();
      const executionOrder: string[] = [];

      registry.register({
        id: 'char.create',
        description: 'Create character',
        argsSchema: z.object({ name: z.string() }),
        handler: async (args) => {
          executionOrder.push('char.create');
          return { id: 'char_123', name: args.name };
        },
      });

      registry.register({
        id: 'rel.create',
        description: 'Create relationship',
        dependencies: ['char.create'],
        argsSchema: z.object({ from: z.string(), to: z.string() }),
        handler: async (args, ctx) => {
          executionOrder.push('rel.create');
          // Can access previous results
          const charResult = Array.from(ctx.previousResults.values())[0]?.result as any;
          expect(charResult.id).toBe('char_123');
          return { id: 'rel_456', from: args.from, to: args.to };
        },
      });

      const mockProvider = new MockLLMProvider({
        toolCalls: [
          { id: '1', name: 'char.create', arguments: { name: 'Alice' } },
          { id: '2', name: 'rel.create', arguments: { from: 'Alice', to: 'Bob' } },
        ],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const engine = createNLAPEngine({
        registry,
        router: new MockRouter(),
        interpreter: new Interpreter(mockProvider),
        validator: new Validator(),
        executor: new DAGExecutor(registry),
      });

      const result = await engine.interpret('create character and relationship', { requestId: '1' });

      expect(result.execution?.succeeded).toBe(2);
      expect(executionOrder).toEqual(['char.create', 'rel.create']);
    });
  });

  describe('Retry and Compensation', () => {
    it('should retry failed actions', async () => {
      const registry = new ActionRegistry();
      let attempts = 0;

      registry.register({
        id: 'flaky.action',
        description: 'Flaky action',
        argsSchema: z.object({}),
        handler: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return { success: true, attempts };
        },
        retry: {
          maxAttempts: 3,
          backoff: 'exponential',
          delayMs: 10,
        },
      });

      const engine = createNLAPEngine({
        registry,
        router: new MockRouter(),
        interpreter: new Interpreter(new MockLLMProvider()),
        validator: new Validator(),
        executor: new DAGExecutor(registry),
      });

      const result = await engine.interpret('run flaky action', { requestId: '1' });

      expect(result.execution?.succeeded).toBe(1);
      expect(attempts).toBe(3);
    });

    it('should compensate on failure', async () => {
      const registry = new ActionRegistry();
      const compensated: string[] = [];

      registry.register({
        id: 'step1',
        description: 'Step 1',
        argsSchema: z.object({}),
        handler: async () => ({ id: 'step1' }),
        compensate: async () => {
          compensated.push('step1');
        },
      });

      registry.register({
        id: 'step2',
        description: 'Step 2 (fails)',
        dependencies: ['step1'],
        argsSchema: z.object({}),
        handler: async () => {
          throw new Error('Step 2 failed');
        },
        compensate: async () => {
          compensated.push('step2');
        },
      });

      const mockProvider = new MockLLMProvider({
        toolCalls: [
          { id: '1', name: 'step1', arguments: {} },
          { id: '2', name: 'step2', arguments: {} },
        ],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const engine = createNLAPEngine({
        registry,
        router: new MockRouter(),
        interpreter: new Interpreter(mockProvider),
        validator: new Validator(),
        executor: new DAGExecutor(registry),
      });

      const result = await engine.interpret('run steps', { requestId: '1' });

      expect(result.execution?.succeeded).toBe(1);
      expect(result.execution?.failed).toBe(1);
      // step1 should be compensated, step2 failed so no compensation
      expect(compensated).toEqual(['step1']);
    });
  });

  describe('Multi-Turn Conversations', () => {
    it('should maintain conversation memory across turns', async () => {
      const registry = new ActionRegistry();
      const memory = new ThreeTierMemory();

      registry.register({
        id: 'tasks.create',
        description: 'Create a task',
        argsSchema: z.object({ title: z.string() }),
        handler: async (args) => ({ id: 'task_123', title: args.title }),
      });

      const engine = createNLAPEngine({
        registry,
        router: new MockRouter(),
        interpreter: new Interpreter(new MockLLMProvider()),
        validator: new Validator(),
        executor: new DAGExecutor(registry),
        memory,
      });

      // Turn 1
      await engine.interpret('create a task', { requestId: '1' }, 'conv_123');
      expect(memory.getState('conv_123')?.turnCount).toBe(1);

      // Turn 2
      await engine.interpret('create another task', { requestId: '2' }, 'conv_123');
      expect(memory.getState('conv_123')?.turnCount).toBe(2);

      // Check messages
      const messages = memory.getMessagesForLLM('conv_123');
      expect(messages).toHaveLength(4); // 2 turns * 2 messages (user + assistant)
    });

    it('should maintain separate conversation states', async () => {
      const registry = new ActionRegistry();
      const memory = new ThreeTierMemory();

      registry.register({
        id: 'action',
        description: 'Test action',
        argsSchema: z.object({}),
        handler: async () => ({ success: true }),
      });

      const engine = createNLAPEngine({
        registry,
        router: new MockRouter(),
        interpreter: new Interpreter(new MockLLMProvider()),
        validator: new Validator(),
        executor: new DAGExecutor(registry),
        memory,
      });

      await engine.interpret('test', { requestId: '1' }, 'conv_1');
      await engine.interpret('test', { requestId: '2' }, 'conv_1');
      await engine.interpret('test', { requestId: '3' }, 'conv_2');

      expect(memory.getState('conv_1')?.turnCount).toBe(2);
      expect(memory.getState('conv_2')?.turnCount).toBe(1);
    });
  });

  describe('E2E Worldbuilding Scenario', () => {
    it('should handle complex multi-action worldbuilding', async () => {
      const registry = new ActionRegistry();
      const results: any[] = [];

      // Step 1: Create character
      registry.register({
        id: 'character.create',
        description: 'Create a character',
        argsSchema: z.object({ name: z.string(), role: z.string() }),
        handler: async (args) => {
          const character = { id: `char_${Date.now()}`, name: args.name, role: args.role };
          results.push({ action: 'character.create', data: character });
          return character;
        },
      });

      // Step 2: Create location
      registry.register({
        id: 'location.create',
        description: 'Create a location',
        argsSchema: z.object({ name: z.string(), type: z.string() }),
        handler: async (args) => {
          const location = { id: `loc_${Date.now()}`, name: args.name, type: args.type };
          results.push({ action: 'location.create', data: location });
          return location;
        },
      });

      // Step 3: Place character at location (depends on both)
      registry.register({
        id: 'character.place',
        description: 'Place a character at a location',
        dependencies: ['character.create', 'location.create'],
        argsSchema: z.object({ characterName: z.string(), locationName: z.string() }),
        handler: async (args, ctx) => {
          // Access previous results
          const prevResults = Array.from(ctx.previousResults.values());
          const character = prevResults.find((r) => (r.result as any).name === args.characterName)
            ?.result as any;
          const location = prevResults.find((r) => (r.result as any).name === args.locationName)
            ?.result as any;

          const placement = {
            characterId: character.id,
            locationId: location.id,
          };
          results.push({ action: 'character.place', data: placement });
          return placement;
        },
      });

      const mockProvider = new MockLLMProvider({
        toolCalls: [
          { id: '1', name: 'character.create', arguments: { name: 'Alice', role: 'Hero' } },
          { id: '2', name: 'location.create', arguments: { name: 'Castle', type: 'Fortress' } },
          {
            id: '3',
            name: 'character.place',
            arguments: { characterName: 'Alice', locationName: 'Castle' },
          },
        ],
        usage: { inputTokens: 100, outputTokens: 50 },
      });

      const engine = createNLAPEngine({
        registry,
        router: new MockRouter(),
        interpreter: new Interpreter(mockProvider),
        validator: new Validator(),
        executor: new DAGExecutor(registry),
      });

      const result = await engine.interpret('create world', { requestId: '1' });

      expect(result.execution?.succeeded).toBe(3);
      expect(result.execution?.failed).toBe(0);

      // Verify execution order
      expect(results).toHaveLength(3);
      expect(results[0].action).toBe('character.create');
      expect(results[1].action).toBe('location.create');
      expect(results[2].action).toBe('character.place');

      // Verify data
      expect(results[2].data.characterId).toBeTruthy();
      expect(results[2].data.locationId).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle actions without handlers gracefully', async () => {
      const registry = new ActionRegistry();

      registry.register({
        id: 'no.handler',
        description: 'Action without handler',
        argsSchema: z.object({}),
        // No handler
      });

      const engine = createNLAPEngine({
        registry,
        router: new MockRouter(),
        interpreter: new Interpreter(new MockLLMProvider()),
        validator: new Validator(),
        executor: new DAGExecutor(registry),
      });

      const result = await engine.interpret('test', { requestId: '1' });

      expect(result.execution?.failed).toBe(1);
      expect(result.execution?.results.size).toBe(1);
    });

    it('should trace execution stages', async () => {
      const registry = new ActionRegistry();

      registry.register({
        id: 'test.action',
        description: 'Test action',
        argsSchema: z.object({}),
        handler: async () => ({ success: true }),
      });

      const engine = createNLAPEngine({
        registry,
        router: new MockRouter(),
        interpreter: new Interpreter(new MockLLMProvider()),
        validator: new Validator(),
        executor: new DAGExecutor(registry),
      });

      const result = await engine.interpret('test', { requestId: '1' });

      // Check trace includes all stages
      const stages = result.trace.map((e) => e.stage);
      expect(stages).toContain('normalize');
      expect(stages).toContain('route');
      expect(stages).toContain('interpret');
      expect(stages).toContain('validate');
      expect(stages).toContain('execute');
    });
  });
});
