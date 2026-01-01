import { zodToJsonSchema } from 'zod-to-json-schema';
import type { LLMProvider, LLMTool } from '@nlap/providers';
import type { Plan, ClarificationRequest } from '../types/plans.js';
import type { ActionCall } from '../types/actions.js';
import type { BaseContext, Message } from '../types/base.js';
import type { ValidationError } from '../types/validation.js';

/**
 * Request to interpret natural language input
 */
export interface InterpretRequest {
  input: string;
  context: BaseContext;
  actions: Array<{
    id: string;
    description: string;
    argsSchemaJson: Record<string, unknown>;
    tags?: string[];
    examples?: any[];
    risk?: string;
  }>;
  conversationHistory?: Message[];
  maxActions?: number;
}

/**
 * Result from interpretation
 */
export interface InterpretResult {
  calls: Omit<ActionCall, 'callId'>[];
  clarification?: ClarificationRequest;
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * Interpreter that converts natural language to action plans using LLM
 */
export class Interpreter {
  constructor(private provider: LLMProvider) {}

  /**
   * Interpret natural language input into action calls
   */
  async interpret(request: InterpretRequest): Promise<InterpretResult> {
    const tools = this.convertActionsToTools(request.actions);

    const messages = [
      ...(request.conversationHistory ?? []),
      {
        role: 'user' as const,
        content: request.input,
      },
    ];

    const systemPrompt = this.buildSystemPrompt(request.maxActions ?? 5);

    const response = await this.provider.generateWithTools(messages, tools, { system: systemPrompt });

    // Check for clarification
    if (response.content && !response.toolCalls) {
      return {
        calls: [],
        clarification: {
          question: response.content,
          actionIds: [],
        },
        usage: response.usage,
      };
    }

    // Convert tool calls to action calls
    const calls = (response.toolCalls ?? []).map((tc: any) => ({
      actionId: tc.name,
      args: tc.arguments,
      confidence: 0.95, // Claude doesn't provide confidence scores
      dependsOn: undefined, // Dependencies detected during validation/execution
    }));

    return {
      calls,
      usage: response.usage,
    };
  }

  /**
   * Repair a failed plan by asking the LLM to fix validation errors
   */
  async repair(
    input: string,
    context: BaseContext,
    failedPlan: Plan,
    errors: ValidationError[],
    actions: InterpretRequest['actions']
  ): Promise<Plan> {
    const errorSummary = errors.map((e) => `- ${e.actionId}: ${e.message}`).join('\n');

    const repairPrompt = `
The following plan had validation errors:

${errorSummary}

Original input: "${input}"

Please provide a corrected plan.
    `.trim();

    const result = await this.interpret({
      input: repairPrompt,
      context,
      actions,
    });

    return {
      ...failedPlan,
      calls: result.calls.map((c, i) => ({
        ...c,
        callId: `call_repair_${Date.now()}_${i}`,
      })),
      clarification: result.clarification,
    };
  }

  /**
   * Convert actions to LLM tools format
   */
  private convertActionsToTools(actions: InterpretRequest['actions']): LLMTool[] {
    return actions.map((a) => ({
      name: a.id,
      description: a.description,
      input_schema: a.argsSchemaJson,
    }));
  }

  /**
   * Build system prompt for the LLM
   */
  private buildSystemPrompt(maxActions: number): string {
    return `You are an action planning assistant. Given a user's natural language input, select the appropriate actions and extract the required parameters.

Rules:
1. Only use the provided actions (tools)
2. Extract parameters accurately from the input
3. Maximum ${maxActions} actions per request
4. If information is missing or ambiguous, ask for clarification instead of guessing
5. Use tool calls to represent actions

When you need clarification, respond with text (no tool calls) asking a clear question.`;
  }
}

/**
 * Prepare actions for LLM by converting Zod schemas to JSON Schema
 */
export async function prepareActionsForLLM(actions: Array<any>, context: BaseContext): Promise<InterpretRequest['actions']> {
  return Promise.all(
    actions.map(async (action) => {
      const schema =
        typeof action.argsSchema === 'function' ? await action.argsSchema(context) : action.argsSchema;

      return {
        id: action.id,
        description: action.description,
        argsSchemaJson: zodToJsonSchema(schema),
        tags: action.tags,
        risk: action.risk,
        examples: action.examples,
      };
    })
  );
}
