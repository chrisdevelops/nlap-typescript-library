# NLAP - Natural Language Action Parser

**Status**: Phase 3 Complete ✅
**Version**: 0.3.0

Transform natural language input into validated, executable action plans with full TypeScript support.

## Quick Start

### Installation

```bash
npm install @nlap/core @nlap/providers @nlap/routers zod
```

### Basic Usage

```typescript
import { z } from 'zod';
import { createNLAPEngine, ActionRegistry, Interpreter, DAGExecutor, ThreeTierMemory } from '@nlap/core';
import { ClaudeProvider } from '@nlap/providers';
import { HybridRouter, KeywordRouter, EmbeddingRouter } from '@nlap/routers';

// 1. Define your context
interface AppContext extends BaseContext {
  db: Database;
  userId: string;
}

// 2. Create registry and register actions with handlers
const registry = new ActionRegistry<AppContext>();

registry.register({
  id: 'tasks.create',
  description: 'Create a new task with a title and optional due date',
  argsSchema: z.object({
    title: z.string().describe('Task title'),
    dueDate: z.string().datetime().optional().describe('ISO 8601 due date'),
  }),
  handler: async (args, ctx) => {
    // Execute the action
    return await ctx.appContext.db.tasks.create(args);
  },
  tags: ['tasks', 'create'],
});

// 3. Create engine with execution and memory
const engine = createNLAPEngine({
  registry,
  router: new HybridRouter(
    new KeywordRouter(),
    new EmbeddingRouter()
  ),
  interpreter: new Interpreter(
    new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY! })
  ),
  executor: new DAGExecutor(registry), // Enable execution
  memory: new ThreeTierMemory(),        // Enable multi-turn conversations
});

// 4. Process natural language and execute
const result = await engine.interpret(
  "Create a task to review budget by Friday",
  { requestId: '123', db: myDb, userId: 'user_456' }
);

console.log(result.plan.calls);
// [{
//   actionId: 'tasks.create',
//   args: { title: 'Review budget', dueDate: '2025-01-03T17:00:00Z' }
// }]

console.log(result.execution);
// {
//   succeeded: 1,
//   failed: 0,
//   results: Map { 'call_...' => { result: { id: 'task_123', ... } } }
// }
```

## Architecture

NLAP uses a router-first architecture with the following pipeline stages:

| Stage | Purpose | Latency | Status |
|-------|---------|---------|--------|
| **Normalize** | Standardize input | <5ms | ✅ |
| **Route** | Select top ~12 action candidates | 50-200ms | ✅ |
| **Interpret** | Extract intents via LLM | 500-2000ms | ✅ |
| **Validate** | Check against Zod schemas | <50ms | ✅ |
| **Repair** | Auto-fix validation errors | 500-2000ms | ✅ |
| **Execute** | Run action handlers | Variable | ✅ |

**Total Latency**: 1-3s (simple), 3-8s (complex with repair)

## Core Features

### ✅ Implemented (Phase 1, 2 & 3)

- **Type-Safe Action Registry** - Register actions with full TypeScript inference
- **Circular Dependency Detection** - Validates action dependency graphs
- **Tag-Based Filtering** - Organize actions by tags
- **TF-IDF Routing** - Efficient keyword-based action selection (KeywordRouter)
- **Embedding Router** - Vector similarity routing using local embeddings
- **Hybrid Router** - Intelligent fallback between keyword and embedding routing
- **LLM Integration** - Claude (Anthropic) provider with tool calling
- **Zod Schema Validation** - Runtime type checking
- **Dynamic Schemas** - Context-aware validation (async schema factories)
- **Auto-Repair Loop** - Automatically fix validation errors
- **Clarification Requests** - Ask users for missing information
- **DAG Executor** - Topological sort with parallel execution
- **Retry Logic** - Configurable retry with exponential/linear backoff
- **Compensation/Rollback** - Transaction-like guarantees with compensation handlers
- **Multi-Turn Memory** - Three-tier conversation state management
- **Observability** - Trace events for debugging

### ⏳ Coming in Phase 4

