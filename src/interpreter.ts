import { zodToJsonSchema } from 'zod-to-json-schema';
import type { LLMProvider, LLMMessage, LLMTool } from './providers/index.js';
import type { Action } from './types.js';

/**
 * Request to interpret natural language
 */
export interface InterpretRequest {
  input: string;
  actions: Action<any>[];
  history: LLMMessage[];
  maxActions: number;
}

/**
 * Result from interpretation
 */
export interface InterpretResult {
  calls: Array<{
    action: string;
    args: unknown;
    confidence: number;
  }>;
  clarification?: string;
}

/**
 * Interpreter that converts natural language to action calls using an LLM
 */
export class Interpreter {
  constructor(private provider: LLMProvider) {}

  /**
   * Interpret natural language input into action calls
   */
  async interpret(request: InterpretRequest): Promise<InterpretResult> {
    const tools = this.actionsToTools(request.actions);

    const messages: LLMMessage[] = [
      ...request.history,
      { role: 'user', content: request.input },
    ];

    const systemPrompt = this.buildSystemPrompt(request.actions, request.maxActions);

    const response = await this.provider.generateWithTools(messages, tools, {
      system: systemPrompt,
    });

    // Check for clarification (text response without tool calls)
    if (response.content && !response.toolCalls?.length) {
      return {
        calls: [],
        clarification: response.content,
      };
    }

    // Convert tool calls to action calls
    const calls = (response.toolCalls ?? []).map((tc) => ({
      action: tc.name,
      args: tc.arguments,
      confidence: 0.95,
    }));

    return { calls };
  }

  /**
   * Convert actions to LLM tool format
   */
  private actionsToTools(actions: Action<any>[]): LLMTool[] {
    return actions.map((a) => {
      let description = a.description;
      if (a.examples && a.examples.length > 0) {
        description += ` Example: "${a.examples[0].input}"`;
      }
      return {
        name: a.name,
        description,
        input_schema: zodToJsonSchema(a.args) as Record<string, unknown>,
      };
    });
  }

  /**
   * Build few-shot examples section from action examples
   */
  private buildExamplesSection(actions: Action<any>[]): string {
    const actionsWithExamples = actions.filter(
      (a) => a.examples && a.examples.length > 0
    );

    if (actionsWithExamples.length === 0) {
      return '';
    }

    let section =
      '\n\n## Few-Shot Examples\n\nHere are examples of how to interpret specific inputs:\n';

    for (const action of actionsWithExamples) {
      if (!action.examples) continue;
      const examples = action.examples.slice(0, 3); // Limit to 3 per action
      for (const example of examples) {
        section += `\nInput: "${example.input}"`;
        section += `\nAction: ${action.name}`;
        section += `\nArguments: ${JSON.stringify(example.args)}\n`;
      }
    }

    return section;
  }

  /**
   * Build system prompt for the LLM
   */
  private buildSystemPrompt(actions: Action<any>[], maxActions: number): string {
    const examplesSection = this.buildExamplesSection(actions);

    return `You are an action planning assistant. Given a user's natural language input, select the appropriate actions and extract the required parameters.

## Rules

1. Only use the provided actions (tools)
2. Extract parameters accurately from the input
3. Maximum ${maxActions} actions per request
4. If information is missing or ambiguous, ask for clarification instead of guessing

## Multi-Item Handling

When the user mentions multiple items in a list (comma-separated, "and"-joined, or enumerated), create a SEPARATE action call for EACH item.

Examples:
- "Add apples, oranges, and bananas" → 3 separate action calls, one for each item
- "Create tasks: review code, write tests, deploy" → 3 separate action calls
- "Delete items 1, 2, and 3" → 3 separate action calls

## Cross-Action Context Resolution

When the user references something created in the same request using pronouns ("it", "that", "this") or implicit references, resolve them to the appropriate context.

Examples:
- "Create a shopping list and add milk to it" → The "it" refers to the shopping list being created
  - First call: createList with name "shopping list"
  - Second call: addItem with listName "shopping list" and item "milk"

- "Make a work project then add three tasks to it" → Reference the project name
  - First call: createProject with name "work project"
  - Subsequent calls: addTask with projectName "work project"

When resolving cross-action references:
1. Identify what entity is being created/referenced
2. Extract the name or identifier from the creating action
3. Use that same value in subsequent actions that reference "it"
${examplesSection}
When you need clarification, respond with text (no tool calls) asking a clear question.`;
  }
}
