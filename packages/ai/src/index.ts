/**
 * @module @carpentry/ai
 * @description AI provider abstraction — unified interface for OpenAI, Anthropic, etc.
 * @patterns Strategy (providers), Adapter (normalize different API shapes)
 * @principles DIP — app depends on provider interface; OCP — new providers without modifying core
 *
 * Use this package to:
 * - Call AI completions via the global `AI` facade (`AI.complete()`, `AI.ask()`, `AI.stream()`)
 * - Swap implementations by setting an {@link AIProviderLike} using `setAIProvider()`
 * - Build RAG pipelines with {@link RagPipeline} and vector stores
 *
 * @example
 * ```ts
 * import { AI, setAIProvider, MockAIProvider } from '@carpentry/ai';
 *
 * const provider = new MockAIProvider()
 *   .queueResponse('Hello from the mock model');
 *
 * setAIProvider(provider);
 *
 * const answer = await AI.ask('Say hi!');
 * // answer === 'Hello from the mock model'
 * ```
 */

// ── Local Types (matches core contracts) ──────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
}
export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: AIToolDefinition[];
  [key: string]: unknown;
}
export interface CompletionResult {
  content: string;
  finishReason: string;
  usage: TokenUsage;
  toolCalls?: AIToolCall[];
}
export interface CompletionChunk {
  content: string;
  finishReason: string | null;
}
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}
export interface AIToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}
export interface AIToolCall {
  id: string;
  name: string;
  arguments: string;
}
export interface ScoredDocument {
  id: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
}

// ── MockAIProvider — for testing ──────────────────────────

/**
 * MockAIProvider — in-memory AI provider for tests.
 *
 * Queue one or more responses with `queueResponse()`. Each call to `complete()`/`stream()`
 * consumes the next queued response (falling back to `"Mock response"` when the queue is empty).
 *
 * Provides inspection helpers:
 * - `getLog()` to view received messages/options
 * - `assertCalledTimes()` and `assertSystemMessage()`
 */
export class MockAIProvider {
  private responses: string[] = [];
  private completionLog: Array<{ messages: ChatMessage[]; options?: CompletionOptions }> = [];

  /**
   * @param {string} text
   * @returns {this}
   */
  queueResponse(text: string): this {
    this.responses.push(text);
    return this;
  }

  /**
   * @param {ChatMessage[]} messages
   * @param {CompletionOptions} [options]
   * @returns {Promise<CompletionResult>}
   */
  async complete(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult> {
    this.completionLog.push({ messages, options });
    const text = this.responses.shift() ?? "Mock response";
    const words = text.split(" ").length;
    return {
      content: text,
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: words, totalTokens: 10 + words },
      toolCalls: [],
    };
  }

  async *stream(
    messages: ChatMessage[],
    options?: CompletionOptions,
  ): AsyncIterable<CompletionChunk> {
    this.completionLog.push({ messages, options });
    const text = this.responses.shift() ?? "Mock streamed response";
    for (const word of text.split(" ")) {
      yield { content: `${word} `, finishReason: null };
    }
    yield { content: "", finishReason: "stop" };
  }

  getLog() {
    return [...this.completionLog];
  }
  /**
   * @param {number} n
   */
  assertCalledTimes(n: number): void {
    if (this.completionLog.length !== n)
      throw new Error(`Expected ${n} AI calls, got ${this.completionLog.length}.`);
  }
  /**
   * @param {string} content
   */
  assertSystemMessage(content: string): void {
    const last = this.completionLog[this.completionLog.length - 1];
    if (!last) throw new Error("No AI calls recorded.");
    const sys = last.messages.find((m) => m.role === "system");
    if (!sys || !sys.content.includes(content))
      throw new Error(`Expected system message containing "${content}".`);
  }
  reset(): void {
    this.responses = [];
    this.completionLog = [];
  }
}

// ── InMemoryVectorStore — for testing RAG ─────────────────

/**
 * InMemoryVectorStore — simple vector store for RAG/testing.
 *
 * Stores documents/chunks with precomputed embeddings and ranks by cosine similarity.
 * Intended for unit tests and local dev (not production-scale retrieval).
 *
 * @example
 * ```ts
 * import { InMemoryVectorStore } from '@carpentry/ai';
 *
 * const store = new InMemoryVectorStore();
 * // embedding vectors should be same dimensionality
 * await store.upsert('doc1', 'Hello world', [1, 0, 0, 0], { source: 'readme' });
 *
 * const results = await store.search([1, 0, 0, 0], 1);
 * // results[0].id === 'doc1'
 * ```
 */
