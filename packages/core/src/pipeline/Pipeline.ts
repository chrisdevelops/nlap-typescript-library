import type { PipelineConfig, PipelineResult, TraceEvent } from '../types/pipeline.js';
import type { BaseContext } from '../types/base.js';
import type { Plan, NormalizedInput } from '../types/plans.js';
import type { ActionCall } from '../types/actions.js';
import { prepareActionsForLLM } from '../interpreter/Interpreter.js';

/**
 * Pipeline orchestrates all stages of natural language interpretation
 */
export class Pipeline<TContext extends BaseContext = BaseContext> {
  private readonly config: Required<Pick<PipelineConfig<TContext>, 'registry' | 'router' | 'interpreter'>> &
    Partial<PipelineConfig<TContext>>;

  constructor(config: PipelineConfig<TContext>) {
    this.config = {
      registry: config.registry,
      router: config.router,
      interpreter: config.interpreter,
      validator: config.validator,
      retriever: config.retriever,
      executor: config.executor,
      memory: config.memory,
      telemetry: config.telemetry,
      maxCandidates: config.maxCandidates ?? 12,
      maxActions: config.maxActions ?? 5,
      confidenceThreshold: config.confidenceThreshold ?? 0.7,
      repairMaxRetries: config.repairMaxRetries ?? 2,
      enableAutoRepair: config.enableAutoRepair ?? true,
    };
  }

  /**
   * Interpret natural language input into an action plan
   */
  async interpret(
    input: string,
    context: TContext,
    conversationId?: string
  ): Promise<PipelineResult<TContext>> {
    const startTime = Date.now();
    const trace: TraceEvent[] = [];
    const span = this.config.telemetry?.startSpan('pipeline.interpret');

    try {
      const cid = conversationId ?? this.generateId('conv');

      // 1. NORMALIZE
      this.recordEvent(span, trace, { stage: 'normalize', status: 'start' });
      const normalized = this.normalize(input, context, cid);
      this.recordEvent(span, trace, { stage: 'normalize', status: 'complete' });

      // 2. ROUTE
      this.recordEvent(span, trace, { stage: 'route', status: 'start' });
      const routeResult = await this.config.router.route(normalized.normalized, context, this.config.registry);
      const candidates = routeResult.candidates
        .slice(0, this.config.maxCandidates)
        .map((c) => this.config.registry.get(c.actionId)!)
        .filter(Boolean);
      this.recordEvent(span, trace, {
        stage: 'route',
        status: 'complete',
        data: { candidates: candidates.length },
      });

      // 3. INTERPRET
      this.recordEvent(span, trace, { stage: 'interpret', status: 'start' });
      const interpretResult = await this.config.interpreter.interpret({
        input: normalized.normalized,
        context,
        actions: await prepareActionsForLLM(candidates, context),
        conversationHistory: this.getConversationHistory(cid),
        maxActions: this.config.maxActions,
      });
      this.recordEvent(span, trace, {
        stage: 'interpret',
        status: 'complete',
        data: {
          calls: interpretResult.calls.length,
          tokens: interpretResult.usage,
        },
      });

      // Handle clarification
      if (interpretResult.clarification) {
        const plan = this.createPlan(cid, normalized, [], interpretResult.clarification);
        this.updateMemory(cid, input, plan);
        return this.createResult(plan, undefined, trace, startTime);
      }

      // Assign IDs to calls
      const callsWithIds = this.assignCallIds(interpretResult.calls);

      // 4. VALIDATE
      if (this.config.validator) {
        this.recordEvent(span, trace, { stage: 'validate', status: 'start' });
        const validPlan = await this.validateWithRepair(
          this.createPlan(cid, normalized, callsWithIds),
          context,
          trace,
          span
        );
        this.recordEvent(span, trace, { stage: 'validate', status: 'complete' });

        // Update memory
        this.updateMemory(cid, input, validPlan);

        this.config.telemetry?.endSpan(span, 'success');
        return this.createResult(validPlan, undefined, trace, startTime);
      }

      // No validator - just return the plan
      const plan = this.createPlan(cid, normalized, callsWithIds);
      this.updateMemory(cid, input, plan);

      this.config.telemetry?.endSpan(span, 'success');
      return this.createResult(plan, undefined, trace, startTime);
    } catch (error) {
      this.recordEvent(span, trace, {
        stage: 'error',
        status: 'failed',
        error: error as Error,
      });
      this.config.telemetry?.endSpan(span, 'error', error as Error);
      throw error;
    }
  }

