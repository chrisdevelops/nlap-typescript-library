# Testing Guide for NLAP Library

This guide explains how to test the NLAP library to confirm it's working correctly.

## Quick Start: Smoke Test

The fastest way to verify the library is working is to run the smoke test example:

### 1. Set up your API key

```bash
export ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### 2. Run the smoke test

```bash
npx tsx examples/quick-test.ts
```

**Expected output:**
```
🚀 NLAP Library Smoke Test

1️⃣  Creating action registry...
   ✓ Registered 2 actions

2️⃣  Creating NLAP engine...
   ✓ Engine created

============================================================
Test 1/3: "Create a task to review budget by end of week"
============================================================

✅ SUCCESS
⏱️  Duration: 1523ms

📋 Plan generated (confidence: 95.0%):
   Calls: 1

   Action: tasks.create
   Args: {
     "title": "Review budget",
     "dueDate": "2025-01-03T17:00:00Z"
   }
   Confidence: 95.0%

📊 Pipeline stages:
   ✓ normalize
   ✓ route ({"candidates":2})
   ✓ interpret ({"calls":1,"tokens":{"inputTokens":450,"outputTokens":85}})
   ✓ validate

⚡ Performance:
   ✓ Within target (<3s for simple queries)
```

### What Success Looks Like

✅ **All test cases complete** without errors
✅ **Duration < 3s** for simple queries
✅ **Correct actions** are selected (tasks.create, tasks.list)
✅ **Arguments are extracted** accurately from natural language
✅ **All pipeline stages** complete successfully

## Unit Tests

Run the unit test suite to verify individual components:

```bash
npm test
```

This runs tests for:
- ✅ ActionRegistry (registration, dependencies, tags)
- ✅ Validator (schema validation)
- ✅ Error classes
- ⏳ More tests coming in Phase 2

### Run tests in watch mode

```bash
npm run test:watch
```

### Generate coverage report

```bash
npm run test:coverage
```

Target: >80% code coverage

## Manual Component Testing

### Test 1: ActionRegistry

```typescript
import { ActionRegistry } from '@nlap/core';
import { z } from 'zod';

const registry = new ActionRegistry();

// Register an action
registry.register({
  id: 'test.action',
  description: 'Test action',
  argsSchema: z.object({ name: z.string() }),
});

// Retrieve it
const action = registry.get('test.action');
console.log(action); // Should show action definition

// Test circular dependency detection
try {
  registry.register({
    id: 'a',
    description: 'A',
    argsSchema: z.object({}),
    dependencies: ['b'],
  });

  registry.register({
    id: 'b',
    description: 'B',
    argsSchema: z.object({}),
    dependencies: ['a'], // Circular!
  });
} catch (error) {
  console.log('✅ Circular dependency detected:', error.message);
}
```

**Expected:** CircularDependencyError thrown

### Test 2: Validator

```typescript
import { Validator, ActionRegistry } from '@nlap/core';
import { z } from 'zod';

const registry = new ActionRegistry();
registry.register({
  id: 'tasks.create',
  description: 'Create task',
  argsSchema: z.object({
    title: z.string(),
    priority: z.enum(['low', 'medium', 'high']),
  }),
});

const validator = new Validator();

// Valid plan
const validPlan = {
  planId: 'plan_1',
  input: { raw: 'test', normalized: 'test', context: { requestId: '1' }, conversationId: 'c1', turnNumber: 1 },
  calls: [{
    callId: 'call_1',
    actionId: 'tasks.create',
    args: { title: 'Test', priority: 'high' },
    confidence: 0.95,
  }],
  confidence: 0.95,
  conversationId: 'c1',
  turnNumber: 1,
  createdAt: new Date(),
};

const result = await validator.validate(validPlan, { requestId: '1' }, registry);
console.log('Valid:', result.valid); // true

// Invalid plan
const invalidPlan = {
  ...validPlan,
  calls: [{
    callId: 'call_2',
    actionId: 'tasks.create',
    args: { title: 'Test', priority: 'urgent' }, // Invalid enum value
    confidence: 0.95,
  }],
};

const invalidResult = await validator.validate(invalidPlan, { requestId: '1' }, registry);
console.log('Valid:', invalidResult.valid); // false
console.log('Errors:', invalidResult.errors);
```

**Expected:** First validation passes, second fails with detailed Zod errors

### Test 3: KeywordRouter

```typescript
import { KeywordRouter } from '@nlap/routers';
import { ActionRegistry } from '@nlap/core';
import { z } from 'zod';

const registry = new ActionRegistry();

