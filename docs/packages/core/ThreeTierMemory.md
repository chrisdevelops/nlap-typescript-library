# ThreeTierMemory

Multi-turn conversation memory management with working and archival storage.

## Class: `ThreeTierMemory<TContext>`

```typescript
class ThreeTierMemory<TContext extends BaseContext = BaseContext>
  implements ConversationMemory<TContext>
```

## Constructor

```typescript
new ThreeTierMemory<TContext>(config?: ThreeTierMemoryConfig)
```

**Optional Parameters:**
- `config?.workingMemoryTurns?: number` - Number of turns to keep in working memory (default: 5)

**Example:**
```typescript
// Default: 5 turns = 10 messages (5 user + 5 assistant)
const memory = new ThreeTierMemory();

// Custom: 10 turns = 20 messages
const memory = new ThreeTierMemory({ workingMemoryTurns: 10 });
```

## Methods

### `addMessage()`

Add a message to a conversation.

```typescript
addMessage(conversationId: string, message: Message): void
```

**Parameters:**
- `conversationId: string` - Unique conversation identifier
- `message: Message` - Message to add

```typescript
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;  // Auto-added if not provided
}
```

**Example:**
```typescript
memory.addMessage('conv_123', {
  role: 'user',
  content: 'Create a task for tomorrow',
});

memory.addMessage('conv_123', {
  role: 'assistant',
  content: 'Executing actions: tasks.create',
});
```

### `getMessagesForLLM()`

Get messages for LLM context (working memory only - last N turns).

```typescript
getMessagesForLLM(conversationId: string): Message[]
```

**Returns:** Array of recent messages (working memory window)

**Example:**
```typescript
const messages = memory.getMessagesForLLM('conv_123');
// Returns last 10 messages (5 turns * 2 messages per turn)

// Use in Pipeline
const engine = createNLAPEngine({
  memory,
  // ...
});
```

### `getArchivalMessages()`

Get complete conversation history (all messages).

```typescript
getArchivalMessages(conversationId: string): Message[]
```

**Returns:** All messages ever added to this conversation

**Example:**
```typescript
const allMessages = memory.getArchivalMessages('conv_123');
// Returns ALL messages, not just working memory

// Useful for:
// - Conversation export
// - Analytics
// - Debugging
```

### `getState()`

Get conversation metadata.

```typescript
getState(conversationId: string): { turnCount: number } | undefined
```

**Returns:** Conversation state or `undefined` if conversation doesn't exist

**Example:**
```typescript
const state = memory.getState('conv_123');
if (state) {
  console.log(`Turn ${state.turnCount}`);
}
```

### `getConversationMetadata()`

Get detailed conversation information.

```typescript
getConversationMetadata(conversationId: string): ConversationMetadata | undefined
```

```typescript
interface ConversationMetadata {
  id: string;
  turnCount: number;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

**Example:**
```typescript
const metadata = memory.getConversationMetadata('conv_123');
console.log(`Conversation started: ${metadata.createdAt}`);
console.log(`Messages: ${metadata.messageCount}`);
console.log(`Turns: ${metadata.turnCount}`);
```

### `getConversationIds()`

Get all active conversation IDs.

```typescript
getConversationIds(): string[]
```

**Example:**
```typescript
const conversations = memory.getConversationIds();
console.log(`Active conversations: ${conversations.length}`);

// Iterate all conversations
for (const id of conversations) {
  const metadata = memory.getConversationMetadata(id);
  console.log(`${id}: ${metadata.messageCount} messages`);
}
```

### `clearConversation()`

Delete a conversation and all its messages.

```typescript
clearConversation(conversationId: string): void
```

**Example:**
```typescript
// Remove old conversation
memory.clearConversation('conv_123');

// Verify it's gone
const state = memory.getState('conv_123');
console.log(state); // undefined
```

## Memory Tiers

### Working Memory (Tier 1)
- **Size**: Last N turns (default: 5 turns = 10 messages)
- **Purpose**: Sent to LLM for context
- **Behavior**: Sliding window - oldest messages removed automatically
- **Access**: `getMessagesForLLM()`

### Archival Memory (Tier 2)
- **Size**: All messages
- **Purpose**: Complete history for analytics, export, debugging
- **Behavior**: Never removed
- **Access**: `getArchivalMessages()`

### Semantic Memory (Tier 3) - Phase 4
- **Status**: Not yet implemented (planned)
- **Purpose**: Vector embeddings for long-term context retrieval

## Turn Tracking

A "turn" consists of:
1. User message (`role: 'user'`)
2. Assistant response (`role: 'assistant'`)

**Turn count only increments for user messages.**

**Example:**
```typescript
const memory = new ThreeTierMemory();

