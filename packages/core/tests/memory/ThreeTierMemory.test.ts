import { describe, it, expect, beforeEach } from 'vitest';
import { ThreeTierMemory } from '../../src/memory/ThreeTierMemory.js';
import type { Message } from '../../src/types/base.js';

describe('ThreeTierMemory', () => {
  let memory: ThreeTierMemory;

  beforeEach(() => {
    memory = new ThreeTierMemory();
  });

  describe('Basic Message Management', () => {
    it('should add and retrieve messages', () => {
      const message: Message = {
        role: 'user',
        content: 'Hello',
      };

      memory.addMessage('conv1', message);

      const messages = memory.getMessagesForLLM('conv1');
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello');
      expect(messages[0].role).toBe('user');
    });

    it('should add timestamp if not provided', () => {
      const message: Message = {
        role: 'user',
        content: 'Hello',
      };

      memory.addMessage('conv1', message);

      const messages = memory.getMessagesForLLM('conv1');
      expect(messages[0].timestamp).toBeInstanceOf(Date);
    });

    it('should preserve timestamp if provided', () => {
      const customTimestamp = new Date('2024-01-01');
      const message: Message = {
        role: 'user',
        content: 'Hello',
        timestamp: customTimestamp,
      };

      memory.addMessage('conv1', message);

      const messages = memory.getMessagesForLLM('conv1');
      expect(messages[0].timestamp).toEqual(customTimestamp);
    });

    it('should return empty array for unknown conversation', () => {
      const messages = memory.getMessagesForLLM('nonexistent');
      expect(messages).toEqual([]);
    });
  });

  describe('Turn Tracking', () => {
    it('should track turn count correctly', () => {
      memory.addMessage('conv1', { role: 'user', content: 'Turn 1' });
      expect(memory.getState('conv1')?.turnCount).toBe(1);

      memory.addMessage('conv1', { role: 'assistant', content: 'Response 1' });
      expect(memory.getState('conv1')?.turnCount).toBe(1);

      memory.addMessage('conv1', { role: 'user', content: 'Turn 2' });
      expect(memory.getState('conv1')?.turnCount).toBe(2);

      memory.addMessage('conv1', { role: 'assistant', content: 'Response 2' });
      expect(memory.getState('conv1')?.turnCount).toBe(2);
    });

    it('should return undefined for unknown conversation state', () => {
      const state = memory.getState('nonexistent');
      expect(state).toBeUndefined();
    });
  });

  describe('Working Memory Window', () => {
    it('should maintain working memory window of last 5 turns (10 messages)', () => {
      // Add 7 turns = 14 messages
      for (let i = 1; i <= 7; i++) {
        memory.addMessage('conv1', { role: 'user', content: `Turn ${i}` });
        memory.addMessage('conv1', { role: 'assistant', content: `Response ${i}` });
      }

      const workingMemory = memory.getMessagesForLLM('conv1');
      // Should only have last 5 turns (10 messages)
      expect(workingMemory).toHaveLength(10);
      expect(workingMemory[0].content).toBe('Turn 3'); // Oldest in working memory
      expect(workingMemory[9].content).toBe('Response 7'); // Newest
    });

    it('should keep all messages in archival memory', () => {
      // Add 7 turns = 14 messages
      for (let i = 1; i <= 7; i++) {
        memory.addMessage('conv1', { role: 'user', content: `Turn ${i}` });
        memory.addMessage('conv1', { role: 'assistant', content: `Response ${i}` });
      }

      const archival = memory.getArchivalMessages('conv1');
      // Should have all 14 messages
      expect(archival).toHaveLength(14);
      expect(archival[0].content).toBe('Turn 1');
      expect(archival[13].content).toBe('Response 7');
    });

    it('should allow custom working memory turns config', () => {
      const customMemory = new ThreeTierMemory({ workingMemoryTurns: 2 });

      // Add 4 turns = 8 messages
      for (let i = 1; i <= 4; i++) {
        customMemory.addMessage('conv1', { role: 'user', content: `Turn ${i}` });
        customMemory.addMessage('conv1', { role: 'assistant', content: `Response ${i}` });
      }

      const workingMemory = customMemory.getMessagesForLLM('conv1');
      // Should only have last 2 turns (4 messages)
      expect(workingMemory).toHaveLength(4);
      expect(workingMemory[0].content).toBe('Turn 3');
      expect(workingMemory[3].content).toBe('Response 4');
    });
  });

  describe('Multiple Conversations', () => {
    it('should manage multiple independent conversations', () => {
      memory.addMessage('conv1', { role: 'user', content: 'Conv1 Turn1' });
      memory.addMessage('conv1', { role: 'assistant', content: 'Conv1 Response1' });

      memory.addMessage('conv2', { role: 'user', content: 'Conv2 Turn1' });
      memory.addMessage('conv2', { role: 'assistant', content: 'Conv2 Response1' });

      const conv1Messages = memory.getMessagesForLLM('conv1');
      const conv2Messages = memory.getMessagesForLLM('conv2');

      expect(conv1Messages).toHaveLength(2);
      expect(conv2Messages).toHaveLength(2);
      expect(conv1Messages[0].content).toBe('Conv1 Turn1');
      expect(conv2Messages[0].content).toBe('Conv2 Turn1');
    });

    it('should track turn counts independently', () => {
      memory.addMessage('conv1', { role: 'user', content: 'Conv1 Turn1' });
      memory.addMessage('conv1', { role: 'user', content: 'Conv1 Turn2' });

      memory.addMessage('conv2', { role: 'user', content: 'Conv2 Turn1' });

      expect(memory.getState('conv1')?.turnCount).toBe(2);
      expect(memory.getState('conv2')?.turnCount).toBe(1);
    });

    it('should list all conversation IDs', () => {
      memory.addMessage('conv1', { role: 'user', content: 'Hello' });
      memory.addMessage('conv2', { role: 'user', content: 'Hi' });
      memory.addMessage('conv3', { role: 'user', content: 'Hey' });

      const ids = memory.getConversationIds();
      expect(ids).toHaveLength(3);
      expect(ids).toContain('conv1');
      expect(ids).toContain('conv2');
      expect(ids).toContain('conv3');
    });
  });

  describe('Conversation Management', () => {
    it('should clear a conversation', () => {
      memory.addMessage('conv1', { role: 'user', content: 'Hello' });
      memory.addMessage('conv1', { role: 'assistant', content: 'Hi' });

      expect(memory.getMessagesForLLM('conv1')).toHaveLength(2);

      memory.clearConversation('conv1');

      expect(memory.getMessagesForLLM('conv1')).toEqual([]);
      expect(memory.getState('conv1')).toBeUndefined();
    });

    it('should get conversation metadata', () => {
      memory.addMessage('conv1', { role: 'user', content: 'Turn 1' });
      memory.addMessage('conv1', { role: 'assistant', content: 'Response 1' });
      memory.addMessage('conv1', { role: 'user', content: 'Turn 2' });

      const metadata = memory.getConversationMetadata('conv1');

      expect(metadata).toBeDefined();
      expect(metadata?.id).toBe('conv1');
      expect(metadata?.turnCount).toBe(2);
      expect(metadata?.messageCount).toBe(3);
      expect(metadata?.createdAt).toBeInstanceOf(Date);
      expect(metadata?.updatedAt).toBeInstanceOf(Date);
    });

    it('should return undefined metadata for unknown conversation', () => {
      const metadata = memory.getConversationMetadata('nonexistent');
      expect(metadata).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle single message', () => {
      memory.addMessage('conv1', { role: 'user', content: 'Hello' });

      expect(memory.getMessagesForLLM('conv1')).toHaveLength(1);
      expect(memory.getState('conv1')?.turnCount).toBe(1);
    });

    it('should handle system messages without incrementing turn count', () => {
      memory.addMessage('conv1', { role: 'user', content: 'Hello' });
      memory.addMessage('conv1', { role: 'system', content: 'System message' });
      memory.addMessage('conv1', { role: 'assistant', content: 'Hi' });

      expect(memory.getState('conv1')?.turnCount).toBe(1);
      expect(memory.getMessagesForLLM('conv1')).toHaveLength(3);
    });

    it('should handle rapid message additions', () => {
      for (let i = 0; i < 100; i++) {
        memory.addMessage('conv1', { role: 'user', content: `Message ${i}` });
      }

      const workingMemory = memory.getMessagesForLLM('conv1');
      const archival = memory.getArchivalMessages('conv1');

      expect(workingMemory).toHaveLength(10); // Last 5 turns (10 messages)
      expect(archival).toHaveLength(100); // All messages
    });
  });
});
