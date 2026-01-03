import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineAction } from '../src/action.js';

describe('defineAction', () => {
  it('should create a valid action with alphanumeric name', () => {
    const action = defineAction({
      name: 'createTask',
      description: 'Create a new task',
      args: z.object({ title: z.string() }),
    });

    expect(action.name).toBe('createTask');
    expect(action.description).toBe('Create a new task');
  });

  it('should allow names with underscores', () => {
    const action = defineAction({
      name: 'create_task',
      description: 'Create a new task',
      args: z.object({ title: z.string() }),
    });

    expect(action.name).toBe('create_task');
  });

  it('should reject names with dots', () => {
    expect(() =>
      defineAction({
        name: 'tasks.create',
        description: 'Create a new task',
        args: z.object({ title: z.string() }),
      })
    ).toThrow('invalid');
  });

  it('should reject names starting with a number', () => {
    expect(() =>
      defineAction({
        name: '123task',
        description: 'Create a new task',
        args: z.object({ title: z.string() }),
      })
    ).toThrow('must start with a letter');
  });

  it('should reject empty names', () => {
    expect(() =>
      defineAction({
        name: '',
        description: 'Create a new task',
        args: z.object({ title: z.string() }),
      })
    ).toThrow('cannot be empty');
  });

  it('should include examples when provided', () => {
    const action = defineAction({
      name: 'createTask',
      description: 'Create a new task',
      args: z.object({ title: z.string() }),
      examples: [
        { input: 'Create a task called review budget', args: { title: 'review budget' } },
      ],
    });

    expect(action.examples).toHaveLength(1);
    expect(action.examples?.[0].input).toBe('Create a task called review budget');
  });
});