export class InMemoryVectorStore {
  private documents: Array<{
    id: string;
    content: string;
    embedding: number[];
    metadata: Record<string, unknown>;
  }> = [];

  /**
   * @param {string} id
   * @param {string} content
   * @param {number[]} embedding
   * @param {Object} [metadata]
   * @returns {Promise<void>}
   */
  async upsert(
    id: string,
    content: string,
    embedding: number[],
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const i = this.documents.findIndex((d) => d.id === id);
    const doc = { id, content, embedding, metadata: metadata ?? {} };
    if (i >= 0) this.documents[i] = doc;
    else this.documents.push(doc);
  }

  /**
   * @param {number[]} queryEmbedding
   * @param {number} [topK]
   * @returns {Promise<ScoredDocument[]>}
   */
  async search(queryEmbedding: number[], topK = 5): Promise<ScoredDocument[]> {
    return this.documents
      .map((doc) => ({
        id: doc.id,
        content: doc.content,
        score: this.cosine(queryEmbedding, doc.embedding),
        metadata: doc.metadata,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * @param {string} id
   * @returns {Promise<void>}
   */
  async delete(id: string): Promise<void> {
    this.documents = this.documents.filter((d) => d.id !== id);
  }
  count(): number {
    return this.documents.length;
  }
  reset(): void {
    this.documents = [];
  }

  private cosine(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] ** 2;
      nb += b[i] ** 2;
    }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d === 0 ? 0 : dot / d;
  }
}

// ── AI Facade ─────────────────────────────────────────────

interface AIProviderLike {
  /**
   * @param {ChatMessage[]} messages
   * @param {CompletionOptions} [options]
   * @returns {Promise<CompletionResult>}
   */
  complete(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult>;
  /**
   * @param {ChatMessage[]} messages
   * @param {CompletionOptions} [options]
   * @returns {AsyncIterable<CompletionChunk>}
   */
  stream(messages: ChatMessage[], options?: CompletionOptions): AsyncIterable<CompletionChunk>;
}

let globalAIProvider: AIProviderLike | null = null;
/**
 * @param {AIProviderLike} provider
 */
export function setAIProvider(provider: AIProviderLike): void {
  globalAIProvider = provider;
}

/**
 * Global AI facade that forwards calls to the configured provider.
 *
 * You must call {@link setAIProvider} once during app boot.
 */
export const AI = {
  complete: (messages: ChatMessage[], options?: CompletionOptions) =>
    getProvider().complete(messages, options),
  stream: (messages: ChatMessage[], options?: CompletionOptions) =>
    getProvider().stream(messages, options),
  ask: async (prompt: string, options?: CompletionOptions): Promise<string> => {
    const result = await getProvider().complete([{ role: "user", content: prompt }], options);
    return result.content;
  },
};

function getProvider(): AIProviderLike {
  /**
   * @param {unknown} !globalAIProvider
   */
  if (!globalAIProvider) throw new Error("AI provider not initialized.");
  return globalAIProvider;
}

export {
  AnthropicProvider,
  OpenAIProvider,
  GroqProvider,
  OllamaProvider,
  AIManager,
} from "./providers.js";
export type {
  IAIProvider,
  AIMessage,
  AICompletionOptions,
  AICompletionResult,
  AIProviderConfig,
} from "./providers.js";
export { Agent } from "./Agent.js";
export type { AgentTool, AgentStep, AgentConfig, AgentResult } from "./Agent.js";
export { McpClient, HttpMcpTransport, InMemoryMcpTransport } from "./McpClient.js";
export type {
  IMcpTransport,
  McpCapabilities,
  McpToolDefinition,
  McpToolResult,
} from "./McpClient.js";
export {
  RagPipeline,
  RecursiveChunker,
  FixedSizeChunker,
  InMemoryRagVectorStore,
} from "./RagPipeline.js";
export type {
  RagDocument,
  RagChunk,
  RetrievedChunk,
  IChunker,
  IVectorStore,
  EmbedFn,
} from "./RagPipeline.js";
export { AiGuard } from "./AiGuard.js";
export type { AiViolation, InspectResult, GuardRule, AiGuardConfig } from "./AiGuard.js";

export {
  parseSSE,
  parseAnthropicStream,
  parseOpenAIStream,
  streamCompletion,
  useStream,
} from "./streaming.js";
export type { SSEEvent, StreamChunk, StreamState, UseStreamOptions } from "./streaming.js";
