# @nlap/core - Core Package

The core package contains the main engine components for NLAP.

## Installation

```bash
npm install @nlap/core zod
```

## Components

### Main Components

- **[ActionRegistry](./ActionRegistry.md)** - Register and manage actions
- **[Pipeline](./Pipeline.md)** - Main orchestration pipeline
- **[DAGExecutor](./DAGExecutor.md)** - Execute actions with dependencies
- **[ThreeTierMemory](./ThreeTierMemory.md)** - Conversation state management

### Supporting Components

- **[Validator](./Validator.md)** - Validate action arguments
- **[Interpreter](./Interpreter.md)** - LLM integration layer
- **[Types](./types.md)** - TypeScript type definitions

## Quick Start

```typescript
import { createNLAPEngine, ActionRegistry } from '@nlap/core';
import { z } from 'zod';

// 1. Create registry
const registry = new ActionRegistry();

// 2. Register actions
registry.register({
  id: 'greet',
  description: 'Greet a user',
  argsSchema: z.object({
    name: z.string(),
  }),
  handler: async (args) => {
    return { message: `Hello, ${args.name}!` };
  },
});

// 3. Create engine (with router and interpreter from other packages)
const engine = createNLAPEngine({
  registry,
  router: myRouter,
  interpreter: myInterpreter,
});

// 4. Process input
const result = await engine.interpret(
  "Say hello to Alice",
  { requestId: '1' }
);
```

## Key Concepts

### Action Definition

Actions are the building blocks of NLAP. Each action has:
- **ID** - Unique identifier
- **Description** - Natural language description for LLM
- **Schema** - Zod schema for input validation
- **Handler** - Optional async function to execute the action
- **Dependencies** - Optional list of action IDs that must run first

### Execution Context

When actions execute, they receive:
- **args** - Validated arguments from the LLM
- **ctx.appContext** - Your application context (database, user info, etc.)
- **ctx.previousResults** - Results from dependency actions
- **ctx.conversationId** - For multi-turn conversations
- **ctx.turnNumber** - Current turn in the conversation

### Pipeline Flow

```
Input String
    ↓
Normalize (clean input)
    ↓
Route (select ~12 relevant actions)
    ↓
Interpret (LLM extracts structured data)
    ↓
Validate (check against Zod schemas)
    ↓
Repair (auto-fix errors, optional)
    ↓
Execute (run handlers, optional)
    ↓
Result (plan + execution + trace)
```

## Factory Function

### `createNLAPEngine<TContext>(config)`

Creates a complete NLAP engine instance.

**Required Parameters:**
- `registry: ActionRegistry<TContext>` - Action registry
- `router: Router<TContext>` - Routing strategy
- `interpreter: Interpreter` - LLM interpreter

**Optional Parameters:**
- `validator?: Validator<TContext>` - Schema validator (recommended)
- `executor?: Executor<TContext>` - Action executor (for running handlers)
- `memory?: ConversationMemory<TContext>` - Conversation memory
- `telemetry?: Telemetry` - Observability hooks
- `maxCandidates?: number` - Max actions to route (default: 12)
- `maxActions?: number` - Max actions in plan (default: 5)
- `confidenceThreshold?: number` - Confidence threshold (default: 0.7)
- `repairMaxRetries?: number` - Max repair attempts (default: 2)
- `enableAutoRepair?: boolean` - Enable auto-repair (default: true)

**Returns:**
- `Pipeline<TContext>` instance with `interpret()` method

**Example:**
```typescript
const engine = createNLAPEngine({
  registry: new ActionRegistry(),
  router: new HybridRouter(
    new KeywordRouter(),
    new EmbeddingRouter()
  ),
  interpreter: new Interpreter(
    new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY })
  ),
  validator: new Validator(),
  executor: new DAGExecutor(registry),
  memory: new ThreeTierMemory(),
  maxCandidates: 12,
  repairMaxRetries: 2,
});
```

## Next Steps

- Learn about [ActionRegistry](./ActionRegistry.md) for registering actions
- Understand [Pipeline](./Pipeline.md) for advanced configuration
- Explore [DAGExecutor](./DAGExecutor.md) for action execution
- Set up [ThreeTierMemory](./ThreeTierMemory.md) for conversations
