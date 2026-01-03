import type { Action, ActionPlan, NLAPConfig, NLAPEngine as INLAPEngine } from './types.js';
import { ConfigError } from './errors.js';
import { createProvider } from './providers/index.js';
import { KeywordRouter } from './router.js';
import { Interpreter } from './interpreter.js';
import { Validator } from './validator.js';
import { SimpleMemory } from './memory.js';

/**
 * Generate a unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The NLAP engine class that orchestrates interpretation
 */
class NLAPEngine implements INLAPEngine {
  private provider;
  private router: KeywordRouter;
  private interpreter: Interpreter;
  private validator: Validator;
  private memory: SimpleMemory;
  private actions: Map<string, Action<any>>;
  private maxActions: number;

  constructor(private config: NLAPConfig) {
    // Create action map
    this.actions = new Map(config.actions.map((a) => [a.name, a]));

    // Create components
    this.provider = createProvider(config);
    this.router = new KeywordRouter(config.actions);
    this.interpreter = new Interpreter(this.provider);
    this.validator = new Validator(this.actions);
    this.memory = new SimpleMemory(config.memoryTurns ?? 5);
    this.maxActions = config.maxActions ?? 5;
  }

  /**
   * Interpret natural language into an action plan
   */
  async interpret(input: string, conversationId?: string): Promise<ActionPlan> {
    const cid = conversationId ?? generateId('conv');

    // 1. Route to get candidate actions
    const candidateNames = this.router.route(input, 12);
    const candidates = candidateNames
      .map((name) => this.actions.get(name))
      .filter((a): a is Action<any> => a !== undefined);

    // If no candidates found, use all actions
    const actionsForLLM = candidates.length > 0 ? candidates : this.config.actions;

    // 2. Get conversation history
    const history = this.memory.getHistory(cid);

    // 3. Interpret with LLM
    const interpretResult = await this.interpreter.interpret({
      input,
      actions: actionsForLLM,
      history,
      maxActions: this.maxActions,
    });

    // 4. Handle clarification
    if (interpretResult.clarification) {
      return {
        input,
        calls: [],
        conversationId: cid,
        clarification: interpretResult.clarification,
      };
    }

    // 5. Validate arguments
    const validatedCalls = await this.validator.validate(interpretResult.calls);

    // 6. Update memory
    this.memory.addTurn(cid, input, validatedCalls);

    // 7. Return plan
    return {
      input,
      calls: validatedCalls,
      conversationId: cid,
    };
  }

  /**
   * Clear conversation memory
   */
  clearConversation(conversationId: string): void {
    this.memory.clear(conversationId);
  }
}

/**
 * Create an NLAP engine with the given configuration
 *
 * @example
 * ```typescript
 * import { nlap, defineAction } from 'nlap';
 * import { z } from 'zod';
 *
 * const createTask = defineAction({
 *   name: 'createTask',
 *   description: 'Create a new task',
 *   args: z.object({
 *     title: z.string(),
 *     dueDate: z.string().datetime().optional(),
 *   }),
 * });
 *
 * const engine = nlap({
 *   provider: 'openai',
 *   apiKey: process.env.OPENAI_API_KEY,
 *   actions: [createTask],
 * });
 *
 * const plan = await engine.interpret('Create a task to review budget');
 * console.log(plan.calls);
 * ```
 */
export function nlap(config: NLAPConfig): INLAPEngine {
  // Validate configuration
  if (!config.actions || config.actions.length === 0) {
    throw new ConfigError('At least one action must be provided');
  }

  if (config.provider === 'openai' && !config.apiKey) {
    throw new ConfigError('OpenAI provider requires an apiKey');
  }

  return new NLAPEngine(config);
}
