# @nlap/providers - LLM Provider Package

LLM provider adapters for NLAP's interpreter layer.

## Installation

```bash
npm install @nlap/providers @nlap/core
```

## Available Providers

- **[ClaudeProvider](./ClaudeProvider.md)** - Anthropic Claude (cloud, recommended for production)
- **[OllamaProvider](./OllamaProvider.md)** - Local open-source models (free, private)
- **OpenAI** - Coming in Phase 4
- **Gemini** - Coming in Phase 4

## Provider Comparison

| Feature | ClaudeProvider | OllamaProvider |
|---------|----------------|----------------|
| **Cost** | Paid per token | Free |
| **Speed** | 1-3s | 2-10s (hardware dependent) |
| **Accuracy** | Excellent | Good (model dependent) |
| **Privacy** | Sends to API | 100% local |
| **Internet** | Required | Not required |
| **Setup** | API key | Install Ollama + models |
| **Best For** | Production, critical accuracy | Development, privacy, cost-free |

## Quick Start

### ClaudeProvider (Cloud)

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

### OllamaProvider (Local)

```typescript
import { OllamaProvider } from '@nlap/providers';
import { Interpreter } from '@nlap/core';

// First: ollama pull llama3.1:8b
const provider = new OllamaProvider({
  model: 'llama3.1:8b',
  baseURL: 'http://localhost:11434', // Optional, default
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

## Choosing a Provider

**Use ClaudeProvider when:**
- Building production applications
- Need highest accuracy for tool calling
- Have API budget
- Internet connectivity available

**Use OllamaProvider when:**
- Developing locally without costs
- Privacy/security requirements (data stays local)
- Offline environment
- Experimenting with different models

**You can use both:**
```typescript
// Production
const prodProvider = new ClaudeProvider({ apiKey: '...' });

// Development
const devProvider = new OllamaProvider({ model: 'llama3.1:8b' });

const provider = process.env.NODE_ENV === 'production'
  ? prodProvider
  : devProvider;
```

## Next Steps

- Configure [ClaudeProvider](./ClaudeProvider.md) for cloud API
- Configure [OllamaProvider](./OllamaProvider.md) for local models
- Learn about [Interpreter](../core/Interpreter.md)
- See [Claude API Reference](https://docs.anthropic.com/claude/reference)
- See [Ollama Documentation](https://ollama.com/docs)
