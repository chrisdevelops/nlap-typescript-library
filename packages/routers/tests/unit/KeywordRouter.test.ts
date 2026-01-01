import { describe, it, expect, beforeEach } from 'vitest';
import { KeywordRouter } from '../../src/keyword/KeywordRouter.js';
import { ActionRegistry } from '@nlap/core';
import { z } from 'zod';

describe('KeywordRouter', () => {
  let registry: ActionRegistry;
  let router: KeywordRouter;

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

    router = new KeywordRouter();
  });

  it('should match on action IDs', async () => {
    const result = await router.route('tasks create', {}, registry);

    // Should rank tasks.create highly (matches action ID)
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].actionId).toBe('tasks.create');
  });

  it('should match on descriptions', async () => {
    const result = await router.route('invite user', {}, registry);

    // Should rank users.invite highly (matches description)
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].actionId).toBe('users.invite');
  });

  it('should match on tags', async () => {
    const result = await router.route('create', {}, registry);

    // Should return both create actions
    const createActions = result.candidates.filter(
      (c) => c.actionId === 'tasks.create' || c.actionId === 'users.invite'
    );
    expect(createActions.length).toBe(2);
  });

  it('should return method keyword', async () => {
    const result = await router.route('create task', {}, registry);

    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates[0].method).toBe('keyword');
  });

  it('should rank exact matches higher', async () => {
    const result = await router.route('create a new task', {}, registry);

    // "create a new task" should match tasks.create better than tasks.list
    expect(result.candidates[0].actionId).toBe('tasks.create');
  });

  it('should complete within latency budget', async () => {
    const start = Date.now();
    await router.route('create task', {}, registry);
    const duration = Date.now() - start;

    // First call includes initialization
    const start2 = Date.now();
    await router.route('list tasks', {}, registry);
    const duration2 = Date.now() - start2;

    // Subsequent calls should be fast
    expect(duration2).toBeLessThan(100);
  });

  it('should handle empty input', async () => {
    const result = await router.route('', {}, registry);

    // Should return candidates (even with empty input)
    expect(result.candidates).toBeDefined();
  });

  it('should sort candidates by score descending', async () => {
    const result = await router.route('create task', {}, registry);

    // Scores should be in descending order
    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i - 1].score).toBeGreaterThanOrEqual(
        result.candidates[i].score
      );
    }
  });
});
