# NLAP - Natural Language Action Parser

**Version**: 1.0.0

Transform natural language into validated action plans with minimal setup.

## Features

- **Simple API** - One function to create the engine, one to define actions
- **Provider Agnostic** - Switch between OpenAI and Ollama with a config change
- **Type Safe** - Full TypeScript support with Zod schema validation
- **Conversation Memory** - Built-in multi-turn conversation support

## Installation

```bash
npm install nlap zod
```

## Quick Start

```typescript
import { nlap, defineAction } from 'nlap';
import { z } from 'zod';

// 1. Define your actions
const createTask = defineAction({
  name: 'createTask',
  description: 'Create a new task with a title and optional due date',
  args: z.object({
    title: z.string(),
    dueDate: z.string().datetime().optional(),
  }),
});

const listTasks = defineAction({
  name: 'listTasks',
  description: 'List all tasks',
  args: z.object({
    status: z.enum(['pending', 'completed', 'all']).optional(),
  }),
});

// 2. Create the engine
const engine = nlap({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  actions: [createTask, listTasks],
});

// 3. Interpret natural language
const plan = await engine.interpret('Create a task to review budget by Friday');

console.log(plan.calls);
// [{ action: 'createTask', args: { title: 'review budget', dueDate: '...' }, confidence: 0.95 }]
```

## Switching Providers

```typescript
// OpenAI
const engine = nlap({
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  actions: [createTask],
});

// Ollama (local)
const engine = nlap({
  provider: 'ollama',
  model: 'llama3.1:8b',
  actions: [createTask],
});
```

## Configuration

```typescript
const engine = nlap({
  // Required
  provider: 'openai' | 'ollama',
  actions: Action[],

  // Provider-specific
  apiKey?: string,        // Required for OpenAI
  baseURL?: string,       // For Ollama (default: http://localhost:11434)
  model?: string,         // Optional model override

  // Optional
  maxActions?: number,    // Max actions per interpretation (default: 5)
  memoryTurns?: number,   // Conversation history turns (default: 5)
});
```

## API Reference

### `defineAction<TArgs>(config)`

Define an action that can be registered with the engine.

```typescript
const myAction = defineAction({
  name: 'actionName',           // Alphanumeric with underscores
  description: 'What it does',  // For the LLM
  args: z.object({...}),        // Zod schema
  examples: [{                  // Optional few-shot examples
    input: 'example input',
    args: { ... }
  }],
});
```

**Action Name Rules:**
- Must start with a letter
- Can only contain letters, numbers, and underscores
- Examples: `createTask`, `list_users`, `sendEmail`

### `nlap(config)`

Create an NLAP engine.

```typescript
const engine = nlap({
  provider: 'openai',
  apiKey: 'sk-...',
  actions: [action1, action2],
});
```

### `engine.interpret(input, conversationId?)`

Interpret natural language into an action plan.

```typescript
const plan = await engine.interpret('Create a task called review budget');

// plan = {
//   input: 'Create a task called review budget',
//   calls: [{ action: 'createTask', args: { title: 'review budget' }, confidence: 0.95 }],
//   conversationId: 'conv_...',
//   clarification?: 'What is the due date?'  // If LLM needs more info
// }
```

### `engine.clearConversation(conversationId)`

Clear conversation memory for a given conversation.

```typescript
engine.clearConversation('conv_123');
```

## Types

```typescript
interface Action<TArgs> {
  name: string;
  description: string;
  args: ZodType<TArgs>;
  examples?: Array<{ input: string; args: TArgs }>;
}

interface ActionCall {
  action: string;
  args: unknown;
  confidence: number;
}

interface ActionPlan {
  input: string;
  calls: ActionCall[];
  conversationId: string;
  clarification?: string;
}
```

## Error Handling

```typescript
import { nlap, ConfigError, ValidationError, ProviderError } from 'nlap';

try {
  const plan = await engine.interpret(input);

  if (plan.clarification) {
    // LLM needs more information
    console.log(plan.clarification);
  } else {
    // Execute the plan
    for (const call of plan.calls) {
      await executeAction(call.action, call.args);
    }
  }
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid arguments:', error.message);
  } else if (error instanceof ProviderError) {
    console.error('LLM error:', error.message);
  } else if (error instanceof ConfigError) {
    console.error('Configuration error:', error.message);
  }
}
```

## Multi-turn Conversations

The engine automatically maintains conversation history:

```typescript
// First turn
const plan1 = await engine.interpret('Create a task', 'session_123');

// Second turn (has context from first)
const plan2 = await engine.interpret('Actually make it due tomorrow', 'session_123');

// Clear when done
engine.clearConversation('session_123');
```

## Development

```bash
npm run build         # Build TypeScript
npm test              # Run tests
npm run test:coverage # With coverage
npm run typecheck     # Check types
```

## License

MIT
