/**
 * @module @carpentry/ai
 * @description HTTP-based AI providers for Anthropic Claude and OpenAI GPT APIs
 * @patterns Adapter (each provider normalizes a different API), Strategy (configurable provider)
 * @principles LSP (all providers substitutable), SRP (each provider handles one API)
 */

// ── Common Types ──────────────────────────────────────────

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
  stream?: boolean;
}

export interface AICompletionResult {
  content: string;
  model: string;
  usage: { inputTokens: number; outputTokens: number };
  finishReason: string;
  provider: string;
}

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
  defaultMaxTokens?: number;
  headers?: Record<string, string>;
  /** Custom fetch for testing */
  fetchFn?: typeof fetch;
}

export interface IAIProvider {
  /**
   * @param {AIMessage[]} messages
   * @param {AICompletionOptions} [options]
   * @returns {Promise<AICompletionResult>}
   */
  complete(messages: AIMessage[], options?: AICompletionOptions): Promise<AICompletionResult>;
  getProviderName(): string;
}

// ── Anthropic Provider ────────────────────────────────────

/**
 * Anthropic Claude API provider.
 *
 * @example
 * ```ts
 * const ai = new AnthropicProvider({ apiKey: env('ANTHROPIC_API_KEY') });
 * const result = await ai.complete([
 *   { role: 'user', content: 'Explain TypeScript generics in one paragraph.' }
 * ]);
 * console.log(result.content);
 * ```
 */
export class AnthropicProvider implements IAIProvider {
  private readonly config: AIProviderConfig;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl ?? "https://api.anthropic.com";
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
  }

  getProviderName(): string {
    return "anthropic";
  }

  /**
   * @param {AIMessage[]} messages
   * @param {AICompletionOptions} [options]
   * @returns {Promise<AICompletionResult>}
   */
  async complete(
    messages: AIMessage[],
    options: AICompletionOptions = {},
  ): Promise<AICompletionResult> {
    const body = this.buildBody(messages, options);

    const response = await this.fetchFn(`${this.baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.config.apiKey,
        "anthropic-version": "2023-06-01",
        ...this.config.headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${errorBody}`);
    }

    return this.parseResponse((await response.json()) as Record<string, unknown>);
  }

  /** Build the Anthropic API request body — system message extracted to top level */
  private buildBody(messages: AIMessage[], options: AICompletionOptions): Record<string, unknown> {
    const systemMsg = messages.find((m) => m.role === "system");
    const userMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));
    const body: Record<string, unknown> = {
      model: options.model ?? this.config.defaultModel ?? "claude-sonnet-4-20250514",
      max_tokens: options.maxTokens ?? this.config.defaultMaxTokens ?? 1024,
      messages: userMessages,
    };
    if (systemMsg) body.system = systemMsg.content;
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.topP !== undefined) body.top_p = options.topP;
    if (options.stopSequences) body.stop_sequences = options.stopSequences;
    return body;
  }

  /** Parse the Anthropic API response into our standard format */
  private parseResponse(data: Record<string, unknown>): AICompletionResult {
    const content = data.content as Array<{ text: string }>;
    const usage = data.usage as { input_tokens: number; output_tokens: number };
    return {
      content: content.map((c) => c.text).join(""),
      model: data.model as string,
      usage: { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens },
      finishReason: data.stop_reason as string,
      provider: "anthropic",
    };
  }
}

// ── OpenAI Provider ───────────────────────────────────────

/**
 * OpenAI GPT API provider.
 *
 * @example
 * ```ts
 * const ai = new OpenAIProvider({ apiKey: env('OPENAI_API_KEY') });
 * const result = await ai.complete([
 *   { role: 'system', content: 'You are a helpful assistant.' },
 *   { role: 'user', content: 'What is TypeScript?' }
 * ]);
 * ```
 */
export class OpenAIProvider implements IAIProvider {
  private readonly config: AIProviderConfig;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.baseUrl = config.baseUrl ?? "https://api.openai.com";
    this.fetchFn = config.fetchFn ?? globalThis.fetch;
  }

  getProviderName(): string {
    return "openai";
  }

  /**
   * @param {AIMessage[]} messages
   * @param {AICompletionOptions} [options]
   * @returns {Promise<AICompletionResult>}
   */
  async complete(
    messages: AIMessage[],
    options: AICompletionOptions = {},
  ): Promise<AICompletionResult> {
    const body = this.buildBody(messages, options);

    const response = await this.fetchFn(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
        ...this.config.headers,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string }; finish_reason: string }>;
      model: string;
      usage: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content ?? "",
      model: data.model,
      usage: { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens },
      finishReason: data.choices[0]?.finish_reason ?? "unknown",
      provider: "openai",
    };
  }

  /** Build the OpenAI chat completions request body */
  protected buildBody(
    messages: AIMessage[],
    options: AICompletionOptions,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: options.model ?? this.config.defaultModel ?? "gpt-4o",
      max_tokens: options.maxTokens ?? this.config.defaultMaxTokens ?? 1024,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    };
    if (options.temperature !== undefined) body.temperature = options.temperature;
    if (options.topP !== undefined) body.top_p = options.topP;
    if (options.stopSequences) body.stop = options.stopSequences;
    return body;
  }
}

