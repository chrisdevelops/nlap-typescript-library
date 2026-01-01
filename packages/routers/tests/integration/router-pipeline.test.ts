import { describe, it, expect } from 'vitest';
import { createNLAPEngine, ActionRegistry, Validator, Interpreter } from '@nlap/core';
import { KeywordRouter, EmbeddingRouter, HybridRouter } from '../../src/index.js';
import { z } from 'zod';

/**
 * Mock LLM provider for testing without API keys
 */
class MockLLMProvider {
  async generateWithTools(messages: any[], tools: any[]) {
    // Handle empty tools array
    if (!tools || tools.length === 0) {
      return {
        content: 'No actions available',
        usage: { inputTokens: 100, outputTokens: 50 },
      };
    }

    // Mock: always return first tool
    return {
      toolCalls: [{
        id: '1',
        name: tools[0].name,
        arguments: { title: 'Test Task' },
      }],
      usage: { inputTokens: 100, outputTokens: 50 },
    };
  }
}

describe('Router → Pipeline Integration', () => {
  it('should work with KeywordRouter in full pipeline', async () => {
    const registry = new ActionRegistry();

    registry.register({
      id: 'tasks.create',
      description: 'Create a task',
      argsSchema: z.object({ title: z.string() }),
    });

    registry.register({
      id: 'tasks.list',
      description: 'List tasks',
      argsSchema: z.object({}),
    });

    const engine = createNLAPEngine({
      registry,
      router: new KeywordRouter(),
      interpreter: new Interpreter(new MockLLMProvider()),
      validator: new Validator(),
    });

    const result = await engine.interpret(
      'create a task',
      { requestId: '1' }
    );

    expect(result.plan.calls).toHaveLength(1);
    expect(result.plan.calls[0].actionId).toBe('tasks.create');
    expect(result.trace).toContainEqual(
      expect.objectContaining({ stage: 'route', status: 'complete' })
    );
  });

  it('should work with HybridRouter in full pipeline', async () => {
    const registry = new ActionRegistry();

    registry.register({
      id: 'tasks.create',
      description: 'Create a task',
      argsSchema: z.object({ title: z.string() }),
    });

    registry.register({
      id: 'tasks.list',
      description: 'List tasks',
      argsSchema: z.object({}),
    });

    const engine = createNLAPEngine({
      registry,
      router: new HybridRouter(
        new KeywordRouter(),
        new EmbeddingRouter()
      ),
      interpreter: new Interpreter(new MockLLMProvider()),
      validator: new Validator(),
    });

    const result = await engine.interpret(
      'create a task',
      { requestId: '1' }
    );

    expect(result.plan.calls).toHaveLength(1);
    expect(result.plan.calls[0].actionId).toBe('tasks.create');
    expect(result.trace).toContainEqual(
      expect.objectContaining({ stage: 'route', status: 'complete' })
    );
  }, 30000); // 30s timeout for embedding model download

  it('should trace router performance', async () => {
    const registry = new ActionRegistry();

    // Register 20 actions to test routing performance
    for (let i = 0; i < 20; i++) {
      registry.register({
        id: `action${i}`,
        description: `Action ${i}`,
        argsSchema: z.object({}),
      });
    }

    const engine = createNLAPEngine({
      registry,
      router: new KeywordRouter(),
      interpreter: new Interpreter(new MockLLMProvider()),
    });

    const result = await engine.interpret('test', { requestId: '1' });

    const routeEvent = result.trace.find(e => e.stage === 'route' && e.status === 'complete');
    expect(routeEvent).toBeDefined();
    // Should complete within latency budget
    expect(result.duration).toBeLessThan(5000);
  });

  it('should work with empty registry', async () => {
    const registry = new ActionRegistry();

    const engine = createNLAPEngine({
      registry,
      router: new KeywordRouter(),
      interpreter: new Interpreter(new MockLLMProvider()),
    });

    const result = await engine.interpret('test', { requestId: '1' });

    // Should handle gracefully
    expect(result).toBeDefined();
  });

  it('should handle router returning no candidates', async () => {
    const registry = new ActionRegistry();

    registry.register({
      id: 'tasks.create',
      description: 'Create a task',
      argsSchema: z.object({ title: z.string() }),
    });

    // Use embedding router with very high threshold
    const engine = createNLAPEngine({
      registry,
      router: new EmbeddingRouter({ minScore: 0.99 }), // Very high threshold
      interpreter: new Interpreter(new MockLLMProvider()),
    });

    const result = await engine.interpret('quantum physics', { requestId: '1' });

    // Should handle gracefully
    expect(result).toBeDefined();
  }, 30000);
});