memory.addMessage('conv_1', { role: 'user', content: 'Hello' });
console.log(memory.getState('conv_1').turnCount); // 1

memory.addMessage('conv_1', { role: 'assistant', content: 'Hi!' });
console.log(memory.getState('conv_1').turnCount); // Still 1

memory.addMessage('conv_1', { role: 'user', content: 'How are you?' });
console.log(memory.getState('conv_1').turnCount); // 2
```

## Integration with Pipeline

ThreeTierMemory integrates automatically with the Pipeline:

```typescript
const memory = new ThreeTierMemory({ workingMemoryTurns: 5 });

const engine = createNLAPEngine({
  registry,
  router: myRouter,
  interpreter: myInterpreter,
  memory, // Enable multi-turn conversations
});

// Turn 1
await engine.interpret(
  "Create a task",
  { requestId: '1' },
  'conv_123' // Conversation ID
);

// Turn 2 - LLM sees Turn 1 context
await engine.interpret(
  "Make it due tomorrow",
  { requestId: '2' },
  'conv_123' // Same conversation
);

// Turn 3 - LLM sees Turns 1-2 context
await engine.interpret(
  "Add a reminder",
  { requestId: '3' },
  'conv_123'
);
```

## Use Cases

### Multi-Turn Task Creation
```typescript
const memory = new ThreeTierMemory();

// User refines task over multiple turns
// Turn 1: "Create a task"
// → Clarification: "What should the task be?"
// Turn 2: "Review the budget"
// → Clarification: "When is it due?"
// Turn 3: "Next Friday"
// → Action: tasks.create(title: "Review the budget", dueDate: "2026-01-09")
```

### Context Retention
```typescript
// Turn 1: "My email is alice@example.com"
// Turn 2: "Send me a reminder"
// → LLM remembers alice@example.com from Turn 1
```

### Conversation Analytics
```typescript
const conversations = memory.getConversationIds();

const stats = conversations.map(id => {
  const metadata = memory.getConversationMetadata(id);
  const messages = memory.getArchivalMessages(id);

  return {
    id,
    turnCount: metadata.turnCount,
    avgTurnLength: messages.reduce((sum, m) =>
      sum + m.content.length, 0) / messages.length,
    duration: metadata.updatedAt.getTime() - metadata.createdAt.getTime(),
  };
});
```

## Configuration Examples

### Short-Term Memory
```typescript
const memory = new ThreeTierMemory({ workingMemoryTurns: 2 });
// Only last 2 turns (4 messages) sent to LLM
// Good for: Simple Q&A, low token usage
```

### Long-Term Memory
```typescript
const memory = new ThreeTierMemory({ workingMemoryTurns: 20 });
// Last 20 turns (40 messages) sent to LLM
// Good for: Complex conversations, context-heavy tasks
```

### Session-Based Memory
```typescript
const memory = new ThreeTierMemory({ workingMemoryTurns: 10 });

// Clear at session end
function endSession(userId: string) {
  const convId = `user_${userId}`;
  memory.clearConversation(convId);
}
```

## Best Practices

1. **Use Unique Conversation IDs**: `user_${userId}`, `session_${sessionId}`, etc.
2. **Clean Up Old Conversations**: Call `clearConversation()` to free memory
3. **Monitor Message Count**: Large conversations consume tokens
4. **Adjust Window Size**: Balance context vs. token usage
5. **Add Timestamps**: Include timestamps for time-based queries

## Performance Considerations

- **In-Memory Only**: Phase 3 doesn't persist to database
- **Memory Usage**: ~1KB per message (approximate)
- **Working Memory Window**: Limits token usage to LLM
- **Archival Storage**: Grows unbounded - clean up periodically

## Common Patterns

### User-Specific Conversations
```typescript
async function processUserInput(userId: string, input: string) {
  const conversationId = `user_${userId}`;

  return await engine.interpret(
    input,
    { requestId: generateId(), userId },
    conversationId
  );
}
```

### Conversation Cleanup
```typescript
// Clean up inactive conversations
const oneHourAgo = Date.now() - (60 * 60 * 1000);

for (const id of memory.getConversationIds()) {
  const metadata = memory.getConversationMetadata(id);
  if (metadata.updatedAt.getTime() < oneHourAgo) {
    memory.clearConversation(id);
  }
}
```

### Export Conversation
```typescript
function exportConversation(conversationId: string) {
  const metadata = memory.getConversationMetadata(conversationId);
  const messages = memory.getArchivalMessages(conversationId);

  return {
    id: conversationId,
    startedAt: metadata.createdAt,
    messageCount: metadata.messageCount,
    transcript: messages.map(m => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    })),
  };
}
```
