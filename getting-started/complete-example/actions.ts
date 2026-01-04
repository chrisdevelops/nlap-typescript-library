/**
 * Task Actions - Complete CRUD operations for task management
 */

import { z } from 'zod';
import { ActionRegistry } from '@nlap/core';
import type { BaseContext } from '@nlap/core';

// Types
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

export interface Database {
  tasks: {
    create(data: Partial<Task>): Promise<Task>;
    findById(id: string): Promise<Task | null>;
    findByUserId(userId: string): Promise<Task[]>;
    update(id: string, data: Partial<Task>): Promise<Task>;
    delete(id: string): Promise<boolean>;
  };
}

interface AppContext extends BaseContext {
  userId: string;
  db: Database;
}

// In-memory database implementation
export function createInMemoryDatabase(): Database {
  const tasks = new Map<string, Task>();

  function generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  return {
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
          .filter(task => task.userId === userId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      },

      async update(id: string, data: Partial<Task>): Promise<Task> {
        const task = tasks.get(id);
        if (!task) {
          throw new Error(`Task ${id} not found`);
        }

        const updated: Task = {
          ...task,
          ...data,
          id: task.id, // Prevent ID changes
          userId: task.userId, // Prevent userId changes
          createdAt: task.createdAt, // Prevent createdAt changes
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
}

// Register all task actions
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
        .describe('Optional due date in ISO 8601 format'),
    }),
    handler: async (args, ctx) => {
      const task = await ctx.appContext.db.tasks.create({
        title: args.title,
        description: args.description,
        dueDate: args.dueDate ? new Date(args.dueDate) : undefined,
        userId: ctx.appContext.userId,
      });

      console.log(`  ✓ Created task: ${task.title}`);

      return {
        id: task.id,
        title: task.title,
        status: task.status,
        dueDate: task.dueDate,
      };
    },
    tags: ['tasks', 'create'],
    examples: [
      {
        input: 'Create a task to review the budget',
        args: { title: 'Review the budget' },
      },
      {
        input: 'Add a task to call John tomorrow',
        args: {
          title: 'Call John',
          dueDate: '2026-01-05T14:00:00Z',
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

      console.log(`  ✓ Listed ${filtered.length} tasks`);

      return {
        tasks: filtered.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          dueDate: t.dueDate,
          description: t.description,
        })),
        count: filtered.length,
      };
    },
    tags: ['tasks', 'read', 'list'],
  });

  // UPDATE TASK
  registry.register({
    id: 'tasks.update',
    description: 'Update an existing task by ID or title. Can update title, description, status, or due date',
    argsSchema: z.object({
      taskId: z.string()
        .optional()
        .describe('Task ID if known'),
      taskTitle: z.string()
        .optional()
        .describe('Task title to search for if ID not known'),
      newTitle: z.string()
        .optional()
        .describe('New task title'),
      newDescription: z.string()
        .optional()
        .describe('New task description'),
      newStatus: z.enum(['todo', 'in-progress', 'done'])
        .optional()
        .describe('New task status'),
      newDueDate: z.string()
        .datetime()
        .optional()
        .describe('New due date in ISO 8601 format'),
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
          throw new Error(`No task found matching: ${args.taskTitle}`);
        }
        taskId = task.id;
      }

      if (!taskId) {
        throw new Error('Must provide either taskId or taskTitle');
      }

      const updates: Partial<Task> = {};
      if (args.newTitle) updates.title = args.newTitle;
      if (args.newDescription) updates.description = args.newDescription;
      if (args.newStatus) updates.status = args.newStatus;
      if (args.newDueDate) updates.dueDate = new Date(args.newDueDate);

      const updated = await ctx.appContext.db.tasks.update(taskId, updates);

      console.log(`  ✓ Updated task: ${updated.title}`);

      return {
        id: updated.id,
        title: updated.title,
        status: updated.status,
        dueDate: updated.dueDate,
        description: updated.description,
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
        .describe('Task title to search for if ID not known'),
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
          throw new Error(`No task found matching: ${args.taskTitle}`);
        }
        taskId = task.id;
      }

      if (!taskId) {
        throw new Error('Must provide either taskId or taskTitle');
      }

      await ctx.appContext.db.tasks.delete(taskId);

      console.log(`  ✓ Deleted task: ${taskId}`);

      return {
        deleted: true,
        taskId,
      };
    },
    tags: ['tasks', 'delete'],
    risk: 'medium',
  });

  // COMPLETE TASK (convenience action)
  registry.register({
    id: 'tasks.complete',
    description: 'Mark a task as done/completed',
    argsSchema: z.object({
      taskId: z.string()
        .optional()
        .describe('Task ID if known'),
      taskTitle: z.string()
        .optional()
        .describe('Task title to search for if ID not known'),
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
          throw new Error(`No task found matching: ${args.taskTitle}`);
        }
        taskId = task.id;
      }

      if (!taskId) {
        throw new Error('Must provide either taskId or taskTitle');
      }

      const updated = await ctx.appContext.db.tasks.update(taskId, {
        status: 'done',
      });

      console.log(`  ✓ Completed task: ${updated.title}`);

      return {
        id: updated.id,
        title: updated.title,
        status: updated.status,
      };
    },
    tags: ['tasks', 'update', 'complete'],
  });
}
