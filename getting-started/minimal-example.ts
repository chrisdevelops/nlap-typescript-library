/**
 * Minimal NLAP Example - The simplest possible setup
 *
 * This is the absolute minimum code needed to use NLAP.
 * Perfect for understanding the core concepts.
 *
 * Prerequisites:
 * 1. npm install @nlap/core @nlap/providers @nlap/routers zod dotenv
 * 2. Create .env with: ANTHROPIC_API_KEY=your_key_here
 *
 * Run:
 *   npx tsx minimal-example.ts
 */

import 'dotenv/config';
import { z } from 'zod';
import { createNLAPEngine, ActionRegistry, Interpreter } from '@nlap/core';
import { ClaudeProvider } from '@nlap/providers';
import { KeywordRouter } from '@nlap/routers';
import type { BaseContext } from '@nlap/core';

// Your application context
interface AppContext extends BaseContext {
  userId: string;
}

async function main() {
  // 1. Create action registry
  const registry = new ActionRegistry<AppContext>();

  // 2. Register an action
  registry.register({
    id: 'greet',
    description: 'Greet a user by name',
    argsSchema: z.object({
      name: z.string().describe('Name of the person to greet'),
    }),
    handler: async (args) => {
      return { message: `Hello, ${args.name}!` };
    },
    tags: ['greeting'],
  });

  // 3. Create NLAP engine
  const engine = createNLAPEngine({
    registry,
    router: new KeywordRouter(),
    interpreter: new Interpreter(
      new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY! })
    ),
  });

  // 4. Process natural language
  const input = 'Say hello to Alice';
  console.log(`Input: "${input}"\n`);

  const result = await engine.interpret(input, {
    requestId: 'req_1',
    userId: 'user_123',
  });

  // 5. View results
  console.log('Planned Actions:');
  console.log(JSON.stringify(result.plan.calls, null, 2));
  console.log('\nDuration:', result.duration, 'ms');
}

main().catch(console.error);
