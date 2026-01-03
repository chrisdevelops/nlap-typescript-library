import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Validator } from '../src/validator.js';
import { ValidationError } from '../src/errors.js';
import type { Action } from '../src/types.js';

describe('Validator', () => {
  const createTestAction = (name: string, schema: z.ZodType): Action<any> => ({
    name,
    description: `Test action ${name}`,
    args: schema,
  });

  it('should validate correct arguments', async () => {
    const actions = new Map<string, Action<any>>([
      ['createTask', createTestAction('createTask', z.object({ title: z.string() }))],
    ]);

    const validator = new Validator(actions);

    const result = await validator.validate([
      { action: 'createTask', args: { title: 'Test task' }, confidence: 0.95 },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].action).toBe('createTask');
    expect(result[0].args).toEqual({ title: 'Test task' });
  });

  it('should throw ValidationError for unknown action', async () => {
    const actions = new Map<string, Action<any>>();
    const validator = new Validator(actions);

    await expect(
      validator.validate([
        { action: 'unknownAction', args: {}, confidence: 0.95 },
      ])
    ).rejects.toThrow(ValidationError);
  });

  it('should throw ValidationError for invalid arguments', async () => {
    const actions = new Map<string, Action<any>>([
      ['createTask', createTestAction('createTask', z.object({ title: z.string() }))],
    ]);

    const validator = new Validator(actions);

    await expect(
      validator.validate([
        { action: 'createTask', args: { title: 123 }, confidence: 0.95 },
      ])
    ).rejects.toThrow(ValidationError);
  });

  it('should validate multiple calls', async () => {
    const actions = new Map<string, Action<any>>([
      ['createTask', createTestAction('createTask', z.object({ title: z.string() }))],
      ['listTasks', createTestAction('listTasks', z.object({ status: z.string().optional() }))],
    ]);

    const validator = new Validator(actions);

    const result = await validator.validate([
      { action: 'createTask', args: { title: 'Task 1' }, confidence: 0.95 },
      { action: 'listTasks', args: {}, confidence: 0.90 },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0].action).toBe('createTask');
    expect(result[1].action).toBe('listTasks');
  });

  it('should coerce and transform values according to schema', async () => {
    const actions = new Map<string, Action<any>>([
      ['setCount', createTestAction('setCount', z.object({
        count: z.coerce.number(),
      }))],
    ]);

    const validator = new Validator(actions);

    const result = await validator.validate([
      { action: 'setCount', args: { count: '42' }, confidence: 0.95 },
    ]);

    expect(result[0].args).toEqual({ count: 42 });
  });
});
