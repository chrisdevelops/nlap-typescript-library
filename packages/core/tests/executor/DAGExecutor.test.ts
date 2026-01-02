import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DAGExecutor } from '../../src/executor/DAGExecutor.js';
import { ActionRegistry } from '../../src/registry/ActionRegistry.js';
import { z } from 'zod';
import type { Plan } from '../../src/types/plans.js';
import type { ActionCall } from '../../src/types/actions.js';
import type { BaseContext } from '../../src/types/base.js';

describe('DAGExecutor', () => {
  let registry: ActionRegistry<BaseContext>;
  let executor: DAGExecutor<BaseContext>;

  beforeEach(() => {
    registry = new ActionRegistry<BaseContext>();
    executor = new DAGExecutor(registry);
  });

  describe('Basic Execution', () => {
    it('should execute a single action successfully', async () => {
      const mockHandler = vi.fn().mockResolvedValue({ id: '123' });

      registry.register({
        id: 'action1',
        description: 'Test action',
        argsSchema: z.object({ name: z.string() }),
        handler: mockHandler,
      });

      const plan: Plan = {
        planId: 'plan1',
        input: {
          raw: 'test',
          normalized: 'test',
          context: { requestId: 'req1' },
          conversationId: 'conv1',
          turnNumber: 1,
        },
        calls: [
          {
            callId: 'call1',
            actionId: 'action1',
            args: { name: 'test' },
            confidence: 1.0,
          },
        ],
        conversationId: 'conv1',
        turnNumber: 1,
        confidence: 1.0,
        createdAt: new Date(),
      };

      const result = await executor.execute(plan, { requestId: 'req1' });

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.results.get('call1')).toEqual({
        result: { id: '123' },
      });
      expect(mockHandler).toHaveBeenCalledWith(
        { name: 'test' },
        expect.objectContaining({
          appContext: { requestId: 'req1' },
        })
      );
    });

    it('should handle actions without handlers', async () => {
      registry.register({
        id: 'action1',
        description: 'Test action',
        argsSchema: z.object({}),
        // No handler
      });

      const plan: Plan = {
        planId: 'plan1',
        input: {
          raw: 'test',
          normalized: 'test',
          context: { requestId: 'req1' },
          conversationId: 'conv1',
          turnNumber: 1,
        },
        calls: [
          {
            callId: 'call1',
            actionId: 'action1',
            args: {},
            confidence: 1.0,
          },
        ],
        conversationId: 'conv1',
        turnNumber: 1,
        confidence: 1.0,
        createdAt: new Date(),
      };

      const result = await executor.execute(plan, { requestId: 'req1' });

      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results.get('call1')?.error?.message).toContain('has no handler');
    });
  });

  describe('Dependency Ordering', () => {
    it('should execute actions in dependency order', async () => {
      const executionOrder: string[] = [];

      registry.register({
        id: 'char.create',
        description: 'Create character',
        argsSchema: z.object({ name: z.string() }),
        handler: async (args) => {
          executionOrder.push('char.create');
          return { id: 'char1' };
        },
      });

      registry.register({
        id: 'rel.create',
        description: 'Create relationship',
        dependencies: ['char.create'],
        argsSchema: z.object({ from: z.string(), to: z.string() }),
        handler: async (args, ctx) => {
          executionOrder.push('rel.create');
          const charResult = ctx.previousResults.get('call1')?.result as any;
          expect(charResult.id).toBe('char1');
          return { id: 'rel1' };
        },
      });

      const plan: Plan = {
        planId: 'plan1',
        input: {
          raw: 'test',
          normalized: 'test',
          context: { requestId: 'req1' },
          conversationId: 'conv1',
          turnNumber: 1,
        },
        calls: [
          {
            callId: 'call1',
            actionId: 'char.create',
            args: { name: 'Alice' },
            confidence: 1.0,
          },
          {
            callId: 'call2',
            actionId: 'rel.create',
            args: { from: 'Alice', to: 'Bob' },
            confidence: 1.0,
            dependsOn: ['call1'],
          },
        ],
        conversationId: 'conv1',
        turnNumber: 1,
        confidence: 1.0,
        createdAt: new Date(),
      };

      const result = await executor.execute(plan, { requestId: 'req1' });

      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(executionOrder).toEqual(['char.create', 'rel.create']);
    });

    it('should execute independent actions in parallel', async () => {
      const startTimes: Record<string, number> = {};
      const endTimes: Record<string, number> = {};

      registry.register({
        id: 'action1',
        description: 'Action 1',
        argsSchema: z.object({}),
        handler: async () => {
          startTimes['action1'] = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 50));
          endTimes['action1'] = Date.now();
          return { id: '1' };
        },
      });

      registry.register({
        id: 'action2',
        description: 'Action 2',
        argsSchema: z.object({}),
        handler: async () => {
          startTimes['action2'] = Date.now();
          await new Promise((resolve) => setTimeout(resolve, 50));
          endTimes['action2'] = Date.now();
          return { id: '2' };
        },
      });

      const plan: Plan = {
        planId: 'plan1',
        input: {
          raw: 'test',
          normalized: 'test',
          context: { requestId: 'req1' },
          conversationId: 'conv1',
          turnNumber: 1,
        },
        calls: [
          {
            callId: 'call1',
            actionId: 'action1',
            args: {},
            confidence: 1.0,
          },
          {
            callId: 'call2',
            actionId: 'action2',
            args: {},
            confidence: 1.0,
          },
        ],
        conversationId: 'conv1',
        turnNumber: 1,
        confidence: 1.0,
        createdAt: new Date(),
      };

      const start = Date.now();
      const result = await executor.execute(plan, { requestId: 'req1' });
      const totalDuration = Date.now() - start;

      expect(result.succeeded).toBe(2);
      // Should complete in ~50ms (parallel) not ~100ms (sequential)
      expect(totalDuration).toBeLessThan(80);
      // Actions should have overlapping execution
      expect(startTimes['action2']).toBeLessThan(endTimes['action1']);
    });
  });

  describe('Retry Logic', () => {
    it('should retry on failure with exponential backoff', async () => {
      let attempts = 0;

      registry.register({
        id: 'flaky',
        description: 'Flaky action',
        argsSchema: z.object({}),
        handler: async () => {
          attempts++;
          if (attempts < 3) {
            throw new Error('Temporary failure');
          }
          return { success: true };
        },
        retry: {
          maxAttempts: 3,
          backoff: 'exponential',
          delayMs: 10,
        },
      });

      const plan: Plan = {
        planId: 'plan1',
        input: {
          raw: 'test',
          normalized: 'test',
          context: { requestId: 'req1' },
          conversationId: 'conv1',
          turnNumber: 1,
        },
        calls: [
          {
            callId: 'call1',
            actionId: 'flaky',
            args: {},
            confidence: 1.0,
          },
        ],
        conversationId: 'conv1',
        turnNumber: 1,
        confidence: 1.0,
        createdAt: new Date(),
      };

      const result = await executor.execute(plan, { requestId: 'req1' });

      expect(result.succeeded).toBe(1);
      expect(attempts).toBe(3);
      expect(result.results.get('call1')?.result).toEqual({ success: true });
    });

    it('should fail after max retry attempts', async () => {
      let attempts = 0;

      registry.register({
        id: 'failing',
        description: 'Always failing action',
        argsSchema: z.object({}),
        handler: async () => {
          attempts++;
          throw new Error('Permanent failure');
        },
        retry: {
          maxAttempts: 3,
          backoff: 'linear',
          delayMs: 10,
        },
      });

      const plan: Plan = {
        planId: 'plan1',
        input: {
          raw: 'test',
          normalized: 'test',
          context: { requestId: 'req1' },
          conversationId: 'conv1',
          turnNumber: 1,
        },
        calls: [
          {
            callId: 'call1',
            actionId: 'failing',
            args: {},
            confidence: 1.0,
          },
        ],
        conversationId: 'conv1',
        turnNumber: 1,
        confidence: 1.0,
        createdAt: new Date(),
      };

      const result = await executor.execute(plan, { requestId: 'req1' });

      expect(result.failed).toBe(1);
      expect(attempts).toBe(3);
      expect(result.results.get('call1')?.error?.message).toBe('Permanent failure');
    });
  });

  describe('Compensation/Rollback', () => {
    it('should compensate on failure in reverse order', async () => {
      const compensationOrder: string[] = [];

      registry.register({
        id: 'step1',
        description: 'Step 1',
        argsSchema: z.object({}),
        handler: async () => ({ id: 'step1' }),
        compensate: async () => {
          compensationOrder.push('step1');
        },
      });

      registry.register({
        id: 'step2',
        description: 'Step 2',
        dependencies: ['step1'],
        argsSchema: z.object({}),
        handler: async () => ({ id: 'step2' }),
        compensate: async () => {
          compensationOrder.push('step2');
        },
      });

      registry.register({
        id: 'step3',
        description: 'Step 3 (fails)',
        dependencies: ['step2'],
        argsSchema: z.object({}),
        handler: async () => {
          throw new Error('Step 3 failed');
        },
        compensate: async () => {
          compensationOrder.push('step3');
        },
      });

      const plan: Plan = {
        planId: 'plan1',
        input: {
          raw: 'test',
          normalized: 'test',
          context: { requestId: 'req1' },
          conversationId: 'conv1',
          turnNumber: 1,
        },
        calls: [
          {
            callId: 'call1',
            actionId: 'step1',
            args: {},
            confidence: 1.0,
          },
          {
            callId: 'call2',
            actionId: 'step2',
            args: {},
            confidence: 1.0,
            dependsOn: ['call1'],
          },
          {
            callId: 'call3',
            actionId: 'step3',
            args: {},
            confidence: 1.0,
            dependsOn: ['call2'],
          },
        ],
        conversationId: 'conv1',
        turnNumber: 1,
        confidence: 1.0,
        createdAt: new Date(),
      };

      const result = await executor.execute(plan, { requestId: 'req1' });

      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      // Compensation should run in reverse order (step2, step1)
      // step3 failed so it shouldn't be compensated
      expect(compensationOrder).toEqual(['step2', 'step1']);
    });

    it('should not compensate when disabled', async () => {
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
          throw new Error('Failed');
        },
      });

      const executorNoCompensation = new DAGExecutor(registry, {
        enableCompensation: false,
      });

      const plan: Plan = {
        planId: 'plan1',
        input: {
          raw: 'test',
          normalized: 'test',
          context: { requestId: 'req1' },
          conversationId: 'conv1',
          turnNumber: 1,
        },
        calls: [
          {
            callId: 'call1',
            actionId: 'step1',
            args: {},
            confidence: 1.0,
          },
          {
            callId: 'call2',
            actionId: 'step2',
            args: {},
            confidence: 1.0,
            dependsOn: ['call1'],
          },
        ],
        conversationId: 'conv1',
        turnNumber: 1,
        confidence: 1.0,
        createdAt: new Date(),
      };

      const result = await executorNoCompensation.execute(plan, { requestId: 'req1' });

      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(compensated).toEqual([]); // No compensation
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty plan', async () => {
      const plan: Plan = {
        planId: 'plan1',
        input: {
          raw: 'test',
          normalized: 'test',
          context: { requestId: 'req1' },
          conversationId: 'conv1',
          turnNumber: 1,
        },
        calls: [],
        conversationId: 'conv1',
        turnNumber: 1,
        confidence: 1.0,
        createdAt: new Date(),
      };

      const result = await executor.execute(plan, { requestId: 'req1' });

      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results.size).toBe(0);
    });

    it('should handle action not in registry', async () => {
      const plan: Plan = {
        planId: 'plan1',
        input: {
          raw: 'test',
          normalized: 'test',
          context: { requestId: 'req1' },
          conversationId: 'conv1',
          turnNumber: 1,
        },
        calls: [
          {
            callId: 'call1',
            actionId: 'nonexistent',
            args: {},
            confidence: 1.0,
          },
        ],
        conversationId: 'conv1',
        turnNumber: 1,
        confidence: 1.0,
        createdAt: new Date(),
      };

      const result = await executor.execute(plan, { requestId: 'req1' });

      expect(result.failed).toBe(1);
      expect(result.results.get('call1')?.error?.message).toContain('not found in registry');
    });
  });
});
