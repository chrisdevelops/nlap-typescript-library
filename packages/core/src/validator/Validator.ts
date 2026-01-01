import { ZodError, type ZodType } from 'zod';
import type { Plan } from '../types/plans.js';
import type { ValidationResult, ValidationError } from '../types/validation.js';
import type { BaseContext } from '../types/base.js';
import type { ActionRegistry } from '../registry/ActionRegistry.js';
import type { ActionCall } from '../types/actions.js';

/**
 * Validator that validates plans against Zod schemas
 */
export class Validator<TContext extends BaseContext = BaseContext> {
  /**
   * Validate a plan against action schemas
   */
  async validate(
    plan: Plan,
    context: TContext,
    registry: ActionRegistry<TContext>
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const validatedCalls: ActionCall[] = [];

    for (const call of plan.calls) {
      const action = registry.get(call.actionId);

      if (!action) {
        errors.push({
          actionId: call.actionId,
          callId: call.callId,
          code: 'ACTION_NOT_FOUND',
          message: `Action "${call.actionId}" not found in registry`,
        });
        continue;
      }

      try {
        // Resolve schema (static or dynamic)
        const schema = await this.resolveSchema(action.argsSchema, context);

        // Validate against schema
        const validatedArgs = schema.parse(call.args);

        validatedCalls.push({
          ...call,
          args: validatedArgs,
        });
      } catch (error) {
        if (error instanceof ZodError) {
          errors.push({
            actionId: call.actionId,
            callId: call.callId,
            code: 'INVALID_ARGS',
            message: `Validation failed for action "${call.actionId}"`,
            zodErrors: error.errors.map((e) => ({
              path: e.path,
              message: e.message,
            })),
          });
        } else {
          errors.push({
            actionId: call.actionId,
            callId: call.callId,
            code: 'SCHEMA_ERROR',
            message: `Schema resolution failed: ${(error as Error).message}`,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      validatedCalls: errors.length === 0 ? validatedCalls : undefined,
    };
  }

  /**
   * Resolve schema factory to actual Zod schema
   */
  private async resolveSchema<TInput>(
    schemaFactory: ZodType<TInput> | ((ctx: TContext) => ZodType<TInput> | Promise<ZodType<TInput>>),
    context: TContext
  ): Promise<ZodType<TInput>> {
    if (typeof schemaFactory === 'function') {
      return await schemaFactory(context);
    }
    return schemaFactory;
  }
}
