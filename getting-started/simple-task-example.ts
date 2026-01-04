/**
 * Simple Task Manager - NLAP Getting Started Example
 *
 * This example demonstrates:
 * - Creating an action registry
 * - Registering task management actions
 * - Processing natural language commands
 * - Executing actions with results
 *
 * Prerequisites:
 * 1. Install dependencies: npm install @nlap/core @nlap/providers @nlap/routers zod dotenv
 * 2. Set ANTHROPIC_API_KEY in .env file
 *
 * Run:
 *   npx tsx simple-task-example.ts
 */

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
  console.log('🚀 NLAP Simple Task Manager\n');

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Error: ANTHROPIC_API_KEY not set');
    console.log('\nCreate a .env file with:');
    console.log('  ANTHROPIC_API_KEY=your_key_here\n');
    process.exit(1);
  }

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

  console.log(`✓ Registered ${registry.list().length} actions\n`);

  // 4. Create engine with executor
  const engine = createNLAPEngine({
    registry,
    router: new KeywordRouter(),
    interpreter: new Interpreter(
      new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY! })
    ),
    executor: new DAGExecutor(registry),  // Enable execution!
  });

  console.log('✓ NLAP engine created\n');

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
  console.log('Processing Natural Language Commands');
  console.log('='.repeat(60));
  console.log('');

  for (let i = 0; i < commands.length; i++) {
    const command = commands[i];
    console.log(`[${i + 1}/${commands.length}] > ${command}`);
    console.log('-'.repeat(60));

    try {
      const result = await engine.interpret(command, context);

      // Show what was planned
      console.log(`📋 Planned ${result.plan.calls.length} action(s):`);
      for (const call of result.plan.calls) {
        console.log(`   - ${call.actionId}(${JSON.stringify(call.args)})`);
      }

      // Show execution results
      if (result.execution) {
        console.log(`⚡ Executed: ${result.execution.succeeded} succeeded, ${result.execution.failed} failed`);
      }

      console.log('');
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      console.log('');
    }
  }

  // Show final state
  console.log('='.repeat(60));
  console.log('Final Task List');
  console.log('='.repeat(60));

  if (tasks.length === 0) {
    console.log('No tasks created');
  } else {
    tasks.forEach((task, idx) => {
      const status = task.status === 'done' ? '✅' : '⭐';
      const due = task.dueDate ? ` (due: ${new Date(task.dueDate).toLocaleDateString()})` : '';
      console.log(`${idx + 1}. ${status} ${task.title}${due}`);
    });
  }

  console.log('');
  console.log('🎉 Demo completed successfully!');
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
