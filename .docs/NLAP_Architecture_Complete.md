# Natural Language Action Parser (NLAP)
# Complete Production Architecture v1.0

**Status**: Implementation-Ready  
**Target**: TypeScript Library  
**Updated**: December 31, 2024

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [Core Type System](#core-type-system)
4. [Implementation Guide](#implementation-guide)
5. [API Reference](#api-reference)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Roadmap](#deployment-roadmap)

---

## Quick Start

### Installation (Future)

\`\`\`bash
npm install @nlap/core @nlap/providers @nlap/routers
\`\`\`

### Basic Usage

\`\`\`typescript
import { z } from 'zod';
import { createNLAPEngine, ActionRegistry } from '@nlap/core';
import { ClaudeProvider } from '@nlap/providers';
import { HybridRouter } from '@nlap/routers';

// 1. Define your context
interface AppContext extends BaseContext {
  db: Database;
  userId: string;
}

// 2. Create registry and register actions
const registry = new ActionRegistry<AppContext>();

registry.register({
  id: 'tasks.create',
  description: 'Create a new task',
  argsSchema: z.object({
    title: z.string(),
    dueDate: z.string().datetime().optional(),
  }),
  handler: async (args, ctx) => {
    return await ctx.appContext.db.tasks.create(args);
  },
});

// 3. Create engine
const engine = createNLAPEngine({
  registry,
  router: new HybridRouter({ /* config */ }),
  interpreter: new Interpreter(
    new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY! })
  ),
});

// 4. Process natural language
const result = await engine.interpret(
  "Create a task to review budget by Friday",
  { requestId: '123', db: myDb, userId: 'user_456' }
);

console.log(result.plan.calls);
// [{
//   actionId: 'tasks.create',
//   args: { title: 'Review budget', dueDate: '2025-01-03T17:00:00Z' }
// }]
\`\`\`

---

## Architecture Overview

### Design Principles

1. **Router-First**: Never send all actions to LLM; route to top ~12 candidates
2. **Type Safety**: Zod schemas = single source of truth for types + validation
3. **Fail Safe**: Invalid → auto-repair → clarify (never execute wrong actions)
4. **Context-Aware**: App-defined context flows through entire pipeline
5. **Incremental**: Core is minimal; advanced features are optional plugins

### Pipeline Stages

| Stage | Purpose | Mandatory | Latency |
|-------|---------|-----------|---------|
| **Normalize** | Standardize input | ✅ | <5ms |
| **Route** | Select action candidates | ✅ | 50-200ms |
| **Interpret** | Extract intents via LLM | ✅ | 500-2000ms |
| **Resolve** | RAG for entity IDs | ⚠️ Optional | 100-500ms |
| **Validate** | Zod schema check | ✅ | <50ms |
| **Repair** | Auto-fix errors | ✅ | 500-2000ms |
| **Execute** | Run action handlers | ⚠️ Optional | Variable |

**Total Latency**: 1-3s (simple), 3-8s (complex with repair)

---

## Core Type System

### Foundation Types

\`\`\`typescript
// Base context all apps extend
export interface BaseContext {
  requestId: string;
  traceId?: string;
  tenantId?: string;
  userId?: string;
  locale?: string;
  timezone?: string;
  now?: Date;
}

// Action definition
export interface ActionDefinition<TName, TInput, TOutput, TContext> {
  id: TName;
  description: string;
  argsSchema: ZodType<TInput> | ((ctx: TContext) => ZodType<TInput>);
  handler?: (args: TInput, ctx: ExecutionContext<TContext>) => Promise<TOutput>;
  
  // Advanced features
  dependencies?: TName[];
  priority?: number;
  searchableFields?: SearchableFieldSpec[];
  compensate?: CompensationHandler<TInput, TOutput, TContext>;
  retry?: RetryConfig;
}

// Plan output
export interface Plan {
  planId: string;
  input: { raw: string; normalized: string };
  calls: ActionCall[];
  clarification?: ClarificationRequest;
  confidence: number;
}

// Action call
export interface ActionCall {
  callId: string;
  actionId: string;
  args: unknown;
  confidence: number;
  dependsOn?: string[];
}
\`\`\`

### Key Patterns

**Dynamic Schemas** (validates against current DB state):
\`\`\`typescript
argsSchema: async (ctx) => {
  const validIds = await ctx.db.projects.listIds(ctx.tenantId);
  return z.object({
    projectId: z.enum(validIds)
  });
}
\`\`\`

**Searchable Fields** (RAG for large catalogs):
\`\`\`typescript
searchableFields: [{
  argKey: 'contactId',
  queryKey: 'contactIdQuery',
  retriever: 'contacts'
}]
// User says "Sam the barber" → retriever finds ID → fills contactId
\`\`\`

**Dependencies** (execution order):
\`\`\`typescript
{
  id: 'relationships.create',
  dependencies: ['characters.create'], // Must run after
  handler: async (args, ctx) => {
    const charId = ctx.previousResults.get('characters.create').result.id;
    // ...
  }
}
\`\`\`

---

## Implementation Guide

### Phase 1: Core Foundation (Weeks 1-2)

**Goal**: Minimal working library

**Tasks**:
1. Implement type system (\`packages/core/src/types\`)
2. Build ActionRegistry with validation
3. Create Pipeline orchestrator (normalize → interpret → validate)
4. Implement Validator with Zod
5. Build KeywordRouter (TF-IDF)
6. Create ONE provider adapter (Claude OR OpenAI)
7. Write unit tests

**Team**: 3 developers, parallel work on registry/pipeline/router

### Phase 2: Advanced Routing (Weeks 3-4)

**Goal**: Production-grade routing

**Tasks**:
1. Implement EmbeddingRouter (vector similarity)
2. Build HybridRouter (keyword + embedding fallback)
3. Add validation repair loop
4. Support dynamic schema factories
5. Integration testing

### Phase 3: Execution & Memory (Weeks 5-6)

**Goal**: Complete execution pipeline

**Tasks**:
1. Build DAGExecutor (topological sort, parallel execution)
2. Add retry + compensation logic
3. Implement ThreeTierMemory (working/semantic/archival)
4. Add observability hooks
5. E2E testing

### Phase 4: Retrieval & Polish (Weeks 7-8)

**Goal**: Optional plugins + docs

**Tasks**:
1. Build retrieval adapters (embedding, fuzzy)
2. Add searchable fields resolution
3. Create additional provider adapters
4. Write comprehensive documentation
5. Build example applications

---

## API Reference

### Creating an Engine

\`\`\`typescript
const engine = createNLAPEngine<MyContext>({
  registry: ActionRegistry<MyContext>,
  router: Router<MyContext>,
  interpreter: Interpreter,
  
  // Optional
  validator?: Validator<MyContext>,
  retriever?: Retriever<MyContext>,
  executor?: Executor<MyContext>,
  memory?: ConversationMemory<MyContext>,
  telemetry?: Telemetry,
  
  // Configuration
  maxCandidates?: number,        // default: 12
  maxActions?: number,           // default: 5
  confidenceThreshold?: number,  // default: 0.7
  repairMaxRetries?: number,     // default: 2
});
\`\`\`

### Processing Input

\`\`\`typescript
const result = await engine.interpret(
  input: string,
  context: MyContext,
  conversationId?: string  // for multi-turn
);

// Result structure:
{
  plan: Plan,
  execution?: ExecutionResult,
  trace: TraceEvent[],
  duration: number
}
\`\`\`

### Action Registration

\`\`\`typescript
registry.register({
  id: 'unique.action.id',
  description: 'Human-readable for LLM',
  
  // Schema (static or dynamic)
  argsSchema: z.object({ /* ... */ }),
  // OR
  argsSchema: async (ctx) => z.object({ /* runtime schema */ }),
  
  // Handler
  handler: async (args, ctx) => {
    // args is typed from schema
    // ctx.appContext is your custom context
    // ctx.previousResults has dependency outputs
    return result;
  },
  
  // Optional features
  tags: ['category1', 'category2'],
  dependencies: ['other.action.id'],
  priority: 50,  // 0-100, higher = earlier
  searchableFields: [{ argKey, retriever }],
  compensate: async (args, result, ctx) => {
    // Rollback logic
  },
  retry: { maxAttempts: 3, backoff: 'exponential', delayMs: 1000 }
});
\`\`\`

---

## Testing Strategy

### Unit Tests

Test individual modules in isolation:

\`\`\`typescript
describe('ActionRegistry', () => {
  it('should detect circular dependencies', () => {
    const registry = new ActionRegistry();
    registry.register({ id: 'a', dependencies: ['b'], ... });
    expect(() => {
      registry.register({ id: 'b', dependencies: ['a'], ... });
    }).toThrow('Circular dependency');
  });
});
\`\`\`

### Integration Tests with Mocks

Test pipeline with mocked LLM:

\`\`\`typescript
class MockProvider implements LLMProvider {
  constructor(private responses: Map<string, LLMResponse>) {}
  
  async generateWithTools(messages, tools) {
    const lastMsg = messages[messages.length - 1].content;
    return this.responses.get(lastMsg) ?? defaultResponse;
  }
}

it('should execute complete pipeline', async () => {
  const mockProvider = new MockProvider(new Map([
    ['hello', { toolCalls: [{ name: 'greet', arguments: { name: 'Alice' } }] }]
  ]));
  
  const pipeline = new Pipeline({ /* with mock */ });
  const result = await pipeline.interpret('hello', context);
  
  expect(result.plan.calls[0].actionId).toBe('greet');
});
\`\`\`

### E2E Tests

Test with real LLM APIs (requires API keys):

\`\`\`typescript
it('should handle complex multi-action task', async () => {
  if (!process.env.ANTHROPIC_API_KEY) return; // Skip in CI
  
  const engine = createNLAPEngine({
    interpreter: new Interpreter(
      new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY })
    ),
    // ... real components
  });
  
  const result = await engine.interpret(
    "Create task 'Review budget' due Friday and remind me Thursday",
    context
  );
  
  expect(result.plan.calls).toHaveLength(2);
  expect(result.execution.succeeded).toBe(2);
});
\`\`\`

---

## Deployment Roadmap

### Milestone 1: MVP (Week 2)

**Deliverable**: Working library with core features

- Action registry + validation
- Basic pipeline (normalize → route → interpret → validate)
- Keyword router
- One provider adapter
- Unit tests

**Demo**: "Create a task" → validates + returns plan

### Milestone 2: Production-Ready Routing (Week 4)

**Deliverable**: Scalable routing for 100+ actions

- Embedding router
- Hybrid router with fallback
- Repair loop
- Dynamic schemas
- Integration tests

**Demo**: 100-action registry, natural language queries work reliably

### Milestone 3: Full Pipeline (Week 6)

**Deliverable**: Complete execution with memory

- DAG executor with dependencies
- Compensation/rollback
- Multi-turn conversation memory
- Observability
- E2E tests

**Demo**: Complex multi-action worldbuilding scenario

### Milestone 4: Polish & Launch (Week 8)

**Deliverable**: Production library

- Retrieval for large catalogs
- Multiple provider adapters
- Comprehensive docs
- Example apps
- Performance benchmarks

**Demo**: Complete task management app using NLAP

---

## Key Design Decisions

### Why Router-First?

**Problem**: Sending 100 action definitions to LLM:
- Costs ~10K tokens per request ($$$)
- Slows response time (more tokens = longer)
- Degrades accuracy (information overload)

**Solution**: Route to top 12 candidates:
- Costs ~1K tokens per request
- Faster responses
- Better accuracy (focused context)

### Why Dynamic Schemas?

**Problem**: Multi-tenant SaaS validation:
- Tenant A has projects [1, 2, 3]
- Tenant B has projects [4, 5]
- Static schema can't validate "projectId must be in tenant's projects"

**Solution**: Schema factories:
\`\`\`typescript
argsSchema: async (ctx) => {
  const validIds = await getProjectIds(ctx.tenantId);
  return z.object({ projectId: z.enum(validIds) });
}
\`\`\`

### Why Searchable Fields?

**Problem**: User says "assign to Sam" but you have:
- Sam Johnson (Engineer)
- Sam Chen (Designer)
- Sam Williams (Manager)

**Bad solutions**:
- Dump all 3 into prompt (doesn't scale to 1000 Sams)
- Force user to use IDs (terrible UX)
- Let LLM guess (unreliable)

**Solution**: RAG retrieval:
1. LLM outputs: `assigneeQuery: "Sam (Engineer)"`
2. Retriever searches: finds Sam Johnson
3. Fill `assigneeId: "emp_123"`

---

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| **Latency (simple)** | 1-3s | Single action, no repair |
| **Latency (complex)** | 3-8s | Multi-action + repair |
| **Throughput** | 10-50 req/s | With caching |
| **Accuracy** | >95% | Correct action selection |
| **Token usage** | <2K/request | With routing |

### Optimization Strategies

1. **Cache embeddings** (regenerate only on schema changes)
2. **Parallel execution** (route + embed concurrently)
3. **Batch retrieval** queries
4. **Stream responses** for real-time feedback
5. **Rate limit** LLM calls (circuit breaker)

---

## Common Patterns

### Pattern: Multi-Step Workflow

\`\`\`typescript
// Step 1: Create character
registry.register({
  id: 'char.create',
  argsSchema: z.object({ name: z.string() }),
  handler: async (args) => ({ id: generateId() })
});

// Step 2: Create relationship (depends on char.create)
registry.register({
  id: 'rel.create',
  dependencies: ['char.create'],
  handler: async (args, ctx) => {
    const charId = ctx.previousResults.get('char.create').result.id;
    // Use charId...
  }
});
\`\`\`

### Pattern: Compensation/Rollback

\`\`\`typescript
registry.register({
  id: 'payment.charge',
  compensatable: true,
  handler: async (args) => {
    const charge = await stripe.charges.create(args);
    return { chargeId: charge.id };
  },
  compensate: async (args, result) => {
    await stripe.refunds.create({ charge: result.chargeId });
  }
});
\`\`\`

### Pattern: Multi-Turn Clarification

\`\`\`typescript
const memory = new ThreeTierMemory();

// Turn 1
await engine.interpret("Schedule meeting", ctx, 'conv_123');
// → Clarification: "Who should attend?"

// Turn 2 (same conversationId)
await engine.interpret("Engineering team", ctx, 'conv_123');
// → Clarification: "When?"

// Turn 3
await engine.interpret("Tomorrow 2pm", ctx, 'conv_123');
// → Executes: calendar.create({ attendees: ['eng-team'], ... })
\`\`\`

---

## FAQ

**Q: How many actions can I register?**  
A: Tested up to 1000+. Router ensures LLM only sees ~12 at a time.

**Q: Can I use multiple LLM providers?**  
A: Yes! Implement the `LLMProvider` interface. Ships with Claude + OpenAI adapters.

**Q: How do I handle permissions?**  
A: Use `contextSchema` in action definition to validate user permissions.

**Q: Does this work with streaming?**  
A: Not yet. Planned for v2 (progressive action execution).

**Q: Can actions call other actions?**  
A: No - use `dependencies` to declare ordering. Executor handles it.

**Q: How do I test without API keys?**  
A: Use `MockLLMProvider` for unit/integration tests.

---

## Next Steps

1. **Review this architecture** with your team
2. **Set up monorepo** (\`packages/core\`, \`packages/providers\`, etc.)
3. **Start Phase 1** (2 weeks): Core foundation
4. **Iterate based on feedback**

This architecture is ready for immediate implementation. Each module has clear interfaces, types flow end-to-end, and the roadmap is realistic.

Questions? Need clarification on any section? Let me know!