  /**
   * Normalize input text
   */
  private normalize(input: string, context: TContext, conversationId: string): NormalizedInput<TContext> {
    return {
      raw: input,
      normalized: input.trim().replace(/\s+/g, ' '),
      context,
      conversationId,
      turnNumber: (this.config.memory?.getState(conversationId)?.turnCount ?? 0) + 1,
    };
  }

  /**
   * Validate plan and attempt repair if needed
   */
  private async validateWithRepair(
    plan: Plan,
    context: TContext,
    trace: TraceEvent[],
    span: any
  ): Promise<Plan> {
    let currentPlan = plan;

    for (let attempt = 0; attempt < (this.config.repairMaxRetries ?? 2); attempt++) {
      const validation = await this.config.validator!.validate(currentPlan, context, this.config.registry);

      if (validation.valid) {
        return currentPlan;
      }

      if (!this.config.enableAutoRepair || attempt === (this.config.repairMaxRetries ?? 2) - 1) {
        return {
          ...currentPlan,
          calls: [],
          clarification: {
            question: this.buildClarificationFromErrors(validation.errors),
            actionIds: validation.errors.map((e: any) => e.actionId),
          },
        };
      }

      // Attempt repair
      this.recordEvent(span, trace, {
        stage: 'repair',
        status: 'start',
        data: { attempt: attempt + 1 },
      });

      currentPlan = await this.config.interpreter.repair(
        plan.input.normalized,
        context,
        currentPlan,
        validation.errors,
        await prepareActionsForLLM(
          currentPlan.calls.map((c) => this.config.registry.get(c.actionId)!).filter(Boolean),
          context
        )
      );

      this.recordEvent(span, trace, { stage: 'repair', status: 'complete' });
    }

    return currentPlan;
  }

  // Helper methods

  private assignCallIds(calls: Omit<ActionCall, 'callId'>[]): ActionCall[] {
    return calls.map((call) => ({ ...call, callId: this.generateId('call') }));
  }

  private createPlan(
    conversationId: string,
    input: NormalizedInput<TContext>,
    calls: ActionCall[],
    clarification?: any
  ): Plan {
    return {
      planId: this.generateId('plan'),
      input,
      calls,
      clarification,
      conversationId,
      turnNumber: input.turnNumber,
      confidence: calls.length > 0 ? calls.reduce((sum, c) => sum + c.confidence, 0) / calls.length : 0,
      createdAt: new Date(),
    };
  }

  private createResult(
    plan: Plan,
    execution: any,
    trace: TraceEvent[],
    startTime: number
  ): PipelineResult<TContext> {
    return {
      plan,
      execution,
      trace,
      duration: Date.now() - startTime,
    };
  }

  private getConversationHistory(conversationId: string): any[] {
    return this.config.memory?.getMessagesForLLM(conversationId) ?? [];
  }

  private updateMemory(conversationId: string, input: string, plan: Plan): void {
    if (!this.config.memory) return;

    this.config.memory.addMessage(conversationId, {
      role: 'user',
      content: input,
    });

    if (plan.clarification) {
      this.config.memory.addMessage(conversationId, {
        role: 'assistant',
        content: plan.clarification.question,
      });
    }
  }

  private recordEvent(span: any, trace: TraceEvent[], event: Omit<TraceEvent, 'timestamp'>): void {
    const fullEvent = { ...event, timestamp: Date.now() };
    trace.push(fullEvent);
    if (span) {
      this.config.telemetry?.recordEvent(span, event);
    }
  }

  private buildClarificationFromErrors(errors: any[]): string {
    const messages = errors.map((e: any) => `- ${e.actionId}: ${e.message}`);
    return `I need clarification on the following:\n${messages.join('\n')}`;
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}
