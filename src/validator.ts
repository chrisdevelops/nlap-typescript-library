import { ZodError } from 'zod';
import type { Action, ActionCall } from './types.js';
import { ValidationError } from './errors.js';

/**
 * Validator that validates action arguments against Zod schemas
 */
export class Validator {
  private actions: Map<string, Action<any>>;

  constructor(actions: Map<string, Action<any>>) {
    this.actions = actions;
  }

  /**
   * Validate action calls against their schemas
   * Returns validated calls with parsed arguments
   */
  async validate(
    calls: Array<{ action: string; args: unknown; confidence: number }>
  ): Promise<ActionCall[]> {
    const validated: ActionCall[] = [];

    for (const call of calls) {
      const action = this.actions.get(call.action);

      if (!action) {
        throw new ValidationError(`Unknown action: ${call.action}`, call.action);
      }

      try {
        const validatedArgs = action.args.parse(call.args);
        validated.push({
          action: call.action,
          args: validatedArgs,
          confidence: call.confidence,
        });
      } catch (error) {
        if (error instanceof ZodError) {
          const issues = error.errors
            .map((e) => `${e.path.join('.')}: ${e.message}`)
            .join(', ');
          throw new ValidationError(
            `Validation failed for ${call.action}: ${issues}`,
            call.action
          );
        }
        throw error;
      }
    }

    return validated;
  }
}
