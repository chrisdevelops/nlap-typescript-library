import type { ConversationMemory } from '../types/pipeline.js';
import type { Message, BaseContext } from '../types/base.js';

/**
 * Conversation state stored in memory
 */
interface ConversationState {
  id: string;
  turnCount: number;
  workingMemory: Message[]; // Last N turns
  archivalMemory: Message[]; // All messages
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ThreeTierMemory manages multi-turn conversations with working and archival memory
 *
 * - Working Memory: Last N turns (default: 5 * 2 = 10 messages)
 * - Archival Memory: Complete conversation history
 * - Semantic Memory: Skipped in Phase 3 (planned for Phase 4 with RAG)
 */
export class ThreeTierMemory<TContext extends BaseContext = BaseContext>
  implements ConversationMemory<TContext>
{
  private conversations = new Map<string, ConversationState>();
  private config: Required<ThreeTierMemoryConfig>;

  constructor(config: ThreeTierMemoryConfig = {}) {
    this.config = {
      workingMemoryTurns: config.workingMemoryTurns ?? 5,
    };
  }

  /**
   * Get messages for LLM context (working memory only)
   */
  getMessagesForLLM(conversationId: string): Message[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return [];
    }

    return conversation.workingMemory;
  }

  /**
   * Add a message to the conversation
   */
  addMessage(conversationId: string, message: Message): void {
    let conversation = this.conversations.get(conversationId);

    if (!conversation) {
      // Create new conversation
      conversation = {
        id: conversationId,
        turnCount: 0,
        workingMemory: [],
        archivalMemory: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.conversations.set(conversationId, conversation);
    }

    // Add timestamp if not present
    const messageWithTimestamp: Message = {
      ...message,
      timestamp: message.timestamp ?? new Date(),
    };

    // Add to archival memory (all messages)
    conversation.archivalMemory.push(messageWithTimestamp);

    // Add to working memory and maintain window size
    conversation.workingMemory.push(messageWithTimestamp);
    const maxWorkingMessages = this.config.workingMemoryTurns * 2; // 2 messages per turn (user + assistant)
    if (conversation.workingMemory.length > maxWorkingMessages) {
      // Remove oldest messages to maintain window
      conversation.workingMemory = conversation.workingMemory.slice(-maxWorkingMessages);
    }

    // Update turn count (increment for user messages)
    if (message.role === 'user') {
      conversation.turnCount++;
    }

    conversation.updatedAt = new Date();
  }

  /**
   * Get conversation state
   */
  getState(conversationId: string): { turnCount: number } | undefined {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return undefined;
    }

    return {
      turnCount: conversation.turnCount,
    };
  }

  /**
   * Get all messages from archival memory
   */
  getArchivalMessages(conversationId: string): Message[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return [];
    }

    return conversation.archivalMemory;
  }

  /**
   * Clear a conversation from memory
   */
  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  /**
   * Get all active conversation IDs
   */
  getConversationIds(): string[] {
    return Array.from(this.conversations.keys());
  }

  /**
   * Get conversation metadata
   */
  getConversationMetadata(conversationId: string): {
    id: string;
    turnCount: number;
    messageCount: number;
    createdAt: Date;
    updatedAt: Date;
  } | undefined {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return undefined;
    }

    return {
      id: conversation.id,
      turnCount: conversation.turnCount,
      messageCount: conversation.archivalMemory.length,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }
}

/**
 * Configuration for ThreeTierMemory
 */
export interface ThreeTierMemoryConfig {
  /**
   * Number of turns to keep in working memory (default: 5)
   * Each turn = 2 messages (user + assistant), so working memory = turns * 2
   */
  workingMemoryTurns?: number;
}
