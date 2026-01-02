/**
 * Quick test script for OllamaProvider
 *
 * Prerequisites:
 * 1. Install Ollama: https://ollama.com/download
 * 2. Pull model: ollama pull llama3.1:8b
 * 3. Start Ollama: ollama serve
 *
 * Run:
 * npx tsx examples/ollama-test.ts
 */

import { OllamaProvider } from '../packages/providers/src/ollama/OllamaProvider.js';
import type { LLMMessage, LLMTool } from '../packages/providers/src/base/LLMProvider.js';

async function main() {
  console.log('🦙 Testing OllamaProvider with llama3.1:8b\n');

  const provider = new OllamaProvider({
    baseURL: 'http://127.0.0.1:11434',
    model: 'llama3.1:8b',
  });

  // Test 1: Simple text response
  console.log('Test 1: Simple text generation');
  console.log('─'.repeat(50));

  const messages1: LLMMessage[] = [
    { role: 'user', content: 'Say hello in one word.' },
  ];

  const result1 = await provider.generateWithTools(messages1, []);

  console.log('Response:', result1.content);
  console.log('Tokens:', result1.usage);
  console.log('');

  // Test 2: Tool calling
  console.log('Test 2: Tool calling (action execution)');
  console.log('─'.repeat(50));

  const messages2: LLMMessage[] = [
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

  const result2 = await provider.generateWithTools(messages2, tools);

  console.log('Tool Calls:', JSON.stringify(result2.toolCalls, null, 2));
  console.log('Content:', result2.content);
  console.log('Tokens:', result2.usage);
  console.log('');

  // Test 3: Multi-turn conversation
  console.log('Test 3: Multi-turn conversation');
  console.log('─'.repeat(50));

  const messages3: LLMMessage[] = [
    { role: 'user', content: 'What is 5 + 3?' },
  ];

  const result3 = await provider.generateWithTools(messages3, []);
  console.log('Turn 1 - User: What is 5 + 3?');
  console.log('Turn 1 - Assistant:', result3.content);

  const messages4: LLMMessage[] = [
    { role: 'user', content: 'What is 5 + 3?' },
    { role: 'assistant', content: result3.content || '8' },
    { role: 'user', content: 'Now multiply that by 2' },
  ];

  const result4 = await provider.generateWithTools(messages4, []);
  console.log('Turn 2 - User: Now multiply that by 2');
  console.log('Turn 2 - Assistant:', result4.content);
  console.log('');

  console.log('✅ All tests completed successfully!');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  if (error.message.includes('Cannot connect')) {
    console.error('\n💡 Make sure Ollama is running:');
    console.error('   1. Install: https://ollama.com/download');
    console.error('   2. Run: ollama serve');
    console.error('   3. Pull model: ollama pull llama3.1:8b');
  }
  process.exit(1);
});
