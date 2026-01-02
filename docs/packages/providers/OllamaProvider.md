# OllamaProvider - Local LLM Provider

Integrates NLAP with locally-running Ollama models for cost-free, private natural language processing.

## Overview

The OllamaProvider connects to a local Ollama instance to run open-source LLMs with tool calling support. Perfect for:
- **Local development** without API costs
- **Privacy-sensitive** applications
- **Offline environments**
- **Experimentation** with different models

## Installation

```bash
# Install Ollama first
# Visit: https://ollama.com/download

# Pull a compatible model
ollama pull llama3.1:8b

# Install NLAP providers package
npm install @nlap/providers
```

## Quick Start

```typescript
import { OllamaProvider } from '@nlap/providers';
import { Interpreter } from '@nlap/core';

const provider = new OllamaProvider({
  baseURL: 'http://localhost:11434',  // Optional, this is the default
  model: 'llama3.1:8b',
});

const interpreter = new Interpreter(provider);
```

## Configuration

### OllamaProviderConfig

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `model` | string | ✅ Yes | - | Model name (e.g., 'llama3.1:8b', 'qwen2.5:7b') |
| `baseURL` | string | No | `'http://localhost:11434'` | Ollama server URL |
| `timeout` | number | No | `60000` | Request timeout in milliseconds |

### Example Configurations

#### Default (Localhost)

```typescript
const provider = new OllamaProvider({
  model: 'llama3.1:8b',
});
```

#### Custom Server

```typescript
const provider = new OllamaProvider({
  model: 'qwen2.5:7b',
  baseURL: 'http://192.168.1.100:11434',
  timeout: 120000,  // 2 minutes for large models
});
```

#### Production with Environment Variables

```typescript
const provider = new OllamaProvider({
  model: process.env.OLLAMA_MODEL || 'llama3.1:8b',
  baseURL: process.env.OLLAMA_URL || 'http://localhost:11434',
});
```

## Recommended Models

### Best for NLAP (Tool Calling)

| Model | Size | RAM | Tool Calling | Speed | Best For |
|-------|------|-----|--------------|-------|----------|
| **llama3.1:8b** | 8B | 8GB | ⭐⭐⭐⭐⭐ | Fast | Production |
| **qwen2.5-coder:7b** | 7B | 6-8GB | ⭐⭐⭐⭐⭐ | Fast | Code/Dev actions |
| **mistral:7b** | 7B | 5-6GB | ⭐⭐⭐⭐ | Fastest | Testing |
| **qwen2.5:14b** | 14B | 12GB | ⭐⭐⭐⭐⭐ | Medium | Complex workflows |

```bash
# Pull recommended models
ollama pull llama3.1:8b
ollama pull qwen2.5-coder:7b
ollama pull mistral:7b
```

