# @nlap/providers - LLM Provider Package

LLM provider adapters for NLAP's interpreter layer.

## Installation

```bash
npm install @nlap/providers @nlap/core
```

## Available Providers

- **[ClaudeProvider](./ClaudeProvider.md)** - Anthropic Claude (recommended)
- **OpenAI** - Coming in Phase 4
- **Gemini** - Coming in Phase 4

## Quick Start

### ClaudeProvider

```typescript
import { ClaudeProvider } from '@nlap/providers';
import { Interpreter } from '@nlap/core';

const provider = new ClaudeProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-sonnet-4-5-20250929', // Optional
  maxTokens: 4096, // Optional
});

const interpreter = new Interpreter(provider);
```

## Why Claude?

- **Tool Calling**: Native support for structured outputs
- **Long Context**: 200K token context window
- **Accuracy**: Excellent at following schemas
- **Reliability**: Consistent structured output

## Usage in NLAP

```typescript
import { createNLAPEngine, Interpreter } from '@nlap/core';
import { ClaudeProvider } from '@nlap/providers';

const engine = createNLAPEngine({
  registry,
  router,
  interpreter: new Interpreter(
    new ClaudeProvider({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    })
  ),
  validator,
});
```

## Environment Setup

```bash
# .env
ANTHROPIC_API_KEY=sk-ant-...
```

```typescript
// Load in your app
import dotenv from 'dotenv';
dotenv.config();

const provider = new ClaudeProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});
```

## Error Handling

```typescript
import { ProviderError } from '@nlap/core';

try {
  const result = await engine.interpret(input, context);
} catch (error) {
  if (error instanceof ProviderError) {
    if (error.code === 'rate_limit') {
      // Handle rate limiting
    } else if (error.code === 'invalid_api_key') {
      // Handle auth error
    }
  }
  throw error;
}
```

## Cost Optimization

```typescript
// Use smaller model for simple tasks
const provider = new ClaudeProvider({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-haiku-3-5-20250219', // Faster, cheaper
  maxTokens: 2048,
});

// Use HybridRouter to reduce candidate count
const router = new HybridRouter(
  new KeywordRouter(),
  new EmbeddingRouter()
);

// Limit actions sent to LLM
const engine = createNLAPEngine({
  maxCandidates: 8, // Default: 12
  // ...
});
```

## Token Usage

Typical request:
- System prompt: ~500 tokens
- Actions (12): ~1200 tokens
- User input: ~50 tokens
- Response: ~200 tokens
- **Total**: ~2000 tokens

## Testing

Use mock provider for testing:

```typescript
// test/helpers/MockProvider.ts
class MockLLMProvider {
  async generateWithTools(messages, tools) {
    return {
      toolCalls: [{
        id: '1',
        name: 'tasks.create',
        arguments: { title: 'Test Task' },
      }],
      usage: { inputTokens: 100, outputTokens: 50 },
    };
  }
}

// In tests
const engine = createNLAPEngine({
  registry,
  router,
  interpreter: new Interpreter(new MockLLMProvider()),
});
```

## Next Steps

- Configure [ClaudeProvider](./ClaudeProvider.md)
- Learn about [Interpreter](../core/Interpreter.md)
- See [API Reference](https://docs.anthropic.com/claude/reference)
