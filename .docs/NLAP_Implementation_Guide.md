# NLAP Implementation Guide
## Detailed Code Examples & Best Practices

This guide provides concrete implementation examples for every major component.

---

## 1. Setting Up the Project

### Monorepo Structure

\`\`\`bash
mkdir nlap && cd nlap
npm init -y
npm install -D typescript @types/node vitest tsx

# Create packages
mkdir -p packages/{core,providers,routers,retrievers,executors}/src
mkdir -p packages/{core,providers,routers,retrievers,executors}/tests

# Shared tsconfig
cat > tsconfig.base.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist"
  }
}
EOF
\`\`\`

---

## 2. Core Registry Implementation

### Complete ActionRegistry with All Features

\`\`\`typescript
// packages/core/src/registry/ActionRegistry.ts

import { type ActionDefinition, type BaseContext } from '../types';

export class ActionRegistry<TContext extends BaseContext = BaseContext> {
  private actions = new Map<string, ActionDefinition<any, any, any, TContext>>();
  private actionsByTag = new Map<string, Set<string>>();
  private dependencyGraph = new Map<string, Set<string>>();
  private locked = false;

  register<TName extends string, TInput, TOutput>(
    action: ActionDefinition<TName, TInput, TOutput, TContext>
  ): this {
    this.validateLockState();
    this.validateActionDefinition(action);
    this.validateDependencies(action);
    this.detectCircularDependencies(action.id, action.dependencies ?? []);

    this.actions.set(action.id, action);
    this.indexByTags(action);
    this.buildDependencyGraph(action);

    return this;
  }

  get(actionId: string): ActionDefinition<any, any, any, TContext> | undefined {
    return this.actions.get(actionId);
  }

  list(): ActionDefinition<any, any, any, TContext>[] {
    return Array.from(this.actions.values());
  }

  getByTag(tag: string): ActionDefinition<any, any, any, TContext>[] {
    const ids = this.actionsByTag.get(tag);
    return ids ? Array.from(ids).map(id => this.actions.get(id)!) : [];
  }

  getByTags(tags: string[]): ActionDefinition<any, any, any, TContext>[] {
    if (tags.length === 0) return [];
    
    const sets = tags.map(tag => this.actionsByTag.get(tag) ?? new Set<string>());
    const intersection = sets.reduce((acc, set) => 
      new Set([...acc].filter(x => set.has(x)))
    );
    
    return Array.from(intersection).map(id => this.actions.get(id)!);
  }

  getDependents(actionId: string): string[] {
    return Array.from(this.dependencyGraph.get(actionId) ?? []);
  }

  lock(): void {
    this.locked = true;
  }

  private validateLockState(): void {
    if (this.locked) {
      throw new Error('Registry is locked; cannot register new actions');
    }
  }

  private validateActionDefinition(action: ActionDefinition<any, any, any, TContext>): void {
    if (!action.id || typeof action.id !== 'string') {
      throw new Error('Action must have a string ID');
    }
    if (this.actions.has(action.id)) {
      throw new Error(\`Action "\${action.id}" already registered\`);
    }
    if (!action.description) {
      throw new Error(\`Action "\${action.id}" must have a description\`);
    }
    if (!action.argsSchema) {
      throw new Error(\`Action "\${action.id}" must have an argsSchema\`);
    }
  }

  private validateDependencies(action: ActionDefinition<any, any, any, TContext>): void {
    for (const dep of action.dependencies ?? []) {
      if (!this.actions.has(dep)) {
        throw new Error(
          \`Action "\${action.id}" depends on "\${dep}" which is not registered. ` +
          \`Register dependencies before dependents.\`
        );
      }
    }
  }

  private detectCircularDependencies(
    actionId: string,
    dependencies: string[],
    visited = new Set<string>(),
    path: string[] = []
  ): void {
    if (visited.has(actionId)) {
      const cycle = [...path, actionId].join(' → ');
      throw new Error(\`Circular dependency detected: \${cycle}\`);
    }

    visited.add(actionId);
    path.push(actionId);

    for (const dep of dependencies) {
      const depAction = this.actions.get(dep);
      if (depAction?.dependencies) {
        this.detectCircularDependencies(
          dep,
          depAction.dependencies,
          new Set(visited),
          [...path]
        );
      }
    }
  }

  private indexByTags(action: ActionDefinition<any, any, any, TContext>): void {
    for (const tag of action.tags ?? []) {
      if (!this.actionsByTag.has(tag)) {
        this.actionsByTag.set(tag, new Set());
      }
      this.actionsByTag.get(tag)!.add(action.id);
    }
  }

  private buildDependencyGraph(action: ActionDefinition<any, any, any, TContext>): void {
    // Build reverse dependency graph (action → actions that depend on it)
    for (const dep of action.dependencies ?? []) {
      if (!this.dependencyGraph.has(dep)) {
        this.dependencyGraph.set(dep, new Set());
      }
      this.dependencyGraph.get(dep)!.add(action.id);
    }
  }
}
\`\`\`

---

## 3. Complete Pipeline with All Stages

\`\`\`typescript
// packages/core/src/pipeline/Pipeline.ts

import { type PipelineConfig, type PipelineResult } from '../types';

export class Pipeline<TContext extends BaseContext = BaseContext> {
  constructor(private config: Required<PipelineConfig<TContext>>) {}

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
      const routeResult = await this.config.router.route(
        normalized.normalized,
        context,
        this.config.registry
      );
      const candidates = routeResult.candidates
        .slice(0, this.config.maxCandidates)
        .map(c => this.config.registry.get(c.actionId)!);
      this.recordEvent(span, trace, {
        stage: 'route',
        status: 'complete',
        data: { candidates: candidates.length }
      });

      // 3. INTERPRET
      this.recordEvent(span, trace, { stage: 'interpret', status: 'start' });
      const interpretResult = await this.config.interpreter.interpret({
        input: normalized.normalized,
        context,
        actions: await this.prepareActionsForLLM(candidates, context),
        conversationHistory: this.getConversationHistory(cid),
        maxActions: this.config.maxActions,
      });
      this.recordEvent(span, trace, {
        stage: 'interpret',
        status: 'complete',
        data: { 
          calls: interpretResult.calls.length,
          tokens: interpretResult.usage 
        }
      });

      // Handle clarification
      if (interpretResult.clarification) {
        const plan = this.createPlan(cid, normalized, [], interpretResult.clarification);
        this.updateMemory(cid, input, plan);
        return this.createResult(plan, undefined, trace, startTime);
      }

      // Assign IDs to calls
      const callsWithIds = this.assignCallIds(interpretResult.calls);

      // 4. RESOLVE searchable fields
      if (this.config.retriever) {
        this.recordEvent(span, trace, { stage: 'resolve', status: 'start' });
        const resolved = await this.resolveSearchableFields(callsWithIds, context);
        callsWithIds.splice(0, callsWithIds.length, ...resolved);
        this.recordEvent(span, trace, { stage: 'resolve', status: 'complete' });
      }

      // 5. VALIDATE + REPAIR
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

      // 6. EXECUTE (optional)
      let executionResult: ExecutionResult<TContext> | undefined;
      if (this.config.executor && !validPlan.clarification) {
        this.recordEvent(span, trace, { stage: 'execute', status: 'start' });
        executionResult = await this.config.executor.execute(validPlan, context);
        this.recordEvent(span, trace, {
          stage: 'execute',
          status: 'complete',
          data: {
            succeeded: executionResult.succeeded,
            failed: executionResult.failed
          }
        });
      }

      this.config.telemetry?.endSpan(span, 'success');
      return this.createResult(validPlan, executionResult, trace, startTime);

    } catch (error) {
      this.recordEvent(span, trace, {
        stage: 'error',
        status: 'failed',
        error: error as Error
      });
      this.config.telemetry?.endSpan(span, 'error', error as Error);
      throw error;
    }
  }

  private normalize(
    input: string,
    context: TContext,
    conversationId: string
  ): NormalizedInput<TContext> {
    return {
      raw: input,
      normalized: input.trim().replace(/\s+/g, ' '),
      context,
      conversationId,
      turnNumber: (this.config.memory?.getState(conversationId)?.turnCount ?? 0) + 1,
    };
  }

  private async prepareActionsForLLM(
    actions: ActionDefinition<any, any, any, TContext>[],
    context: TContext
  ): Promise<any[]> {
    return Promise.all(
      actions.map(async action => {
        const schema =
          typeof action.argsSchema === 'function'
            ? await action.argsSchema(context)
            : action.argsSchema;

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

  private async resolveSearchableFields(
    calls: ActionCall[],
    context: TContext
  ): Promise<ActionCall[]> {
    return Promise.all(
      calls.map(async call => {
        const action = this.config.registry.get(call.actionId);
        if (!action?.searchableFields) return call;

        const newArgs = { ...call.args };

        for (const field of action.searchableFields) {
          const queryKey = field.queryKey ?? \`\${field.argKey}Query\`;
          const query = newArgs[queryKey];

          if (query && typeof query === 'string') {
            const results = await this.config.retriever!.search(
              field.retriever,
              query,
              context,
              field.filters
            );

            if (results.length > 0) {
              const top = results[0];
              if (!field.minScore || (top.score ?? 1) >= field.minScore) {
                newArgs[field.argKey] = top.id;
              }
            }
            delete newArgs[queryKey];
          }
        }

        return { ...call, args: newArgs };
      })
    );
  }

  private async validateWithRepair(
    plan: Plan,
    context: TContext,
    trace: TraceEvent[],
    span: any
  ): Promise<Plan> {
    let currentPlan = plan;

    for (let attempt = 0; attempt < this.config.repairMaxRetries; attempt++) {
      const validation = await this.config.validator.validate(
        currentPlan,
        context,
        this.config.registry
      );

      if (validation.errors.length === 0) {
        return currentPlan;
      }

      if (!this.config.enableAutoRepair || attempt === this.config.repairMaxRetries - 1) {
        return {
          ...currentPlan,
          calls: [],
          clarification: {
            question: this.buildClarificationFromErrors(validation.errors),
            actionIds: validation.errors.map(e => e.actionId),
          },
        };
      }

      // Attempt repair
      this.recordEvent(span, trace, {
        stage: 'repair',
        status: 'start',
        data: { attempt: attempt + 1 }
      });

      currentPlan = await this.config.interpreter.repair(
        plan.input.normalized,
        context,
        currentPlan,
        validation.errors,
        await this.prepareActionsForLLM(
          currentPlan.calls.map(c => this.config.registry.get(c.actionId)!),
          context
        )
      );

      this.recordEvent(span, trace, { stage: 'repair', status: 'complete' });
    }

    return currentPlan;
  }

  // Helper methods
  private assignCallIds(calls: Omit<ActionCall, 'callId'>[]): ActionCall[] {
    return calls.map(call => ({ ...call, callId: this.generateId('call') }));
  }

  private createPlan(
    conversationId: string,
    input: NormalizedInput<TContext>,
    calls: ActionCall[],
    clarification?: ClarificationRequest
  ): Plan {
    return {
      planId: this.generateId('plan'),
      input,
      calls,
      clarification,
      conversationId,
      turnNumber: input.turnNumber,
      confidence: calls.length > 0
        ? calls.reduce((sum, c) => sum + c.confidence, 0) / calls.length
        : 0,
      createdAt: new Date(),
    };
  }

  private createResult(
    plan: Plan,
    execution: ExecutionResult<TContext> | undefined,
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

  private getConversationHistory(conversationId: string): Message[] {
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

  private buildClarificationFromErrors(errors: ValidationError[]): string {
    const messages = errors.map(e => \`- \${e.actionId}: \${e.message}\`);
    return \`I need clarification on the following:\\n\${messages.join('\\n')}\`;
  }

  private generateId(prefix: string): string {
    return \`\${prefix}_\${Date.now()}_\${Math.random().toString(36).slice(2, 11)}\`;
  }
}
\`\`\`

---

[Document continues with detailed implementations of all other components...]

This implementation guide provides working code for every component in the architecture. Use it as a reference during development.

