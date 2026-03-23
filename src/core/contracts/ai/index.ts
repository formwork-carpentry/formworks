/**
 * @module @carpentry/core/contracts/ai
 * @description AI/LLM contracts - provider, message, and completion interfaces.
 *
 * Implementations: MockAIProvider, AnthropicProvider, OpenAIProvider, GroqProvider, OllamaProvider
 *
 * @example
 * ```ts
 * const ai = container.make<IAIProvider>('ai');
 * const result = await ai.complete([{ role: 'user', content: 'Hello!' }]);
 * console.log(result.content);
 * ```
 */

/** @typedef {Object} AIMessage - A message in a conversation */
export interface AIMessage {
  /** @property {'system' | 'user' | 'assistant'} role - Message sender role */
  role: "system" | "user" | "assistant";
  /** @property {string} content - Message text content */
  content: string;
}

/** @typedef {Object} AICompletionOptions - Options for a completion request */
export interface AICompletionOptions {
  /** @property {string} [model] - Model identifier (e.g., 'claude-sonnet-4-20250514') */
  model?: string;
  /** @property {number} [maxTokens] - Maximum tokens to generate */
  maxTokens?: number;
  /** @property {number} [temperature] - Sampling temperature (0-2) */
  temperature?: number;
  /** @property {number} [topP] - Nucleus sampling threshold */
  topP?: number;
  /** @property {string[]} [stopSequences] - Sequences that stop generation */
  stopSequences?: string[];
}

/** @typedef {Object} AICompletionResult - Response from a completion request */
export interface AICompletionResult {
  /** @property {string} content - Generated text */
  content: string;
  /** @property {string} model - Model used */
  model: string;
  /** @property {Object} usage - Token usage */
  usage: { inputTokens: number; outputTokens: number };
  /** @property {string} finishReason - Why generation stopped */
  finishReason: string;
  /** @property {string} provider - Provider name */
  provider: string;
}

/** @typedef {Object} IAIProvider - AI provider contract */
export interface IAIProvider {
  /**
   * Get the provider name (e.g., 'anthropic', 'openai').
   * @returns {string}
   */
  getProviderName(): string;

  /**
   * Send a completion request.
   * @param {AIMessage[]} messages - Conversation messages
   * @param {AICompletionOptions} [options] - Completion options
   * @returns {Promise<AICompletionResult>} Generated response
   * @example
   * ```ts
   * const result = await provider.complete([
   *   { role: 'system', content: 'You are a helpful assistant.' },
   *   { role: 'user', content: 'What is TypeScript?' },
   * ], { maxTokens: 500 });
   * ```
   */
  complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult>;
}

/** @typedef {Object} IVectorStore - Vector database contract for RAG */
export interface IVectorStore {
  /**
   * Store a vector embedding.
   * @param {string} id - Document chunk ID
   * @param {number[]} vector - Embedding vector
   * @param {Record<string, unknown>} [metadata] - Associated metadata
   * @returns {Promise<void>}
   */
  upsert(id: string, vector: number[], metadata?: Record<string, unknown>): Promise<void>;

  /**
   * Find the nearest vectors to a query vector.
   * @param {number[]} vector - Query embedding
   * @param {number} topK - Number of results
   * @returns {Promise<Array<{ id: string; score: number; metadata?: Record<string, unknown> }>>}
   */
  query(
    vector: number[],
    topK: number,
  ): Promise<Array<{ id: string; score: number; metadata?: Record<string, unknown> }>>;
}
