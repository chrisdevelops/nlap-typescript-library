import type { ZodType } from 'zod';
import type { Action } from './types.js';

/**
 * Configuration for defining an action
 */
export interface ActionConfig<TArgs> {
  /** Action name - must be alphanumeric with underscores (e.g., 'createTask') */
  name: string;
  /** Description for the LLM to understand when to use this action */
  description: string;
  /** Zod schema for validating arguments */
  args: ZodType<TArgs>;
  /** Optional examples for few-shot learning */
  examples?: Array<{ input: string; args: TArgs }>;
}

/**
 * Validate that an action name is alphanumeric with underscores only
 */
function validateActionName(name: string): void {
  if (!name || name.trim() === '') {
    throw new Error('Action name cannot be empty');
  }

  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(
      `Action name "${name}" is invalid. Names must start with a letter and contain only alphanumeric characters and underscores.`
    );
  }
}

/**
 * Define an action that can be registered with the NLAP engine
 *
 * @example
 * ```typescript
 * import { defineAction } from 'nlap';
 * import { z } from 'zod';
 *
 * const createTask = defineAction({
 *   name: 'createTask',
 *   description: 'Create a new task with a title and optional due date',
 *   args: z.object({
 *     title: z.string().describe('The task title'),
 *     dueDate: z.string().datetime().optional().describe('Due date in ISO format'),
 *   }),
 * });
 * ```
 */
export function defineAction<TArgs>(config: ActionConfig<TArgs>): Action<TArgs> {
  validateActionName(config.name);

  return {
    name: config.name,
    description: config.description,
    args: config.args,
    examples: config.examples,
  };
}
