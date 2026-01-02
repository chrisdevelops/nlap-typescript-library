# Basic Task Manager - Integration Example

A complete example showing how to integrate NLAP into a simple task management application.

## Overview

This example demonstrates:
- Setting up NLAP in an Express.js application
- Defining task-related actions
- Processing natural language input
- Executing actions against a database
- Handling errors and validation

## Project Structure

```
task-manager/
├── src/
│   ├── index.ts           # Express server
│   ├── nlap/
│   │   ├── setup.ts       # NLAP engine configuration
│   │   └── actions/
│   │       ├── tasks.ts   # Task actions
│   │       └── index.ts   # Export all actions
│   ├── database/
│   │   └── tasks.ts       # Database operations
│   └── types.ts           # TypeScript types
└── package.json
```

## Installation

```bash
npm install express @nlap/core @nlap/providers @nlap/routers zod
npm install -D @types/express @types/node typescript tsx
```

## Complete Implementation

### 1. Define Types (`src/types.ts`)

```typescript
import { BaseContext } from '@nlap/core';

// Database types
export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: Date;
  status: 'todo' | 'in-progress' | 'done';
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Application context (extends BaseContext)
export interface AppContext extends BaseContext {
  db: Database;
  userId: string;
}

// Database interface
export interface Database {
  tasks: {
    create(data: Partial<Task>): Promise<Task>;
    findById(id: string): Promise<Task | null>;
    findByUserId(userId: string): Promise<Task[]>;
    update(id: string, data: Partial<Task>): Promise<Task>;
    delete(id: string): Promise<boolean>;
  };
}
```

### 2. Mock Database (`src/database/tasks.ts`)

```typescript
import { Task, Database } from '../types';

// In-memory database for demo purposes
const tasks = new Map<string, Task>();

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export const database: Database = {
  tasks: {
    async create(data: Partial<Task>): Promise<Task> {
      const task: Task = {
        id: generateId(),
        title: data.title || 'Untitled',
        description: data.description,
        dueDate: data.dueDate,
        status: data.status || 'todo',
        userId: data.userId || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      tasks.set(task.id, task);
      return task;
    },

    async findById(id: string): Promise<Task | null> {
      return tasks.get(id) || null;
    },

    async findByUserId(userId: string): Promise<Task[]> {
      return Array.from(tasks.values())
        .filter(task => task.userId === userId);
    },

    async update(id: string, data: Partial<Task>): Promise<Task> {
      const task = tasks.get(id);
      if (!task) {
        throw new Error(`Task ${id} not found`);
      }

      const updated: Task = {
        ...task,
        ...data,
        updatedAt: new Date(),
      };

      tasks.set(id, updated);
      return updated;
    },

    async delete(id: string): Promise<boolean> {
      return tasks.delete(id);
    },
  },
};
```

### 3. Define Actions (`src/nlap/actions/tasks.ts`)

