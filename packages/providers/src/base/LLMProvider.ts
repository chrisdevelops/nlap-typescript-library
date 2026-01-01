/**
 * Message in LLM conversation
 */
export interface LLMMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Tool definition for LLM
 */
export interface LLMTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

/**
 * Tool call from LLM response
 */
export interface LLMToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/**
 * Response from LLM provider
 */
export interface LLMResponse {
  content?: string;
  toolCalls?: LLMToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
}

/**
 * LLM provider interface
 */
export interface LLMProvider {
  generateWithTools(
    messages: LLMMessage[],
    tools: LLMTool[],
    options?: {
      maxTokens?: number;
      temperature?: number;
      system?: string;
    }
  ): Promise<LLMResponse>;
}
