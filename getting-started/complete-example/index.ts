/**
 * Complete NLAP Example - Production-Ready Task Manager API
 *
 * This example shows a complete NLAP integration with:
 * - Express.js REST API
 * - Proper error handling
 * - Multi-turn conversations
 * - Database simulation
 * - Full CRUD operations
 *
 * Prerequisites:
 * 1. npm install (from complete-example directory)
 * 2. Create .env with ANTHROPIC_API_KEY
 *
 * Run:
 *   npx tsx index.ts
 *
 * Test:
 *   curl -X POST http://localhost:3000/api/nlap \
 *     -H "Content-Type: application/json" \
 *     -d '{"input": "Create a task to review budget", "userId": "user_123"}'
 */

import 'dotenv/config';
import express from 'express';
import { createNLAPEngine, ActionRegistry, DAGExecutor, ThreeTierMemory, Interpreter } from '@nlap/core';
import { ClaudeProvider } from '@nlap/providers';
import { HybridRouter, KeywordRouter, EmbeddingRouter } from '@nlap/routers';
import { registerTaskActions, Task, Database, createInMemoryDatabase } from './actions.js';
import type { BaseContext } from '@nlap/core';

// Application context
interface AppContext extends BaseContext {
  userId: string;
  db: Database;
}

// Initialize Express
const app = express();
app.use(express.json());

// Check API key
if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌ Error: ANTHROPIC_API_KEY not set in .env file');
  process.exit(1);
}

// Create database (in-memory for demo)
const db = createInMemoryDatabase();

// Set up NLAP
console.log('🚀 Initializing NLAP engine...');

const registry = new ActionRegistry<AppContext>();
registerTaskActions(registry);

const engine = createNLAPEngine({
  registry,
  router: new HybridRouter(
    new KeywordRouter(),
    new EmbeddingRouter()
  ),
  interpreter: new Interpreter(
    new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY! })
  ),
  executor: new DAGExecutor(registry),
  memory: new ThreeTierMemory({ workingMemoryTurns: 5 }),
  maxCandidates: 12,
  repairMaxRetries: 2,
  enableAutoRepair: true,
});

console.log('✓ NLAP engine ready');
console.log(`✓ Registered ${registry.list().length} actions\n`);

// API Routes

/**
 * POST /api/nlap
 * Process natural language input
 */
app.post('/api/nlap', async (req, res) => {
  try {
    const { input, userId, conversationId } = req.body;

    // Validate input
    if (!input || typeof input !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid "input" field',
      });
    }

    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid "userId" field',
      });
    }

    console.log(`\n📨 Request from ${userId}: "${input}"`);

    // Generate conversation ID if not provided
    const convId = conversationId || `user_${userId}_${Date.now()}`;

    // Process with NLAP
    const startTime = Date.now();
    const result = await engine.interpret(
      input,
      {
        requestId: `req_${Date.now()}`,
        userId,
        db,
      },
      convId
    );
    const duration = Date.now() - startTime;

    console.log(`✓ Processed in ${duration}ms`);

    // Handle clarification requests
    if (result.plan.clarification) {
      console.log(`❓ Clarification needed: ${result.plan.clarification.question}`);

      return res.json({
        type: 'clarification',
        question: result.plan.clarification.question,
        conversationId: convId,
        duration,
      });
    }

    // Return execution results
    const response = {
      type: 'success',
      plan: result.plan.calls.map(c => ({
        action: c.actionId,
        args: c.args,
        confidence: c.confidence,
      })),
      execution: result.execution ? {
        succeeded: result.execution.succeeded,
        failed: result.execution.failed,
        results: Array.from(result.execution.results.entries()).map(
          ([callId, { result: data, error }]) => ({
            callId,
            success: !error,
            data,
            error: error?.message,
          })
        ),
      } : null,
      conversationId: convId,
      duration,
    };

    console.log(`✓ Success: ${result.execution?.succeeded || 0} actions executed`);

    return res.json(response);

  } catch (error) {
    console.error('❌ Error:', error);

    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
      type: 'error',
    });
  }
});

/**
 * GET /api/tasks/:userId
 * Get all tasks for a user (for debugging)
 */
app.get('/api/tasks/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const tasks = await db.tasks.findByUserId(userId);

    return res.json({
      tasks,
      count: tasks.length,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

/**
 * GET /api/actions
 * List all available actions
 */
app.get('/api/actions', (req, res) => {
  const actions = registry.list().map(action => ({
    id: action.id,
    description: action.description,
    tags: action.tags,
    risk: action.risk,
  }));

  return res.json({
    actions,
    count: actions.length,
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'nlap-task-manager',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /
 * API documentation
 */
app.get('/', (req, res) => {
  res.json({
    name: 'NLAP Task Manager API',
    version: '1.0.0',
    endpoints: {
      'POST /api/nlap': 'Process natural language input',
      'GET /api/tasks/:userId': 'Get all tasks for a user',
      'GET /api/actions': 'List all available actions',
      'GET /health': 'Health check',
    },
    example: {
      request: {
        method: 'POST',
        url: '/api/nlap',
        body: {
          input: 'Create a task to review budget by Friday',
          userId: 'user_123',
        },
      },
    },
  });
});

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log(`🚀 NLAP Task Manager API running on port ${PORT}`);
  console.log('='.repeat(60));
  console.log('');
  console.log('Endpoints:');
  console.log(`  POST   http://localhost:${PORT}/api/nlap`);
  console.log(`  GET    http://localhost:${PORT}/api/actions`);
  console.log(`  GET    http://localhost:${PORT}/api/tasks/:userId`);
  console.log(`  GET    http://localhost:${PORT}/health`);
  console.log('');
  console.log('Try it:');
  console.log(`  curl -X POST http://localhost:${PORT}/api/nlap \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{"input": "Create a task to review budget", "userId": "user_123"}'`);
  console.log('');
});