```typescript
import { ActionRegistry } from '@nlap/core';
import { z } from 'zod';
import { AppContext } from '../../types';

export function registerTaskActions(registry: ActionRegistry<AppContext>) {
  // CREATE TASK
  registry.register({
    id: 'tasks.create',
    description: 'Create a new task with a title, optional description, and optional due date',
    argsSchema: z.object({
      title: z.string()
        .min(1)
        .describe('Task title'),
      description: z.string()
        .optional()
        .describe('Optional task description'),
      dueDate: z.string()
        .datetime()
        .optional()
        .describe('Optional ISO 8601 due date'),
    }),
    handler: async (args, ctx) => {
      const task = await ctx.appContext.db.tasks.create({
        title: args.title,
        description: args.description,
        dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
        userId: ctx.appContext.userId,
      });

      return {
        id: task.id,
        title: task.title,
        status: task.status,
        createdAt: task.createdAt,
      };
    },
    tags: ['tasks', 'create'],
    examples: [
      {
        input: 'Create a task to review the budget',
        args: { title: 'Review the budget' },
      },
      {
        input: 'Add a task to call John tomorrow at 2pm',
        args: {
          title: 'Call John',
          dueDate: '2026-01-02T14:00:00Z',
        },
      },
    ],
  });

  // LIST TASKS
  registry.register({
    id: 'tasks.list',
    description: 'List all tasks for the current user, optionally filtered by status',
    argsSchema: z.object({
      status: z.enum(['todo', 'in-progress', 'done'])
        .optional()
        .describe('Optional status filter'),
    }),
    handler: async (args, ctx) => {
      const allTasks = await ctx.appContext.db.tasks.findByUserId(
        ctx.appContext.userId
      );

      const filtered = args.status
        ? allTasks.filter(t => t.status === args.status)
        : allTasks;

      return {
        tasks: filtered.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          dueDate: t.dueDate,
        })),
        count: filtered.length,
      };
    },
    tags: ['tasks', 'read', 'list'],
  });

  // UPDATE TASK
  registry.register({
    id: 'tasks.update',
    description: 'Update an existing task by ID or title',
    argsSchema: z.object({
      taskId: z.string()
        .optional()
        .describe('Task ID if known'),
      taskTitle: z.string()
        .optional()
        .describe('Task title to search for'),
      newTitle: z.string()
        .optional()
        .describe('New task title'),
      newStatus: z.enum(['todo', 'in-progress', 'done'])
        .optional()
        .describe('New task status'),
      newDueDate: z.string()
        .datetime()
        .optional()
        .describe('New due date'),
    }),
    handler: async (args, ctx) => {
      let taskId = args.taskId;

      // If no ID provided, search by title
      if (!taskId && args.taskTitle) {
        const tasks = await ctx.appContext.db.tasks.findByUserId(
          ctx.appContext.userId
        );
        const task = tasks.find(t =>
          t.title.toLowerCase().includes(args.taskTitle!.toLowerCase())
        );

        if (!task) {
          throw new Error(`No task found with title: ${args.taskTitle}`);
        }
        taskId = task.id;
      }

      if (!taskId) {
        throw new Error('Must provide either taskId or taskTitle');
      }

      const updated = await ctx.appContext.db.tasks.update(taskId, {
        title: args.newTitle,
        status: args.newStatus,
        dueDate: args.newDueDate ? new Date(args.newDueDate) : undefined,
      });

      return {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        dueDate: updated.dueDate,
      };
    },
    tags: ['tasks', 'update'],
  });

  // DELETE TASK
  registry.register({
    id: 'tasks.delete',
    description: 'Delete a task by ID or title',
    argsSchema: z.object({
      taskId: z.string()
        .optional()
        .describe('Task ID if known'),
      taskTitle: z.string()
        .optional()
        .describe('Task title to search for'),
    }),
    handler: async (args, ctx) => {
      let taskId = args.taskId;

      // If no ID provided, search by title
      if (!taskId && args.taskTitle) {
        const tasks = await ctx.appContext.db.tasks.findByUserId(
          ctx.appContext.userId
        );
        const task = tasks.find(t =>
          t.title.toLowerCase().includes(args.taskTitle!.toLowerCase())
        );

        if (!task) {
          throw new Error(`No task found with title: ${args.taskTitle}`);
        }
        taskId = task.id;
      }

      if (!taskId) {
        throw new Error('Must provide either taskId or taskTitle');
      }

      await ctx.appContext.db.tasks.delete(taskId);

      return {
        deleted: true,
        taskId,
      };
    },
    tags: ['tasks', 'delete'],
    risk: 'medium',
  });

  // MARK AS DONE
  registry.register({
    id: 'tasks.complete',
    description: 'Mark a task as done/completed',
    argsSchema: z.object({
      taskId: z.string()
        .optional()
        .describe('Task ID if known'),
      taskTitle: z.string()
        .optional()
        .describe('Task title to search for'),
    }),
    handler: async (args, ctx) => {
      let taskId = args.taskId;

      if (!taskId && args.taskTitle) {
        const tasks = await ctx.appContext.db.tasks.findByUserId(
          ctx.appContext.userId
        );
        const task = tasks.find(t =>
          t.title.toLowerCase().includes(args.taskTitle!.toLowerCase())
        );

        if (!task) {
          throw new Error(`No task found with title: ${args.taskTitle}`);
        }
        taskId = task.id;
      }

      if (!taskId) {
        throw new Error('Must provide either taskId or taskTitle');
      }

      const updated = await ctx.appContext.db.tasks.update(taskId, {
        status: 'done',
      });

      return {
        id: updated.id,
        title: updated.title,
        status: updated.status,
      };
    },
    tags: ['tasks', 'update', 'complete'],
  });
}
```

### 4. Export Actions (`src/nlap/actions/index.ts`)

```typescript
import { ActionRegistry } from '@nlap/core';
import { AppContext } from '../../types';
import { registerTaskActions } from './tasks';

export function registerAllActions(registry: ActionRegistry<AppContext>) {
  registerTaskActions(registry);
  // Add more action modules here as your app grows
  // registerUserActions(registry);
  // registerProjectActions(registry);
}
```

### 5. NLAP Setup (`src/nlap/setup.ts`)

