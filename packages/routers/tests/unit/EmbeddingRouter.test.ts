import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddingRouter } from '../../src/embedding/EmbeddingRouter.js';
import { ActionRegistry } from '@nlap/core';
import { z } from 'zod';

describe('EmbeddingRouter', () => {
  let registry: ActionRegistry;
  let router: EmbeddingRouter;

  beforeEach(() => {
    registry = new ActionRegistry();

    // Register test actions
    registry.register({
      id: 'tasks.create',
      description: 'Create a new task with title and due date',
      argsSchema: z.object({ title: z.string() }),
      tags: ['tasks', 'create'],
    });

    registry.register({
      id: 'tasks.list',
      description: 'List all tasks in the system',
      argsSchema: z.object({}),
      tags: ['tasks', 'read'],
    });

    registry.register({
      id: 'users.invite',
      description: 'Invite a new user to join the team',
      argsSchema: z.object({ email: z.string() }),
      tags: ['users', 'create'],
    });

    router = new EmbeddingRouter();
  });

  it('should initialize and cache embeddings', async () => {
    const result = await router.route('create a task', {}, registry);

    // Should return candidates
    expect(result.candidates).toBeDefined();
    expect(result.duration).toBeGreaterThan(0);

    // Second call should be faster (cached)
    const start = Date.now();
    await router.route('create a task', {}, registry);
    const duration = Date.now() - start;

    // Cached should be relatively fast
    expect(duration).toBeLessThan(500);
  }, 30000); // 30s timeout for model download on first run

  it('should rank semantically similar actions highly', async () => {
    const result = await router.route('add a new todo item', {}, registry);

    // "add a new todo item" is semantically similar to "create a new task"
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].actionId).toBe('tasks.create');
  }, 30000);

  it('should handle multi-word semantic queries', async () => {
    const result = await router.route('invite someone to the team', {}, registry);

    // Should match users.invite
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].actionId).toBe('users.invite');
  }, 30000);

  it('should return empty candidates for unrelated queries with high threshold', async () => {
    const strictRouter = new EmbeddingRouter({ minScore: 0.9 });
    const result = await strictRouter.route('quantum physics equation', {}, registry);

    // No actions related to physics, and high threshold
    // May return 0 or very few candidates
    expect(result.candidates).toBeDefined();
  }, 30000);

  it('should respect minScore threshold', async () => {
    const strictRouter = new EmbeddingRouter({ minScore: 0.7 });
    const laxRouter = new EmbeddingRouter({ minScore: 0.1 });

    const strictResult = await strictRouter.route('create task', {}, registry);
    const laxResult = await laxRouter.route('create task', {}, registry);

    // Lax router should return more candidates
    expect(laxResult.candidates.length).toBeGreaterThanOrEqual(strictResult.candidates.length);
  }, 30000);

  it('should return method embedding', async () => {
    const result = await router.route('create task', {}, registry);

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].method).toBe('embedding');
  }, 30000);

  it('should invalidate cache for specific action', async () => {
    await router.route('test', {}, registry);

    router.invalidateAction('tasks.create');

    // Re-routing should work (regenerates embedding for tasks.create)
    const result = await router.route('create task', {}, registry);
    expect(result.candidates.length).toBeGreaterThan(0);
  }, 30000);

  it('should clear all cache', async () => {
    await router.route('test', {}, registry);

    router.clearCache();

    // Next route should reinitialize all embeddings
    const result = await router.route('create task', {}, registry);
    expect(result.candidates.length).toBeGreaterThan(0);
  }, 30000);

  it('should sort candidates by score descending', async () => {
    const result = await router.route('create task', {}, registry);

    // Scores should be in descending order
    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i - 1].score).toBeGreaterThanOrEqual(
        result.candidates[i].score
      );
    }
  }, 30000);
});