See [Model Selection Guide](https://ollama.com/library) for more options.

## Usage Examples

### Basic Integration

```typescript
import { createNLAPEngine, ActionRegistry } from '@nlap/core';
import { OllamaProvider } from '@nlap/providers';
import { HybridRouter, KeywordRouter, EmbeddingRouter } from '@nlap/routers';

const registry = new ActionRegistry();
// ... register actions

const engine = createNLAPEngine({
  registry,
  router: new HybridRouter(new KeywordRouter(), new EmbeddingRouter()),
  interpreter: new Interpreter(
    new OllamaProvider({
      model: 'llama3.1:8b',
    })
  ),
});

const result = await engine.interpret(
  "Create a task to review the budget",
  { requestId: '123' }
);
```

### With Custom Configuration

```typescript
const provider = new OllamaProvider({
  model: 'qwen2.5-coder:7b',
  baseURL: 'http://localhost:11434',
  timeout: 90000,  // 90s for complex tasks
});

const result = await provider.generateWithTools(
  [{ role: 'user', content: 'Write a Python function to calculate fibonacci' }],
  tools,
  {
    system: 'You are a helpful coding assistant.',
    temperature: 0.15,  // Lower for more deterministic tool calling
    maxTokens: 4096,
  }
);
```

## Tool Calling

Ollama models support OpenAI-compatible function calling:

```typescript
const tools = [
  {
    name: 'tasks.create',
    description: 'Create a new task',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title' },
        dueDate: { type: 'string', description: 'ISO 8601 date' },
      },
      required: ['title'],
    },
  },
];

const result = await provider.generateWithTools(
  [{ role: 'user', content: 'Create a task to call John tomorrow' }],
  tools
);

// Result contains tool calls
console.log(result.toolCalls);
// [{
//   id: 'call_123',
//   name: 'tasks.create',
//   arguments: { title: 'Call John', dueDate: '2026-01-03T00:00:00Z' }
// }]
```

## Error Handling

```typescript
import { OllamaProvider } from '@nlap/providers';

const provider = new OllamaProvider({
  model: 'llama3.1:8b',
});

try {
  const result = await provider.generateWithTools(messages, tools);
} catch (error) {
  if (error.name === 'ProviderError') {
    if (error.message.includes('Cannot connect')) {
      console.error('Ollama is not running. Start it with: ollama serve');
    } else if (error.message.includes('404')) {
      console.error('Model not found. Pull it with: ollama pull llama3.1:8b');
    } else {
      console.error('Ollama error:', error.message);
    }
  }
  throw error;
}
```

## Performance Optimization

### Recommended Settings for Tool Calling

```typescript
const result = await provider.generateWithTools(
  messages,
  tools,
  {
    temperature: 0.15,  // Low for accuracy in tool selection
    maxTokens: 4096,    // Sufficient for most tool calls
  }
);
```

### Model-Specific Tips

**llama3.1:8b:**
- Best overall balance
- Use temperature 0.1-0.3 for tool calling
- Expect 2-5s per request on good hardware

**qwen2.5-coder:7b:**
- Excellent for code-related actions
- Use lower temperature (0.1)
- Faster than llama3.1 on Apple Silicon

**mistral:7b:**
- Fastest inference
- Good for simple actions
- Higher temperature (0.3-0.5) for variety

## Comparison: Ollama vs Claude

| Feature | OllamaProvider | ClaudeProvider |
|---------|----------------|----------------|
| **Cost** | Free | Paid per token |
| **Speed** | 2-10s (hardware dependent) | 1-3s |
| **Privacy** | 100% local | Sends data to API |
| **Accuracy** | Good (model dependent) | Excellent |
| **Internet** | Not required | Required |
| **Setup** | Install Ollama | API key only |

## Troubleshooting

### "Cannot connect to Ollama"

```bash
# Check if Ollama is running
ollama list

# If not running, start it
ollama serve
```

### "Model not found"

```bash
# List available models
ollama list

# Pull the model you need
ollama pull llama3.1:8b
```

### Slow responses

- Ensure you have enough RAM (8GB+ for 8B models)
- Use smaller models (mistral:7b)
- Enable GPU acceleration if available
- Reduce `maxTokens` in options

### Poor tool calling accuracy

- Use llama3.1:8b or qwen2.5 models (better tool support)
- Lower temperature (0.1-0.2)
- Add more detailed tool descriptions
- Include examples in prompts

## Testing

### Unit Tests

```bash
npm test tests/ollama/OllamaProvider.test.ts
```

### Integration Tests (Requires Running Ollama)

```bash
# Start Ollama first
ollama serve

# Pull test model
ollama pull llama3.1:8b

# Run integration tests
npm test tests/integration/ollama-live.test.ts
```

## Environment Variables

```bash
# .env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_TIMEOUT=60000
```

```typescript
const provider = new OllamaProvider({
  baseURL: process.env.OLLAMA_URL,
  model: process.env.OLLAMA_MODEL!,
  timeout: parseInt(process.env.OLLAMA_TIMEOUT || '60000'),
});
```

## Advanced Usage

### Model Switching

```typescript
class DynamicOllamaProvider {
  private providers: Map<string, OllamaProvider>;

  constructor() {
    this.providers = new Map([
      ['fast', new OllamaProvider({ model: 'mistral:7b' })],
      ['balanced', new OllamaProvider({ model: 'llama3.1:8b' })],
      ['accurate', new OllamaProvider({ model: 'qwen2.5:14b' })],
    ]);
  }

  getProvider(complexity: 'fast' | 'balanced' | 'accurate') {
    return this.providers.get(complexity)!;
  }
}

const providers = new DynamicOllamaProvider();
const provider = providers.getProvider('balanced');
```

### Health Checking

```typescript
async function checkOllamaHealth(baseURL: string = 'http://localhost:11434') {
  try {
    const response = await fetch(`${baseURL}/api/tags`);
    const data = await response.json();
    return {
      available: true,
      models: data.models.map((m: any) => m.name),
    };
  } catch {
    return { available: false, models: [] };
  }
}

// Use in startup
const health = await checkOllamaHealth();
if (!health.available) {
  throw new Error('Ollama is not running');
}
```

## Next Steps

- Review [ClaudeProvider](./ClaudeProvider.md) for comparison
- See [Providers Overview](./README.md) for all providers
- Check [Integration Examples](../../examples/README.md)
- Read [Ollama Documentation](https://ollama.com/docs)

## Resources

- [Ollama Official Site](https://ollama.com/)
- [Ollama Model Library](https://ollama.com/library)
- [Tool Calling Guide](https://ollama.com/blog/tool-support)
- [NLAP Documentation](../../README.md)
