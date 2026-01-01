# NLAP - Natural Language Action Parser

**Status**: Phase 1 Complete ✅
**Version**: 0.1.0

Transform natural language input into validated, executable action plans with full TypeScript support.

## Quick Start

### Installation

```bash
npm install @nlap/core @nlap/providers @nlap/routers zod
```

### Basic Usage

```typescript
import { z } from 'zod';
import { createNLAPEngine, ActionRegistry } from '@nlap/core';
import { ClaudeProvider } from '@nlap/providers';
import { KeywordRouter } from '@nlap/routers';

// 1. Define your context
interface AppContext extends BaseContext {
  userId: string;
}

// 2. Create registry and register actions
const registry = new ActionRegistry<AppContext>();

registry.register({
  id: 'tasks.create',
  description: 'Create a new task with a title and optional due date',
  argsSchema: z.object({
    title: z.string().describe('Task title'),
    dueDate: z.string().datetime().optional().describe('ISO 8601 due date'),
  }),
  tags: ['tasks', 'create'],
});

// 3. Create engine
const engine = createNLAPEngine({
  registry,
  router: new KeywordRouter(),
  interpreter: new Interpreter(
    new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY! })
  ),
});

// 4. Process natural language
const result = await engine.interpret(
  "Create a task to review budget by Friday",
  { requestId: '123', userId: 'user_456' }
);

console.log(result.plan.calls);
// [{
//   actionId: 'tasks.create',
//   args: { title: 'Review budget', dueDate: '2025-01-03T17:00:00Z' }
// }]
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
| **Execute** | Run action handlers | Variable | ⏳ Phase 2 |

**Total Latency**: 1-3s (simple), 3-8s (complex with repair)

## Core Features

### ✅ Implemented (Phase 1)

- **Type-Safe Action Registry** - Register actions with full TypeScript inference
- **Circular Dependency Detection** - Validates action dependency graphs
- **Tag-Based Filtering** - Organize actions by tags
- **TF-IDF Routing** - Efficient keyword-based action selection
- **LLM Integration** - Claude (Anthropic) provider with tool calling
- **Zod Schema Validation** - Runtime type checking
- **Auto-Repair Loop** - Automatically fix validation errors
- **Clarification Requests** - Ask users for missing information
- **Observability** - Trace events for debugging

### ⏳ Coming in Phase 2

- **Embedding Router** - Vector similarity routing
- **Hybrid Router** - Combine keyword + embedding
- **Dynamic Schemas** - Context-aware validation
- **DAG Executor** - Dependency-ordered execution
- **Compensation/Rollback** - Transaction-like guarantees
- **Multi-Turn Memory** - Conversation state management
- **RAG Retrieval** - Entity resolution for large catalogs

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

**Phase 2: Advanced Routing** (Weeks 3-4)
- Embedding router, Hybrid router, Enhanced repair

**Phase 3: Execution & Memory** (Weeks 5-6)
- DAG executor, Compensation, Multi-turn conversations

**Phase 4: Retrieval & Polish** (Weeks 7-8)
- RAG integration, Additional providers, Documentation

---

**Built with TypeScript, Zod, and Claude**
