/**
 * @module @formwork/ai
 * @description AI Streaming — Server-Sent Events (SSE) parser for streaming AI responses,
 * stream() method extension for providers, and useStream() composable for clients.
 *
 * WHY: AI responses can take seconds. Streaming shows tokens as they arrive,
 * giving users immediate feedback. SSE is the standard transport for both
 * Anthropic and OpenAI streaming APIs.
 *
 * HOW: parseSSE() converts a ReadableStream of SSE bytes into an AsyncIterator
 * of parsed events. Each provider's stream() method returns this iterator.
 * useStream() is a client-side composable that consumes the iterator and
 * builds the response string incrementally.
 *
 * @patterns Iterator (async streaming), Adapter (SSE → structured events)
 * @principles SRP (SSE parsing only), OCP (works with any SSE-compatible API)
 *
 * @example
 * ```ts
 * // Server-side: stream from Anthropic
 * const provider = new AnthropicProvider({ apiKey: '...' });
 * for await (const chunk of streamCompletion(provider, messages, options)) {
 *   process.stdout.write(chunk.text);
 * }
 *
 * // Client-side: consume stream
 * const stream = useStream('/api/chat', { message: 'Hello' });
 * stream.onChunk((text) => appendToUI(text));
 * await stream.start();
 * console.log(stream.fullText); // Complete response
 * ```
 */

// ── SSE Types ─────────────────────────────────────────────

/** A single SSE event parsed from the stream */
export interface SSEEvent {
  event: string;
  data: string;
  id?: string;
  retry?: number;
}

/** A chunk of streaming AI output */
export interface StreamChunk {
  /** The text delta (new characters since last chunk) */
  text: string;
  /** Whether this is the final chunk */
  done: boolean;
  /** Accumulated full text so far */
  accumulated: string;
  /** Token usage (only available on final chunk for some providers) */
  usage?: { inputTokens: number; outputTokens: number };
  /** The raw SSE event (for debugging) */
  raw?: SSEEvent;
}

// ── SSE Parser ────────────────────────────────────────────

/**
 * Parse a ReadableStream of SSE bytes into an async iterator of events.
 * Handles multi-line data, event types, and the `[DONE]` sentinel.
 *
 * @param stream - The raw byte stream (from fetch().body)
 * @returns AsyncIterableIterator of parsed SSE events
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: SSE parser handles multiple event types and stream states
export async function* parseSSE(
  stream: ReadableStream<Uint8Array>,
): AsyncIterableIterator<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let currentEvent: Partial<SSEEvent> = {};

      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent.event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const data = line.slice(5).trim();
          if (data === "[DONE]") return;
          currentEvent.data = (currentEvent.data ?? "") + data;
        } else if (line.startsWith("id:")) {
          currentEvent.id = line.slice(3).trim();
        } else if (line.startsWith("retry:")) {
          currentEvent.retry = Number.parseInt(line.slice(6).trim(), 10);
        } else if (line === "") {
          // Empty line = end of event
          if (currentEvent.data !== undefined) {
            yield {
              event: currentEvent.event ?? "message",
              data: currentEvent.data,
              id: currentEvent.id,
              retry: currentEvent.retry,
            };
          }
          currentEvent = {};
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ── Anthropic Stream Parser ───────────────────────────────

/**
 * Parse Anthropic's SSE stream into text chunks.
 * Anthropic events: content_block_delta (text), message_stop (done)
 */
export async function* parseAnthropicStream(
  stream: ReadableStream<Uint8Array>,
): AsyncIterableIterator<StreamChunk> {
  let accumulated = "";

  for await (const event of parseSSE(stream)) {
    try {
      const parsed = JSON.parse(event.data);

      if (parsed.type === "content_block_delta" && parsed.delta?.text) {
        accumulated += parsed.delta.text;
        yield { text: parsed.delta.text, done: false, accumulated };
      }

      if (parsed.type === "message_stop" || parsed.type === "message_delta") {
        const usage = parsed.usage ?? parsed.delta?.usage;
        yield {
          text: "",
          done: true,
          accumulated,
          usage: usage
            ? { inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 }
            : undefined,
        };
      }
    } catch {
      // Skip unparseable events
    }
  }
}

// ── OpenAI Stream Parser ──────────────────────────────────

/**
 * Parse OpenAI's SSE stream into text chunks.
 * OpenAI events: choices[0].delta.content
 */
export async function* parseOpenAIStream(
  stream: ReadableStream<Uint8Array>,
): AsyncIterableIterator<StreamChunk> {
  let accumulated = "";

  for await (const event of parseSSE(stream)) {
    try {
      const parsed = JSON.parse(event.data);

      const delta = parsed.choices?.[0]?.delta?.content;
      const finishReason = parsed.choices?.[0]?.finish_reason;

      if (delta) {
        accumulated += delta;
        yield { text: delta, done: false, accumulated };
      }

      if (finishReason === "stop") {
        const usage = parsed.usage;
        yield {
          text: "",
          done: true,
          accumulated,
          usage: usage
            ? { inputTokens: usage.prompt_tokens ?? 0, outputTokens: usage.completion_tokens ?? 0 }
            : undefined,
        };
      }
    } catch {
      // Skip unparseable events
    }
  }
}

