# NLAP Quick Start Guide

## ✅ Verify Installation

The library is already built and ready to use. Run the tests to confirm:

```bash
npm test
```

Expected output:
```
✓ tests/registry.test.ts  (10 tests) 4ms

Test Files  1 passed (1)
     Tests  10 passed (10)
```

## 🚀 Run the Smoke Test

1. **Set your Anthropic API key:**

   ```bash
   export ANTHROPIC_API_KEY=sk-ant-your-key-here
   ```

2. **Run the smoke test:**

   ```bash
   npx tsx examples/quick-test.ts
   ```

3. **Expected output:**

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

## 📝 Create Your First Action

```typescript
import { z } from 'zod';
import { createNLAPEngine, ActionRegistry, Validator, Interpreter } from '@nlap/core';
import { ClaudeProvider } from '@nlap/providers';
import { KeywordRouter } from '@nlap/routers';

// 1. Create registry
const registry = new ActionRegistry();

// 2. Register your action
registry.register({
  id: 'greet',
  description: 'Greet someone by name',
  argsSchema: z.object({
    name: z.string().describe('Person to greet'),
    formal: z.boolean().optional().describe('Use formal greeting'),
  }),
  handler: async (args) => {
    const greeting = args.formal ? 'Good day' : 'Hey';
    return { message: `${greeting}, ${args.name}!` };
  },
});

// 3. Create engine
const engine = createNLAPEngine({
  registry,
  router: new KeywordRouter(),
  interpreter: new Interpreter(
    new ClaudeProvider({ apiKey: process.env.ANTHROPIC_API_KEY! })
  ),
  validator: new Validator(),
});

// 4. Use it!
const result = await engine.interpret(
  'Say hello to Alice',
  { requestId: '1' }
);

console.log(result.plan.calls[0].args);
// { name: 'Alice', formal: false }
```

## 🧪 What's Been Tested

✅ **Unit Tests (10 passing)**
- ActionRegistry registration
- Duplicate prevention
- Dependency validation
- Tag indexing
- Lock mechanism
- Error handling

✅ **Type Safety**
- All packages compile without errors
- Strict TypeScript mode enabled
- No `any` types (except adapters)

✅ **Build System**
- All 3 packages build successfully
- npm workspaces linking works
- TypeScript declarations generated

## 📊 Performance

Run the smoke test to verify performance targets:

- ✅ **Normalize**: <5ms
- ✅ **Route**: 50-200ms (depends on registry size)
- ✅ **Interpret**: 500-2000ms (LLM call)
- ✅ **Validate**: <50ms
- ✅ **Total**: 1-3s for simple queries

## 🐛 Troubleshooting

### Tests don't run

```bash
npm install  # Reinstall dependencies
npm run build  # Rebuild packages
npm test  # Try again
```

### "Cannot find module @nlap/core"

```bash
npm run build  # Build generates type declarations
```

### API key errors

Make sure you've set the environment variable:
```bash
echo $ANTHROPIC_API_KEY  # Should print your key
```

## 📚 Next Steps

1. **Read the full testing guide**: `TESTING.md`
2. **Explore the architecture**: `.docs/NLAP_Architecture_Complete.md`
3. **Check out examples**: `examples/quick-test.ts`
4. **Build your own actions**: See README.md for API reference

## ✨ What Works

- ✅ Action registry with validation
- ✅ TF-IDF keyword routing
- ✅ Claude LLM integration
- ✅ Zod schema validation
- ✅ Auto-repair on validation errors
- ✅ Clarification requests
- ✅ Full pipeline orchestration
- ✅ Observability with trace events

## 🚧 Coming in Phase 2

- ⏳ Embedding-based routing
- ⏳ DAG executor with dependencies
- ⏳ Multi-turn conversation memory
- ⏳ RAG for entity resolution
- ⏳ Comprehensive test suite

---

**You're all set!** The library is working and ready for development. 🎉
