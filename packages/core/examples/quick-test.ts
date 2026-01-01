/**
 * Quick smoke test for NLAP library
 *
 * Usage:
 *   export ANTHROPIC_API_KEY=your_key_here
 *   npx tsx examples/quick-test.ts
 */

import { z } from 'zod';
import { createNLAPEngine, ActionRegistry } from '@nlap/core';
import { ClaudeProvider } from '@nlap/providers';
import { KeywordRouter } from '@nlap/routers';
import { Validator } from '@nlap/core';
import { Interpreter } from '@nlap/core';
import type { BaseContext } from '@nlap/core';

interface AppContext extends BaseContext {
  userId: string;
}

async function main() {
  console.log('🚀 NLAP Library Smoke Test\n');

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable not set');
    console.log('\nSet it with:');
    console.log('  export ANTHROPIC_API_KEY=your_key_here');
    process.exit(1);
  }

  // 1. Create registry
  console.log('1️⃣  Creating action registry...');
  const registry = new ActionRegistry<AppContext>();

  registry.register({
    id: 'tasks.create',
    description: 'Create a new task with a title and optional due date',
    argsSchema: z.object({
      title: z.string().describe('The task title'),
      dueDate: z.string().datetime().optional().describe('Due date in ISO 8601 format'),
    }),
    tags: ['tasks', 'create'],
    handler: async (args, ctx) => {
      console.log(`   ✓ Would create task: "${args.title}" for user ${ctx.appContext.userId}`);
      return { id: `task_${Date.now()}`, ...args };
    },
  });

  registry.register({
    id: 'tasks.list',
    description: 'List all tasks for the current user',
    argsSchema: z.object({
      status: z.enum(['pending', 'completed', 'all']).optional().describe('Filter by status'),
    }),
    tags: ['tasks', 'list'],
    handler: async (args, ctx) => {
      console.log(`   ✓ Would list ${args.status || 'all'} tasks for user ${ctx.appContext.userId}`);
      return { tasks: [] };
    },
  });

  console.log(`   ✓ Registered ${registry.list().length} actions\n`);

  // 2. Create engine
  console.log('2️⃣  Creating NLAP engine...');
  const engine = createNLAPEngine({
    registry,
    router: new KeywordRouter(),
    interpreter: new Interpreter(
      new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY })
    ),
    validator: new Validator(),
    maxCandidates: 12,
    maxActions: 5,
    repairMaxRetries: 2,
    enableAutoRepair: true,
  });
  console.log('   ✓ Engine created\n');

  // 3. Test cases
  const testCases = [
    'Create a task to review budget by end of week',
    'List all my pending tasks',
    'Create a task called "Buy groceries"',
  ];

  for (let i = 0; i < testCases.length; i++) {
    const input = testCases[i];
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test ${i + 1}/${testCases.length}: "${input}"`);
    console.log('='.repeat(60));

    try {
      const startTime = Date.now();
      const result = await engine.interpret(input, {
        requestId: `test_${i + 1}`,
        userId: 'user_demo',
      });
      const duration = Date.now() - startTime;

      console.log('\n✅ SUCCESS');
      console.log(`⏱️  Duration: ${duration}ms`);

      if (result.plan.clarification) {
        console.log('\n❓ Clarification needed:');
        console.log(`   ${result.plan.clarification.question}`);
      } else {
        console.log(`\n📋 Plan generated (confidence: ${(result.plan.confidence * 100).toFixed(1)}%):`);
        console.log(`   Calls: ${result.plan.calls.length}`);

        for (const call of result.plan.calls) {
          console.log(`\n   Action: ${call.actionId}`);
          console.log(`   Args: ${JSON.stringify(call.args, null, 2).split('\n').join('\n   ')}`);
          console.log(`   Confidence: ${(call.confidence * 100).toFixed(1)}%`);
        }
      }

      // Show pipeline trace
      console.log('\n📊 Pipeline stages:');
      const stages = result.trace.filter(t => t.status === 'complete');
      for (const stage of stages) {
        const stageData = stage.data ? ` (${JSON.stringify(stage.data)})` : '';
        console.log(`   ✓ ${stage.stage}${stageData}`);
      }

      // Performance validation
      console.log('\n⚡ Performance:');
      if (duration < 3000) {
        console.log(`   ✓ Within target (<3s for simple queries)`);
      } else if (duration < 8000) {
        console.log(`   ⚠️  Slower than target but acceptable (<8s for complex)`);
      } else {
        console.log(`   ❌ Exceeded latency budget (>8s)`);
      }

    } catch (error) {
      console.log('\n❌ ERROR');
      console.error(error);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 All tests completed!');
  console.log('='.repeat(60) + '\n');
}

main().catch(console.error);