// ── Groq Provider (OpenAI-compatible API) ─────────────────

/**
 * Groq API provider — uses OpenAI-compatible API format with Groq's endpoint.
 */
export class GroqProvider extends OpenAIProvider {
  constructor(config: AIProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? "https://api.groq.com/openai",
      defaultModel: config.defaultModel ?? "llama-3.3-70b-versatile",
    });
  }
  getProviderName(): string {
    return "groq";
  }
}

// ── Ollama Provider (OpenAI-compatible, local) ────────────

/**
 * Ollama provider — local LLM inference with OpenAI-compatible API.
 */
export class OllamaProvider extends OpenAIProvider {
  constructor(config: Omit<AIProviderConfig, "apiKey"> & { apiKey?: string }) {
    super({
      apiKey: config.apiKey ?? "ollama",
      baseUrl: config.baseUrl ?? "http://localhost:11434",
      defaultModel: config.defaultModel ?? "llama3.2",
      ...config,
    });
  }
  getProviderName(): string {
    return "ollama";
  }
}

// ── AI Manager (config-driven provider resolution) ────────

/**
 * AIManager — resolves AI providers by name from config.
 *
 * @example
 * ```ts
 * const manager = new AIManager('anthropic', {
 *   anthropic: { driver: 'anthropic', apiKey: env('ANTHROPIC_API_KEY') },
 *   openai: { driver: 'openai', apiKey: env('OPENAI_API_KEY') },
 * });
 * const ai = manager.provider(); // default
 * const openai = manager.provider('openai');
 * ```
 */
export class AIManager {
  private providers = new Map<string, IAIProvider>();
  private factories = new Map<string, (config: Record<string, unknown>) => IAIProvider>();

  constructor(
    private defaultProvider = "mock",
    private configs: Record<string, Record<string, unknown>> = {},
  ) {
    this.registerBuiltInDrivers();
  }

  /**
   * @param {string} name
   * @param {(config: Object} factory
   * @returns {this}
   */
  registerDriver(name: string, factory: (config: Record<string, unknown>) => IAIProvider): this {
    this.factories.set(name, factory);
    return this;
  }

  /**
   * @param {string} [name]
   * @returns {IAIProvider}
   */
  provider(name?: string): IAIProvider {
    const providerName = name ?? this.defaultProvider;
    const cached = this.providers.get(providerName);
    if (cached) return cached;

    const config = this.configs[providerName];
    if (!config) throw new Error(`AI provider "${providerName}" is not configured.`);

    const driver = (config.driver as string) ?? providerName;
    const factory = this.factories.get(driver);
    if (!factory) throw new Error(`AI driver "${driver}" is not registered.`);

    const instance = factory(config);
    this.providers.set(providerName, instance);
    return instance;
  }

  private registerBuiltInDrivers(): void {
    this.factories.set(
      "anthropic",
      (cfg) =>
        new AnthropicProvider({
          apiKey: cfg.apiKey as string,
          defaultModel: cfg.model as string | undefined,
          fetchFn: cfg.fetchFn as typeof fetch | undefined,
        }),
    );
    this.factories.set(
      "openai",
      (cfg) =>
        new OpenAIProvider({
          apiKey: cfg.apiKey as string,
          defaultModel: cfg.model as string | undefined,
          fetchFn: cfg.fetchFn as typeof fetch | undefined,
        }),
    );
    this.factories.set(
      "groq",
      (cfg) =>
        new GroqProvider({
          apiKey: cfg.apiKey as string,
          defaultModel: cfg.model as string | undefined,
          fetchFn: cfg.fetchFn as typeof fetch | undefined,
        }),
    );
    this.factories.set(
      "ollama",
      (cfg) =>
        new OllamaProvider({
          baseUrl: cfg.baseUrl as string | undefined,
          defaultModel: cfg.model as string | undefined,
          fetchFn: cfg.fetchFn as typeof fetch | undefined,
        }),
    );
  }
}
