# Getting Started with NLAP

Welcome! This guide will take you from zero to submitting your first natural language request using the NLAP (Natural Language Action Parser) library.

By the end of this guide, you'll have a working project that can:
- Accept natural language input like "Create a task to review budget by Friday"
- Parse that input into structured actions
- Execute those actions and return results

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Quick Start (5 minutes)](#quick-start)
4. [Understanding the Code](#understanding-the-code)
5. [Running Your First Request](#running-your-first-request)
6. [Complete Working Example](#complete-working-example)
7. [Next Steps](#next-steps)

---

## Prerequisites

Before you begin, make sure you have:

- **Node.js 18+** installed ([Download here](https://nodejs.org/))
- **npm** or **yarn** package manager
- **Anthropic API Key** ([Get one here](https://console.anthropic.com/))
  - Sign up for an Anthropic account
  - Go to API Keys section
  - Generate a new API key

Verify your Node.js version:
```bash
node --version  # Should show v18.0.0 or higher
```

---

## Installation

### Step 1: Create a New Project

```bash
# Create a new directory
mkdir my-nlap-project
cd my-nlap-project

# Initialize a new Node.js project
npm init -y
```

### Step 2: Install NLAP Packages

Install the three core NLAP packages plus Zod (for validation):

```bash
npm install @nlap/core @nlap/providers @nlap/routers zod
```

### Step 3: Install TypeScript and Development Tools

```bash
npm install -D typescript tsx @types/node
```

### Step 4: Configure TypeScript

Create a `tsconfig.json` file:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

### Step 5: Set Up Your API Key

Create a `.env` file in your project root:

```bash
# .env
ANTHROPIC_API_KEY=your_api_key_here
```

**IMPORTANT**: Add `.env` to your `.gitignore`:

```bash
echo ".env" >> .gitignore
```

---

## Quick Start

Let's create the simplest possible NLAP example. This will get you up and running in 5 minutes.

### Create Your First NLAP Script

Create a file `src/index.ts`:

```typescript
import { z } from 'zod';
import { createNLAPEngine, ActionRegistry, Interpreter } from '@nlap/core';
import { ClaudeProvider } from '@nlap/providers';
import { KeywordRouter } from '@nlap/routers';
import type { BaseContext } from '@nlap/core';

// Define your application context
interface AppContext extends BaseContext {
  userId: string;
}

async function main() {
  // Step 1: Create an action registry
  const registry = new ActionRegistry<AppContext>();

  // Step 2: Register a simple action
  registry.register({
    id: 'greet',
    description: 'Greet a user by name',
    argsSchema: z.object({
      name: z.string().describe('Name of the person to greet'),
    }),
    handler: async (args, ctx) => {
      return { message: `Hello, ${args.name}!` };
    },
    tags: ['greeting'],
  });

  // Step 3: Create the NLAP engine
  const engine = createNLAPEngine({
    registry,
    router: new KeywordRouter(),
    interpreter: new Interpreter(
      new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY! })
    ),
  });

  // Step 4: Process natural language
  const input = 'Say hello to Alice';
  console.log(`Input: "${input}"\n`);

  const result = await engine.interpret(input, {
    requestId: 'req_1',
    userId: 'user_123',
  });

  // Step 5: Check the results
  console.log('Plan:', JSON.stringify(result.plan.calls, null, 2));
}

main().catch(console.error);
```

### Run Your First Example

```bash
# Load environment variables and run
ANTHROPIC_API_KEY=your_key_here npx tsx src/index.ts
```

Or if you have a `.env` file, install dotenv:

```bash
npm install dotenv
```

And update your script:

```typescript
import 'dotenv/config';  // Add this at the top
// ... rest of code
```

Then run:

```bash
npx tsx src/index.ts
```

**Expected Output:**

```
Input: "Say hello to Alice"

Plan: [
  {
    "actionId": "greet",
    "args": {
      "name": "Alice"
    },
    "confidence": 0.95
  }
]
```

🎉 **Congratulations!** You just submitted your first natural language request!

---

## Understanding the Code

Let's break down what's happening in the Quick Start example:

### 1. Action Registry

```typescript
const registry = new ActionRegistry<AppContext>();
```

The registry is where you define all the actions your application can perform. Think of it as a catalog of capabilities.

### 2. Registering Actions

```typescript
registry.register({
  id: 'greet',                    // Unique identifier
  description: 'Greet a user...',  // Helps the LLM understand when to use this
  argsSchema: z.object({...}),    // Validates the arguments
  handler: async (args, ctx) => { // The actual function to execute
    return { message: `Hello, ${args.name}!` };
  },
  tags: ['greeting'],             // For organizing/filtering actions
});
```

Each action has:
- **id**: Unique identifier (e.g., `greet`, `tasks.create`)
- **description**: Natural language description for the LLM
- **argsSchema**: Zod schema defining expected arguments
- **handler**: The actual function that executes
- **tags**: Optional labels for organization

### 3. The NLAP Engine

```typescript
const engine = createNLAPEngine({
  registry,      // What actions are available
  router,        // How to find relevant actions
  interpreter,   // How to understand natural language (LLM)
});
```

The engine orchestrates the entire pipeline:
1. **Router** finds relevant actions
2. **Interpreter** (LLM) extracts structured data
3. **Validator** checks the data
4. **Executor** (optional) runs the actions

### 4. Processing Input

```typescript
const result = await engine.interpret(input, context);
```

This is where the magic happens! The engine:
1. Takes natural language input
2. Routes to relevant actions
3. Extracts arguments using the LLM
4. Validates against your schemas
5. Returns a structured plan (or executes it)

---

## Running Your First Request

Now that we understand the basics, let's create a more realistic example with task management.

Copy the file from this guide: [`simple-task-example.ts`](./simple-task-example.ts)

Or create `src/simple-task-example.ts`:

```typescript
import 'dotenv/config';
import { z } from 'zod';
import { createNLAPEngine, ActionRegistry, Interpreter, DAGExecutor } from '@nlap/core';
import { ClaudeProvider } from '@nlap/providers';
import { KeywordRouter } from '@nlap/routers';
import type { BaseContext } from '@nlap/core';

// 1. Define your context
interface AppContext extends BaseContext {
  userId: string;
  tasks: Task[];  // In-memory storage
}

interface Task {
  id: string;
  title: string;
  dueDate?: string;
  status: 'todo' | 'done';
}

async function main() {
  // 2. Create registry
  const registry = new ActionRegistry<AppContext>();

  // 3. Register task actions
  registry.register({
    id: 'tasks.create',
    description: 'Create a new task with a title and optional due date',
    argsSchema: z.object({
      title: z.string().describe('Task title'),
      dueDate: z.string().datetime().optional().describe('Due date in ISO 8601 format'),
    }),
    handler: async (args, ctx) => {
      const task: Task = {
        id: `task_${Date.now()}`,
        title: args.title,
        dueDate: args.dueDate,
        status: 'todo',
      };

      ctx.appContext.tasks.push(task);
      console.log(`✓ Created task: ${task.title}`);

      return task;
    },
    tags: ['tasks', 'create'],
  });

  registry.register({
    id: 'tasks.list',
    description: 'List all tasks',
    argsSchema: z.object({}),
    handler: async (args, ctx) => {
      console.log(`✓ Listed ${ctx.appContext.tasks.length} tasks`);
      return { tasks: ctx.appContext.tasks };
    },
    tags: ['tasks', 'list'],
  });

  registry.register({
    id: 'tasks.complete',
    description: 'Mark a task as completed',
    argsSchema: z.object({
      taskTitle: z.string().describe('Title of the task to complete'),
    }),
    handler: async (args, ctx) => {
      const task = ctx.appContext.tasks.find(
        t => t.title.toLowerCase().includes(args.taskTitle.toLowerCase())
      );

      if (!task) {
        throw new Error(`Task not found: ${args.taskTitle}`);
      }

      task.status = 'done';
      console.log(`✓ Completed task: ${task.title}`);

      return task;
    },
    tags: ['tasks', 'complete'],
  });

  // 4. Create engine with executor
  const engine = createNLAPEngine({
    registry,
    router: new KeywordRouter(),
    interpreter: new Interpreter(
      new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY! })
    ),
    executor: new DAGExecutor(registry),  // Enable execution!
  });

  // 5. Application context with in-memory storage
  const tasks: Task[] = [];
  const context: AppContext = {
    requestId: 'req_1',
    userId: 'user_demo',
    tasks,
  };

  // 6. Test natural language commands
  const commands = [
    'Create a task to review the budget by Friday',
    'Create another task to call the client',
    'Show me all my tasks',
    'Mark the budget task as done',
  ];

  console.log('='.repeat(60));
  console.log('NLAP Task Manager Demo');
  console.log('='.repeat(60));
  console.log('');

  for (const command of commands) {
    console.log(`> ${command}`);
    console.log('-'.repeat(60));

    const result = await engine.interpret(command, context);

    // Show what was planned
    console.log(`Planned ${result.plan.calls.length} action(s):`);
    for (const call of result.plan.calls) {
      console.log(`  - ${call.actionId}(${JSON.stringify(call.args)})`);
    }

    // Show execution results
    if (result.execution) {
      console.log(`Executed: ${result.execution.succeeded} succeeded, ${result.execution.failed} failed`);
    }

    console.log('');
  }

  // Show final state
  console.log('='.repeat(60));
  console.log('Final Task List:');
  console.log('='.repeat(60));
  tasks.forEach(task => {
    const status = task.status === 'done' ? '✓' : '○';
    const due = task.dueDate ? ` (due: ${task.dueDate})` : '';
    console.log(`${status} ${task.title}${due}`);
  });
}

main().catch(console.error);
```

### Run it:

```bash
npx tsx src/simple-task-example.ts
```

### Expected Output:

```
============================================================
NLAP Task Manager Demo
============================================================

> Create a task to review the budget by Friday
------------------------------------------------------------
Planned 1 action(s):
  - tasks.create({"title":"Review the budget","dueDate":"2026-01-10T17:00:00Z"})
✓ Created task: Review the budget
Executed: 1 succeeded, 0 failed

> Create another task to call the client
------------------------------------------------------------
Planned 1 action(s):
  - tasks.create({"title":"Call the client"})
✓ Created task: Call the client
Executed: 1 succeeded, 0 failed

> Show me all my tasks
------------------------------------------------------------
Planned 1 action(s):
  - tasks.list({})
✓ Listed 2 tasks
Executed: 1 succeeded, 0 failed

> Mark the budget task as done
------------------------------------------------------------
Planned 1 action(s):
  - tasks.complete({"taskTitle":"budget"})
✓ Completed task: Review the budget
Executed: 1 succeeded, 0 failed

============================================================
Final Task List:
============================================================
✓ Review the budget (due: 2026-01-10T17:00:00Z)
○ Call the client
```

🎉 **You now have a fully working NLAP application!**

---

## Complete Working Example

For a production-ready example with:
- Express.js API server
- Database integration
- Error handling
- Multi-turn conversations
- Complete action suite

See the [`complete-example`](./complete-example) folder, or check out the [Basic Task Manager example](../docs/examples/basic-task-manager/README.md) in the docs.

---

## Next Steps

Now that you have NLAP working, here are some next steps:

### 1. Add More Actions

Expand your registry with domain-specific actions:

```typescript
// User management
registry.register({
  id: 'users.create',
  description: 'Create a new user account',
  // ...
});

// Email sending
registry.register({
  id: 'email.send',
  description: 'Send an email to a recipient',
  // ...
});
```

### 2. Use Advanced Routers

For better performance with many actions:

```typescript
import { HybridRouter, KeywordRouter, EmbeddingRouter } from '@nlap/routers';

const router = new HybridRouter(
  new KeywordRouter(),
  new EmbeddingRouter()  // Uses vector similarity
);
```

### 3. Add Multi-Turn Memory

Enable conversations that remember context:

```typescript
import { ThreeTierMemory } from '@nlap/core';

const engine = createNLAPEngine({
  // ... other options
  memory: new ThreeTierMemory({
    workingMemoryTurns: 5,  // Remember last 5 turns
  }),
});

// Use conversation IDs
await engine.interpret(input, context, 'conversation_123');
```

### 4. Try Other Providers

NLAP supports multiple LLM providers:

```typescript
// OpenAI
import { OpenAIProvider } from '@nlap/providers';
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4',
});

// Ollama (local)
import { OllamaProvider } from '@nlap/providers';
const provider = new OllamaProvider({
  baseURL: 'http://127.0.0.1:11434',
  model: 'llama3.1:8b',
});
```

### 5. Add Dynamic Schemas

Validate against runtime state:

```typescript
registry.register({
  id: 'projects.assign',
  description: 'Assign a task to a project',
  argsSchema: async (ctx) => {
    // Fetch valid project IDs at runtime
    const validProjects = await getProjectIds(ctx.userId);

    return z.object({
      projectId: z.enum(validProjects),  // Runtime validation!
      taskId: z.string(),
    });
  },
  // ...
});
```

### 6. Implement Action Dependencies

Create workflows where actions depend on each other:

```typescript
registry.register({
  id: 'order.create',
  description: 'Create a new order',
  // ...
});

registry.register({
  id: 'payment.process',
  description: 'Process payment for an order',
  dependencies: ['order.create'],  // Must run after order.create
  // ...
});
```

### 7. Add Observability

Track and debug your NLAP pipeline:

```typescript
const result = await engine.interpret(input, context);

// Inspect the trace
for (const event of result.trace) {
  console.log(`${event.stage}: ${event.status}`, event.data);
}
```

---

## Common Issues

### "API Key Not Set" Error

Make sure your `.env` file is loaded:

```typescript
import 'dotenv/config';  // Add this at the top of your file
```

### Import Errors

If you see module resolution errors, check your `tsconfig.json` has:

```json
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true
  }
}
```

### Slow Performance

If responses are slow:
1. Use `HybridRouter` instead of `KeywordRouter`
2. Reduce `maxCandidates` (default: 12)
3. Cache router results
4. Consider using a faster LLM provider

---

## Resources

- **Documentation**: [Main README](../README.md)
- **Architecture**: [Architecture Guide](../docs/NLAP_Architecture_Complete.md)
- **Examples**: [Examples Folder](../docs/examples/)
- **API Reference**: Coming soon
- **GitHub Issues**: [Report bugs](https://github.com/yourusername/nlap-typescript-library/issues)

---

## Summary

You've learned how to:

✅ Install and configure NLAP
✅ Create an action registry
✅ Register actions with schemas
✅ Set up the NLAP engine
✅ Process natural language input
✅ Execute actions and get results

You're now ready to build natural language interfaces for your applications!

**Happy building!** 🚀
