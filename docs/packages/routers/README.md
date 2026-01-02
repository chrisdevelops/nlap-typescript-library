# @nlap/routers - Routing Package

Action routing strategies for selecting relevant actions from natural language input.

## Installation

```bash
npm install @nlap/routers @nlap/core
```

## Available Routers

- **[KeywordRouter](./KeywordRouter.md)** - TF-IDF keyword-based routing (fast, ~50ms)
- **[EmbeddingRouter](./EmbeddingRouter.md)** - Vector similarity routing (semantic, ~200ms)
- **[HybridRouter](./HybridRouter.md)** - Keyword-first with embedding fallback (best of both)

## Which Router to Use?

| Router | Speed | Accuracy | Use Case |
|--------|-------|----------|----------|
| **KeywordRouter** | ⚡ Fastest | Good | Simple queries, keyword matching |
| **EmbeddingRouter** | 🐌 Slowest | Best | Semantic understanding, paraphrasing |
| **HybridRouter** | ⚡ Fast | Best | Production (recommended) |

## Quick Start

### KeywordRouter (Simple)

```typescript
import { KeywordRouter } from '@nlap/routers';

const router = new KeywordRouter();
```

- **Pros**: Fast (~50ms), no model download
- **Cons**: Exact keyword matching only
- **Best for**: Prototyping, keyword-heavy actions

### EmbeddingRouter (Semantic)

```typescript
import { EmbeddingRouter } from '@nlap/routers';

const router = new EmbeddingRouter({
  minScore: 0.3,
  maxCandidates: 12,
});
```

- **Pros**: Understands semantics, handles paraphrasing
- **Cons**: Slow first run (~25MB model download)
- **Best for**: Natural language variation

### HybridRouter (Recommended)

```typescript
import { HybridRouter, KeywordRouter, EmbeddingRouter } from '@nlap/routers';

const router = new HybridRouter(
  new KeywordRouter(),
  new EmbeddingRouter(),
  {
    keywordConfidenceThreshold: 0.5,
    minKeywordCandidates: 3,
    fallbackStrategy: 'embedding',
  }
);
```

- **Pros**: Fast + accurate, intelligent fallback
- **Cons**: Slightly more complex configuration
- **Best for**: Production applications

## How Routing Works

1. **Input**: User's natural language query
2. **Routing**: Router selects top ~12 relevant actions
3. **LLM**: Only these candidates sent to LLM (not all actions!)
4. **Output**: Ranked list of action candidates

**Why limit to ~12?**
- Reduces LLM token usage
- Faster inference
- Better accuracy (less noise)

## Integration Example

```typescript
import { createNLAPEngine } from '@nlap/core';
import { HybridRouter, KeywordRouter, EmbeddingRouter } from '@nlap/routers';

const engine = createNLAPEngine({
  registry,
  router: new HybridRouter(
    new KeywordRouter(),
    new EmbeddingRouter()
  ),
  interpreter,
  validator,
});

const result = await engine.interpret(
  "Create a task for tomorrow",
  context
);

// Router selected: ['tasks.create', 'tasks.schedule', ...]
// Only these sent to LLM
```

## Performance Comparison

```
Registry: 100 actions
Query: "Create a task to review budget by Friday"

KeywordRouter:
  Duration: 52ms
  Candidates: 12
  Top match: tasks.create (score: 0.85)

EmbeddingRouter:
  Duration: 187ms (first run: 3.2s)
  Candidates: 12
  Top match: tasks.create (score: 0.92)

HybridRouter:
  Duration: 55ms (keyword path)
  Candidates: 12
  Top match: tasks.create (score: 0.85)
  Fallback: Not triggered (keyword confident)
```

## When to Use Each

### Use KeywordRouter when:
- Prototyping quickly
- Actions have keyword-rich descriptions
- Speed is critical
- You can't download models (edge devices)

### Use EmbeddingRouter when:
- User queries vary greatly (paraphrasing)
- Semantic understanding is critical
- You have time for model download
- Accuracy > speed

### Use HybridRouter when:
- Building production applications
- You want both speed and accuracy
- Keyword matching usually works, but need fallback
- Best overall user experience

## Advanced Configuration

See individual router documentation:
- [KeywordRouter Configuration](./KeywordRouter.md)
- [EmbeddingRouter Configuration](./EmbeddingRouter.md)
- [HybridRouter Configuration](./HybridRouter.md)