```typescript
import {
  createNLAPEngine,
  ActionRegistry,
  DAGExecutor,
  ThreeTierMemory,
  Validator,
  Interpreter,
} from '@nlap/core';
import { ClaudeProvider } from '@nlap/providers';
import { HybridRouter, KeywordRouter, EmbeddingRouter } from '@nlap/routers';
import { AppContext } from '../types';
import { registerAllActions } from './actions';

export function createTaskManagerNLAP() {
  // 1. Create registry and register actions
  const registry = new ActionRegistry<AppContext>();
  registerAllActions(registry);

  // 2. Create router (hybrid for best performance)
  const router = new HybridRouter(
    new KeywordRouter(),
    new EmbeddingRouter()
  );

  // 3. Create interpreter with Claude
  const interpreter = new Interpreter(
    new ClaudeProvider({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })
  );

  // 4. Create executor for running actions
  const executor = new DAGExecutor(registry);

  // 5. Create memory for multi-turn conversations
  const memory = new ThreeTierMemory({
    workingMemoryTurns: 5,
  });

  // 6. Create validator
  const validator = new Validator<AppContext>();

  // 7. Create complete engine
  const engine = createNLAPEngine({
    registry,
    router,
    interpreter,
    validator,
    executor,
    memory,
    maxCandidates: 12,
    repairMaxRetries: 2,
    enableAutoRepair: true,
  });

  return { engine, memory };
}
```

### 6. Express Server (`src/index.ts`)

```typescript
import express from 'express';
import { createTaskManagerNLAP } from './nlap/setup';
import { database } from './database/tasks';

const app = express();
app.use(express.json());

// Initialize NLAP
const { engine, memory } = createTaskManagerNLAP();

// Process natural language endpoint
app.post('/api/nlap', async (req, res) => {
  try {
    const { input, userId, conversationId } = req.body;

    if (!input || !userId) {
      return res.status(400).json({
        error: 'Missing required fields: input, userId',
      });
    }

    // Generate conversation ID if not provided
    const convId = conversationId || `user_${userId}`;

    // Process with NLAP
    const result = await engine.interpret(
      input,
      {
        requestId: `req_${Date.now()}`,
        db: database,
        userId,
      },
      convId
    );

    // Handle clarification requests
    if (result.plan.clarification) {
      return res.json({
        type: 'clarification',
        question: result.plan.clarification.question,
        conversationId: convId,
      });
    }

    // Return execution results
    return res.json({
      type: 'success',
      plan: result.plan.calls.map(c => ({
        action: c.actionId,
        args: c.args,
      })),
      execution: {
        succeeded: result.execution?.succeeded || 0,
        failed: result.execution?.failed || 0,
      },
      results: Array.from(result.execution?.results.entries() || []).map(
        ([callId, { result, error }]) => ({
          callId,
          success: !error,
          data: result,
          error: error?.message,
        })
      ),
      conversationId: convId,
      duration: result.duration,
    });
  } catch (error) {
    console.error('NLAP Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Task Manager API running on port ${PORT}`);
});
```

## Usage Examples

### Create a Task

```bash
curl -X POST http://localhost:3000/api/nlap \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Create a task to review the budget by Friday",
    "userId": "user_123"
  }'
```

**Response:**
```json
{
  "type": "success",
  "plan": [{
    "action": "tasks.create",
    "args": {
      "title": "Review the budget",
      "dueDate": "2026-01-03T17:00:00Z"
    }
  }],
  "execution": { "succeeded": 1, "failed": 0 },
  "results": [{
    "callId": "call_123",
    "success": true,
    "data": {
      "id": "task_456",
      "title": "Review the budget",
      "status": "todo"
    }
  }]
}
```

### List Tasks

```bash
curl -X POST http://localhost:3000/api/nlap \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Show me all my todo tasks",
    "userId": "user_123"
  }'
```

### Update Task

```bash
curl -X POST http://localhost:3000/api/nlap \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Mark the budget review task as done",
    "userId": "user_123"
  }'
```

### Multi-Turn Conversation

```bash
# Turn 1
curl -X POST http://localhost:3000/api/nlap \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Create a task",
    "userId": "user_123",
    "conversationId": "conv_1"
  }'

# Response: { "type": "clarification", "question": "What should the task be?" }

# Turn 2
curl -X POST http://localhost:3000/api/nlap \
  -H "Content-Type: application/json" \
  -d '{
    "input": "Call the client tomorrow",
    "userId": "user_123",
    "conversationId": "conv_1"
  }'

# Response: Task created
```

## Key Takeaways

1. **Context Definition** - Extend `BaseContext` with your app-specific data
2. **Action Registration** - Group related actions in separate files
3. **Error Handling** - Actions throw errors for invalid states
4. **Multi-Turn Support** - Use conversation IDs to maintain context
5. **Database Integration** - Pass db through context to all handlers

## Next Steps

- Add authentication middleware
- Persist conversations to database
- Add more action types (projects, tags, etc.)
- Implement webhooks for async notifications
- Add action dependencies for complex workflows