- **RAG Retrieval** - Entity resolution for large catalogs
- **Additional Providers** - OpenAI, Gemini support
- **Performance Optimization** - Caching, streaming

## Packages

This is a monorepo with three packages:

- **`@nlap/core`** - Core engine (Registry, Pipeline, Validator, Interpreter)
- **`@nlap/providers`** - LLM provider adapters (Claude)
- **`@nlap/routers`** - Routing implementations (KeywordRouter)

## API Reference

### ActionRegistry

```typescript
const registry = new ActionRegistry<MyContext>();

// Register an action
registry.register({
  id: 'tasks.create',
  description: 'Create a task',
  argsSchema: z.object({ title: z.string() }),
  handler: async (args, ctx) => {
    // Execute action
    return { id: 'task_123', ...args };
  },
  tags: ['tasks'],
  priority: 50,
});

// Retrieve actions
const action = registry.get('tasks.create');
const allActions = registry.list();
const taskActions = registry.getByTag('tasks');
```

### Pipeline

```typescript
const engine = createNLAPEngine({
  registry,
  router: new KeywordRouter(),
  interpreter: new Interpreter(provider),
  validator: new Validator(), // optional
  maxCandidates: 12,
  maxActions: 5,
  repairMaxRetries: 2,
  enableAutoRepair: true,
});

const result = await engine.interpret(input, context);
// result = { plan, trace, duration }
```

### Validator

```typescript
const validator = new Validator<MyContext>();

const validation = await validator.validate(plan, context, registry);
// validation = { valid, errors, validatedCalls }
```

## Examples

### Dynamic Schemas

Validate against current application state:

```typescript
registry.register({
  id: 'projects.assign',
  description: 'Assign a task to a project',
  argsSchema: async (ctx) => {
    // Fetch valid project IDs for this tenant
    const validProjects = await ctx.db.projects.listIds(ctx.tenantId);

    return z.object({
      projectId: z.enum(validProjects), // Runtime validation!
      taskId: z.string(),
    });
  },
});
```

### Action Dependencies

```typescript
registry.register({
  id: 'characters.create',
  description: 'Create a character',
  argsSchema: z.object({ name: z.string() }),
});

registry.register({
  id: 'relationships.create',
  description: 'Create a relationship between characters',
  dependencies: ['characters.create'], // Must run after
  argsSchema: z.object({
    from: z.string(),
    to: z.string(),
    type: z.string(),
  }),
});
```

### Error Handling

```typescript
try {
  const result = await engine.interpret(input, context);

  if (result.plan.clarification) {
    // Ask user for clarification
    console.log(result.plan.clarification.question);
  } else {
    // Process plan
    console.log(result.plan.calls);
  }
} catch (error) {
  if (error instanceof ProviderError) {
    // Handle LLM API error
  }
}
```

## Development

### Build

```bash
npm run build          # Build all packages
npm run typecheck      # Check types
```

### Test

```bash
npm test              # Run tests
npm run test:coverage # With coverage
```

## Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| Latency (simple) | 1-3s | ✅ |
| Latency (complex) | 3-8s | ✅ |
| Accuracy | >95% | ⏳ Needs testing |
| Token usage | <2K/request | ✅ |

## Documentation

- [Architecture Specification](.docs/NLAP_Architecture_Complete.md)
- [Implementation Guide](.docs/NLAP_Implementation_Guide.md)
- [Project Instructions](CLAUDE.md)

## License

MIT

## Roadmap

**Phase 1: Core Foundation** ✅ COMPLETE
- Type system, Registry, Pipeline, Validator, Router, LLM integration

**Phase 2: Advanced Routing** ✅ COMPLETE
- EmbeddingRouter (vector similarity), HybridRouter (keyword + embedding fallback), Dynamic schemas

**Phase 3: Execution & Memory** ✅ COMPLETE
- DAGExecutor (topological sort, parallel execution), Retry & compensation, ThreeTierMemory (multi-turn conversations)

**Phase 4: Retrieval & Polish** (Weeks 7-8)
- RAG integration, Additional providers, Documentation

---

**Built with TypeScript, Zod, and Claude**