registry.register({
  id: 'tasks.create',
  description: 'Create a new task',
  argsSchema: z.object({}),
  tags: ['tasks', 'create'],
});

registry.register({
  id: 'tasks.list',
  description: 'List all tasks',
  argsSchema: z.object({}),
  tags: ['tasks', 'list'],
});

registry.register({
  id: 'users.create',
  description: 'Create a new user',
  argsSchema: z.object({}),
  tags: ['users', 'create'],
});

const router = new KeywordRouter();

// Test routing
const result = await router.route('create a new task', {}, registry);

console.log('Candidates:', result.candidates);
// Should rank tasks.create highest
console.log('Top candidate:', result.candidates[0].actionId); // 'tasks.create'
console.log('Duration:', result.duration, 'ms'); // Should be < 200ms
```

**Expected:**
- `tasks.create` ranked first
- Duration < 200ms for small registry

### Test 4: End-to-End Pipeline

See `examples/quick-test.ts` for a complete example.

## Testing Without API Key

If you don't have an Anthropic API key, you can still test most components:

### Unit tests (no API key needed)

```bash
npm test
```

### Test individual components

All components except the Interpreter can be tested without an API key:
- ✅ ActionRegistry
- ✅ Validator
- ✅ KeywordRouter
- ✅ Error classes
- ❌ Interpreter (needs LLM)
- ❌ Pipeline (needs LLM for interpret stage)

### Mock Provider for Testing

```typescript
import { LLMProvider, LLMMessage, LLMTool, LLMResponse } from '@nlap/providers';

class MockProvider implements LLMProvider {
  async generateWithTools(
    messages: LLMMessage[],
    tools: LLMTool[]
  ): Promise<LLMResponse> {
    // Return a predefined response
    return {
      toolCalls: [{
        id: '1',
        name: 'tasks.create',
        arguments: { title: 'Test task' },
      }],
      usage: { inputTokens: 100, outputTokens: 50 },
    };
  }
}

// Use in tests
const engine = createNLAPEngine({
  registry,
  router: new KeywordRouter(),
  interpreter: new Interpreter(new MockProvider()),
  validator: new Validator(),
});
```

## Performance Testing

Verify the library meets performance targets:

```typescript
const startTime = Date.now();
const result = await engine.interpret(input, context);
const duration = Date.now() - startTime;

console.log('Duration:', duration, 'ms');

// Check against targets
if (duration < 3000) {
  console.log('✅ Within target for simple queries (<3s)');
} else if (duration < 8000) {
  console.log('⚠️  Slower but acceptable for complex queries (<8s)');
} else {
  console.log('❌ Exceeds latency budget');
}

// Check pipeline stage breakdown
for (const event of result.trace) {
  if (event.status === 'complete') {
    console.log(`${event.stage}: ${event.duration || 'N/A'}ms`);
  }
}
```

**Expected timings:**
- Normalize: < 5ms
- Route: 50-200ms
- Interpret: 500-2000ms
- Validate: < 50ms
- Repair (if triggered): 500-2000ms
- **Total (simple)**: 1-3s
- **Total (complex with repair)**: 3-8s

## Troubleshooting

### "Cannot find module '@nlap/core'"

Build the packages first:
```bash
npm run build
```

### "ANTHROPIC_API_KEY environment variable not set"

Set your API key:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### Tests fail with import errors

Make sure you're using Node.js 18+:
```bash
node --version  # Should be >= 18.0.0
```

### Slow test performance

First run may be slow due to:
- TF-IDF index building (one-time cost)
- LLM cold start
- Network latency

Subsequent runs should be faster.

## What to Test Before Production

Before deploying NLAP to production, verify:

- [ ] **Registry validation** - Circular dependencies detected
- [ ] **Schema validation** - Invalid args rejected
- [ ] **Routing accuracy** - Correct actions selected (>95%)
- [ ] **Latency targets** - Within performance budgets
- [ ] **Error handling** - Graceful degradation on LLM failures
- [ ] **Clarifications** - User prompted when information missing
- [ ] **Repair loop** - Invalid plans auto-corrected
- [ ] **Memory safety** - No memory leaks under load

## Next Steps

Once basic testing is complete, consider:

1. **Write integration tests** for your specific use case
2. **Load testing** with realistic action catalogs (100+ actions)
3. **Accuracy testing** with diverse natural language inputs
4. **Edge case testing** (malformed input, API failures, etc.)

Phase 2 will include:
- Comprehensive integration test suite
- E2E tests with real LLM API
- Performance benchmarks
- Accuracy metrics collection
