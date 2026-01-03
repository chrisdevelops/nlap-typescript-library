import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { KeywordRouter } from '../src/router.js';
import type { Action } from '../src/types.js';

describe('KeywordRouter', () => {
  const createTestAction = (name: string, description: string): Action<any> => ({
    name,
    description,
    args: z.object({}),
  });

  it('should return relevant candidates for matching input', () => {
    const actions: Action<any>[] = [
      createTestAction('createTask', 'Create a new task with a title'),
      createTestAction('deleteTask', 'Delete an existing task'),
      createTestAction('listUsers', 'List all users in the system'),
    ];

    const router = new KeywordRouter(actions);
    const candidates = router.route('create a new task');

    expect(candidates).toContain('createTask');
    expect(candidates.indexOf('createTask')).toBeLessThan(candidates.indexOf('deleteTask') || Infinity);
  });

  it('should rank actions by relevance', () => {
    const actions: Action<any>[] = [
      createTestAction('sendEmail', 'Send an email to a recipient'),
      createTestAction('deleteEmail', 'Delete an email from inbox'),
      createTestAction('createTask', 'Create a new task'),
    ];

    const router = new KeywordRouter(actions);
    const candidates = router.route('send an email');

    // sendEmail should be first since it best matches the input
    expect(candidates[0]).toBe('sendEmail');
  });

  it('should respect maxCandidates limit', () => {
    const actions: Action<any>[] = Array.from({ length: 20 }, (_, i) =>
      createTestAction(`action${i}`, `Description for action ${i}`)
    );

    const router = new KeywordRouter(actions);
    const candidates = router.route('action description', 5);

    expect(candidates.length).toBeLessThanOrEqual(5);
  });

  it('should handle empty input gracefully', () => {
    const actions: Action<any>[] = [
      createTestAction('createTask', 'Create a new task'),
    ];

    const router = new KeywordRouter(actions);
    const candidates = router.route('');

    // Should return empty or all actions depending on implementation
    expect(Array.isArray(candidates)).toBe(true);
  });

  it('should use examples for routing', () => {
    const actions: Action<any>[] = [
      {
        name: 'createTask',
        description: 'Create a new task',
        args: z.object({}),
        examples: [
          { input: 'add a todo item', args: {} },
          { input: 'make a reminder', args: {} },
        ],
      },
      createTestAction('deleteTask', 'Delete an existing task'),
    ];

    const router = new KeywordRouter(actions);
    const candidates = router.route('add a todo');

    expect(candidates).toContain('createTask');
  });
});