// ── Stream Completion Helper ──────────────────────────────

import type { AICompletionOptions, AIMessage, IAIProvider } from "./providers.js";

/**
 * Stream a completion from any AI provider.
 * Falls back to non-streaming if provider doesn't support stream().
 *
 * @example
 * ```ts
 * for await (const chunk of streamCompletion(provider, messages)) {
 *   process.stdout.write(chunk.text);
 * }
 * ```
 */
export async function* streamCompletion(
  provider: IAIProvider,
  messages: AIMessage[],
  options: AICompletionOptions = {},
): AsyncIterableIterator<StreamChunk> {
  // Check if provider has a stream method
  const streamable = provider as IAIProvider & {
    stream?: (msgs: AIMessage[], opts?: AICompletionOptions) => AsyncIterableIterator<StreamChunk>;
  };

  /**
   * @param {unknown} streamable.stream
   */
  if (streamable.stream) {
    yield* streamable.stream(messages, options);
    return;
  }

  // Fallback: use complete() and yield the full response as one chunk
  const result = await provider.complete(messages, options);
  yield {
    text: result.content,
    done: true,
    accumulated: result.content,
    usage: result.usage,
  };
}

// ── useStream Client Composable ───────────────────────────

/** Options for useStream() */
export interface UseStreamOptions {
  /** Custom headers for the fetch request */
  headers?: Record<string, string>;
  /** Provider format: 'anthropic' or 'openai' (default: 'openai') */
  format?: "anthropic" | "openai";
  /** Custom fetch function (for testing) */
  fetchFn?: typeof fetch;
}

/** Stream state returned by useStream() */
export interface StreamState {
  /** Full accumulated text */
  fullText: string;
  /** Whether the stream is currently active */
  streaming: boolean;
  /** Whether the stream completed */
  done: boolean;
  /** Token usage (available after completion) */
  usage: { inputTokens: number; outputTokens: number } | null;
  /** Error if stream failed */
  error: Error | null;

  /** Register a callback for each text chunk */
  /**
   * @param {(text: string, accumulated: string} cb
   * @returns {StreamState}
   */
  onChunk(cb: (text: string, accumulated: string) => void): StreamState;
  /** Register a callback for stream completion */
  /**
   * @param {(fullText: string} cb
   * @returns {StreamState}
   */
  onDone(cb: (fullText: string) => void): StreamState;
  /** Register an error callback */
  /**
   * @param {(error: Error} cb
   * @returns {StreamState}
   */
  onError(cb: (error: Error) => void): StreamState;
  /** Start the stream */
  start(): Promise<void>;
  /** Abort the stream */
  abort(): void;
}

/**
 * Client-side composable for consuming streaming AI responses.
 *
 * @example
 * ```ts
 * const stream = useStream('/api/chat', { message: 'Tell me a joke' });
 * stream.onChunk((text) => { chatBubble.textContent += text; });
 * stream.onDone((full) => { console.log('Complete:', full); });
 * await stream.start();
 * ```
 */
export function useStream(
  url: string,
  body: Record<string, unknown>,
  options: UseStreamOptions = {},
): StreamState {
  const chunkCallbacks: Array<(text: string, accumulated: string) => void> = [];
  const doneCallbacks: Array<(fullText: string) => void> = [];
  const errorCallbacks: Array<(error: Error) => void> = [];
  let abortController: AbortController | null = null;

  const state: StreamState = {
    fullText: "",
    streaming: false,
    done: false,
    usage: null,
    error: null,

    onChunk(cb) {
      chunkCallbacks.push(cb);
      return this;
    },
    onDone(cb) {
      doneCallbacks.push(cb);
      return this;
    },
    onError(cb) {
      errorCallbacks.push(cb);
      return this;
    },

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: streaming lifecycle manages fetch, retry, and event parsing branches
    async start() {
      const fetchFn = options.fetchFn ?? globalThis.fetch;
      abortController = new AbortController();
      this.streaming = true;
      this.fullText = "";
      this.error = null;

      try {
        const response = await fetchFn(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...options.headers },
          body: JSON.stringify(body),
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Stream request failed: ${response.status}`);
        }

        const parser = options.format === "anthropic" ? parseAnthropicStream : parseOpenAIStream;

        for await (const chunk of parser(response.body)) {
          if (chunk.text) {
            this.fullText = chunk.accumulated;
            for (const cb of chunkCallbacks) cb(chunk.text, chunk.accumulated);
          }
          if (chunk.done) {
            this.usage = chunk.usage ?? null;
          }
        }

        this.done = true;
        for (const cb of doneCallbacks) cb(this.fullText);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          this.error = err as Error;
          for (const cb of errorCallbacks) cb(this.error);
        }
      } finally {
        this.streaming = false;
      }
    },

    abort() {
      abortController?.abort();
      this.streaming = false;
    },
  };

  return state;
}
