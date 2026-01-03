import type { LLMMessage } from './providers/index.js';
import type { ActionCall } from './types.js';

/**
 * Conversation state
 */
interface Conversation {
  messages: LLMMessage[];
}

/**
 * Simple sliding window conversation memory
 */
export class SimpleMemory {
  private conversations = new Map<string, Conversation>();
  private maxTurns: number;

  constructor(maxTurns: number = 5) {
    this.maxTurns = maxTurns;
  }

  /**
   * Get conversation history for a conversation
   */
  getHistory(conversationId: string): LLMMessage[] {
    return this.conversations.get(conversationId)?.messages ?? [];
  }

  /**
   * Add a turn to the conversation
   */
  addTurn(conversationId: string, userInput: string, calls: ActionCall[]): void {
    let conv = this.conversations.get(conversationId);
    if (!conv) {
      conv = { messages: [] };
      this.conversations.set(conversationId, conv);
    }

    // Add user message
    conv.messages.push({ role: 'user', content: userInput });

    // Add assistant response (summarize actions)
    if (calls.length > 0) {
      const summary = calls.map((c) => c.action).join(', ');
      conv.messages.push({
        role: 'assistant',
        content: `Executing: ${summary}`,
      });
    }

    // Keep only last N turns (2 messages per turn)
    const maxMessages = this.maxTurns * 2;
    if (conv.messages.length > maxMessages) {
      conv.messages = conv.messages.slice(-maxMessages);
    }
  }

  /**
   * Clear a conversation's history
   */
  clear(conversationId: string): void {
    this.conversations.delete(conversationId);
  }
}
