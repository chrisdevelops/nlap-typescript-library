# NLAP Documentation

Welcome to the Natural Language Action Parser (NLAP) documentation!

## 📚 Documentation Structure

### Package Documentation

Detailed API references for each package:

- **[Core Package](./packages/core/README.md)** - Core engine components
  - [ActionRegistry](./packages/core/ActionRegistry.md) - Action registration and management
  - [Pipeline](./packages/core/Pipeline.md) - Main orchestration pipeline
  - [DAGExecutor](./packages/core/DAGExecutor.md) - Action execution engine
  - [ThreeTierMemory](./packages/core/ThreeTierMemory.md) - Conversation memory
  - [Validator](./packages/core/Validator.md) - Schema validation
  - [Interpreter](./packages/core/Interpreter.md) - LLM integration layer
  - [Types](./packages/core/types.md) - TypeScript type definitions

- **[Providers Package](./packages/providers/README.md)** - LLM provider adapters
  - [ClaudeProvider](./packages/providers/ClaudeProvider.md) - Anthropic Claude integration

- **[Routers Package](./packages/routers/README.md)** - Action routing strategies
  - [KeywordRouter](./packages/routers/KeywordRouter.md) - TF-IDF keyword-based routing
  - [EmbeddingRouter](./packages/routers/EmbeddingRouter.md) - Vector similarity routing
  - [HybridRouter](./packages/routers/HybridRouter.md) - Intelligent fallback routing

### Integration Examples

Real-world application examples:

- **[Basic Task Manager](./examples/basic-task-manager/README.md)** - Simple CRUD operations with natural language
- **[E-Commerce Assistant](./examples/e-commerce-assistant/README.md)** - Product search, cart management, and checkout
- **[Worldbuilding Assistant](./examples/worldbuilding-assistant/README.md)** - Complex multi-action scenarios with dependencies

## 🚀 Quick Start

If you're new to NLAP, start here:

1. Read the [Core Package Overview](./packages/core/README.md)
2. Follow the [Basic Task Manager Example](./examples/basic-task-manager/README.md)
3. Explore individual component APIs as needed

## 📖 Key Concepts

### Pipeline Stages

NLAP processes natural language through these stages:

1. **Normalize** - Clean and standardize input
2. **Route** - Select relevant action candidates (~12)
3. **Interpret** - Extract structured intents via LLM
4. **Validate** - Check arguments against Zod schemas
5. **Repair** - Auto-fix validation errors (optional)
6. **Execute** - Run action handlers (optional)

### Core Components

- **ActionRegistry** - Central registry for all available actions
- **Router** - Selects relevant actions for a given input
- **Interpreter** - Uses LLM to extract structured data
- **Validator** - Validates extracted data against schemas
- **Executor** - Executes actions with dependency ordering
- **Memory** - Maintains conversation state across turns

## 💡 Common Patterns

### Defining Actions

```typescript
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
  tags: ['tasks', 'create'],
});
```

### Creating the Engine

```typescript
const engine = createNLAPEngine({
  registry,
  router: new HybridRouter(new KeywordRouter(), new EmbeddingRouter()),
  interpreter: new Interpreter(new ClaudeProvider({ apiKey: '...' })),
  executor: new DAGExecutor(registry),
  memory: new ThreeTierMemory(),
});
```

### Processing Input

```typescript
const result = await engine.interpret(
  "Create a task to review budget by Friday",
  { requestId: '123', db: myDb, userId: 'user_456' }
);

console.log(result.plan.calls);      // Planned actions
console.log(result.execution);        // Execution results
console.log(result.trace);            // Performance trace
```

## 🔗 External Resources

- [GitHub Repository](https://github.com/yourusername/nlap)
- [NPM Packages](https://www.npmjs.com/org/nlap)
- [Architecture Specification](../.docs/NLAP_Architecture_Complete.md)
- [Implementation Guide](../.docs/NLAP_Implementation_Guide.md)
