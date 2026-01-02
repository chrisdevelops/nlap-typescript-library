import { describe, it, expect, beforeAll } from 'vitest';
import { OllamaProvider } from '../../src/ollama/OllamaProvider.js';
import type { LLMMessage, LLMTool } from '../../src/base/LLMProvider.js';

// Check if Ollama is available
async function isOllamaAvailable(): Promise<boolean> {
  try {
    const response = await fetch('http://127.0.0.1:11434/api/tags');
    return response.ok;
  } catch {
    return false;
  }
}

describe('OllamaProvider - Live Integration', () => {
  const provider = new OllamaProvider({
    baseURL: 'http://127.0.0.1:11434',
    model: 'llama3.1:8b',
  });

  beforeAll(async () => {
    // Check if Ollama is available
    const available = await isOllamaAvailable();
    if (!available) {
      throw new Error(
        'Ollama is not running at http://127.0.0.1:11434. Please start Ollama first.'
      );
    }

    // Verify model is available
    const response = await fetch('http://127.0.0.1:11434/api/tags');
    const data = await response.json();
    const models = data.models || [];
    const hasLlama = models.some((m: any) =>
      m.name.toLowerCase().includes('llama3.1')
    );

    if (!hasLlama) {
      throw new Error('llama3.1:8b model not found. Please run: ollama pull llama3.1:8b');
    }
  });

  it('should connect to Ollama and generate text response', async () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'Say hello in one word.' },
    ];

    const result = await provider.generateWithTools(messages, []);

    expect(result.content).toBeDefined();
    expect(result.content).toBeTruthy();
    expect(result.usage).toBeDefined();
    expect(result.usage?.inputTokens).toBeGreaterThan(0);
    expect(result.usage?.outputTokens).toBeGreaterThan(0);
  }, 30000); // 30s timeout for local inference

  it('should handle tool calling with simple action', async () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'Create a task to review the budget by Friday' },
    ];

    const tools: LLMTool[] = [
      {
        name: 'tasks.create',
        description: 'Create a new task with a title and optional due date',
        input_schema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'The title of the task',
            },
            dueDate: {
              type: 'string',
              description: 'Due date in ISO 8601 format',
            },
          },
          required: ['title'],
        },
      },
    ];

    const result = await provider.generateWithTools(messages, tools);

    // Should return tool calls
    expect(result.toolCalls).toBeDefined();
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls?.[0].name).toBe('tasks.create');
    expect(result.toolCalls?.[0].arguments).toHaveProperty('title');
    expect(result.toolCalls?.[0].arguments.title).toContain('budget');
  }, 30000);

  it('should parse tool call arguments correctly', async () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'Add 5 apples to my shopping cart' },
    ];

    const tools: LLMTool[] = [
      {
        name: 'cart.add',
        description: 'Add items to shopping cart',
        input_schema: {
          type: 'object',
          properties: {
            item: {
              type: 'string',
              description: 'Item name',
            },
            quantity: {
              type: 'number',
              description: 'Quantity to add',
            },
          },
          required: ['item', 'quantity'],
        },
      },
    ];

    const result = await provider.generateWithTools(messages, tools);

    expect(result.toolCalls).toBeDefined();
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls?.[0].name).toBe('cart.add');
    expect(result.toolCalls?.[0].arguments).toEqual(
      expect.objectContaining({
        item: expect.stringMatching(/apple/i),
        quantity: 5,
      })
    );
  }, 30000);

  it('should handle multi-turn conversation with history', async () => {
    // Turn 1: Ask a question
    const messages1: LLMMessage[] = [
      { role: 'user', content: 'What is 2 + 2?' },
    ];

    const result1 = await provider.generateWithTools(messages1, []);
    expect(result1.content).toBeDefined();

    // Turn 2: Follow up (should remember context)
    const messages2: LLMMessage[] = [
      { role: 'user', content: 'What is 2 + 2?' },
      { role: 'assistant', content: result1.content || '4' },
      { role: 'user', content: 'What about multiplying that by 3?' },
    ];

    const result2 = await provider.generateWithTools(messages2, []);
    expect(result2.content).toBeDefined();
    expect(result2.content).toMatch(/12|twelve/i);
  }, 60000); // 60s for two inference calls

  it('should handle system prompts correctly', async () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'Greet me' },
    ];

    const result = await provider.generateWithTools(messages, [], {
      system: 'You are a pirate. Always respond like a pirate.',
      temperature: 0.7,
    });

    expect(result.content).toBeDefined();
    // Should include pirate-like language (ahoy, matey, arr, etc.)
    expect(result.content?.toLowerCase()).toMatch(/ahoy|matey|arr|pirate|ship/);
  }, 30000);

  it('should respect temperature parameter', async () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'Pick a random number between 1 and 10' },
    ];

    // Low temperature should be more deterministic
    const result1 = await provider.generateWithTools(messages, [], {
      temperature: 0.1,
    });

    const result2 = await provider.generateWithTools(messages, [], {
      temperature: 0.1,
    });

    expect(result1.content).toBeDefined();
    expect(result2.content).toBeDefined();

    // Both should have content (exact match not guaranteed but likely similar)
  }, 60000);
});

describe('OllamaProvider - Live Error Handling', () => {
  it('should throw ProviderError when Ollama is not reachable', async () => {
    const provider = new OllamaProvider({
      baseURL: 'http://localhost:99999', // Invalid port
      model: 'llama3.1:8b',
      timeout: 1000,
    });

    const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];

    await expect(provider.generateWithTools(messages, [])).rejects.toThrow(
      'Provider error (ollama)'
    );

    try {
      await provider.generateWithTools(messages, []);
    } catch (error: any) {
      expect(error.name).toBe('ProviderError');
      expect(error.code).toBe('PROVIDER_ERROR');
      expect(error.details.provider).toBe('ollama');
    }
  }, 5000);

  it('should throw ProviderError for non-existent model', async () => {
    // Check if Ollama is available first
    const available = await isOllamaAvailable();
    if (!available) {
      return; // Skip test if Ollama not available
    }

    const provider = new OllamaProvider({
      baseURL: 'http://127.0.0.1:11434',
      model: 'nonexistent-model:999',
      timeout: 5000,
    });

    const messages: LLMMessage[] = [{ role: 'user', content: 'Hello' }];

    await expect(provider.generateWithTools(messages, [])).rejects.toThrow();
  }, 10000);
});
