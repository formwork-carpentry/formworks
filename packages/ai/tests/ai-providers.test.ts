/**
 * @module @formwork/ai
 * @description Tests for AI providers, AIManager, and Agent (ReAct loop).
 *
 * Test strategy:
 * - All providers tested with mock fetch — no real API calls
 * - Mock fetch captures request URL, headers, body for assertion
 * - Agent tested with mock IAIProvider returning scripted responses
 * - Tools are simple functions that return predictable results
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  AnthropicProvider, OpenAIProvider, GroqProvider, OllamaProvider, AIManager,
} from '../src/providers.js';
import type { IAIProvider, AIMessage, AICompletionResult } from '../src/providers.js';
import { Agent } from '../src/Agent.js';
import type { AgentTool, AgentStep } from '../src/Agent.js';

// ── Mock Fetch Factory ────────────────────────────────────
// Creates a fetch mock that returns a configured response
// and captures the request for assertion.

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

function createMockFetch(
  responseBody: Record<string, unknown>,
  status = 200,
): { fetch: typeof fetch; captured: CapturedRequest } {
  const captured: CapturedRequest = { url: '', method: '', headers: {}, body: {} };

  const mockFetch: typeof fetch = async (url: string | URL | Request, init?: RequestInit) => {
    captured.url = String(url);
    captured.method = init?.method ?? 'GET';
    captured.headers = Object.fromEntries(Object.entries(init?.headers ?? {}));
    if (init?.body) captured.body = JSON.parse(init.body as string);

    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  return { fetch: mockFetch, captured };
}

// ── Mock AI Provider ──────────────────────────────────────
// Returns scripted responses in order. Used for Agent testing.

function createMockAI(responses: string[]): IAIProvider {
  let index = 0;
  return {
    getProviderName: () => 'mock',
    complete: async (): Promise<AICompletionResult> => ({
      content: responses[index++ % responses.length],
      model: 'mock-model',
      usage: { inputTokens: 10, outputTokens: 5 },
      finishReason: 'stop',
      provider: 'mock',
    }),
  };
}

// ═══════════════════════════════════════════════════════════
// ANTHROPIC PROVIDER
// ═══════════════════════════════════════════════════════════

describe('@formwork/ai: AnthropicProvider', () => {
  it('sends messages in Anthropic format (system separate from messages)', async () => {
    const { fetch, captured } = createMockFetch({
      content: [{ type: 'text', text: 'Hello from Claude!' }],
      model: 'claude-sonnet-4-20250514',
      usage: { input_tokens: 12, output_tokens: 8 },
      stop_reason: 'end_turn',
    });

    const provider = new AnthropicProvider({ apiKey: 'sk-ant-test', fetchFn: fetch });
    const result = await provider.complete([
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: 'Hello' },
    ]);

    // System message is extracted and sent as top-level 'system' field
    expect(captured.body['system']).toBe('Be concise.');
    // Only non-system messages go in the messages array
    expect((captured.body['messages'] as unknown[]).length).toBe(1);
    // Auth header uses x-api-key (Anthropic convention)
    expect(captured.headers['x-api-key']).toBe('sk-ant-test');
    // Result is correctly parsed
    expect(result.content).toBe('Hello from Claude!');
    expect(result.provider).toBe('anthropic');
    expect(result.usage.inputTokens).toBe(12);
    expect(result.usage.outputTokens).toBe(8);
  });

  it('sends completion options (temperature, topP, maxTokens)', async () => {
    const { fetch, captured } = createMockFetch({
      content: [{ type: 'text', text: 'ok' }],
      model: 'claude-sonnet-4-20250514', usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: 'stop',
    });

    const provider = new AnthropicProvider({ apiKey: 'x', fetchFn: fetch });
    await provider.complete(
      [{ role: 'user', content: 'test' }],
      { temperature: 0.7, topP: 0.9, maxTokens: 500, model: 'claude-haiku-4-5-20251001' },
    );

    expect(captured.body['temperature']).toBe(0.7);
    expect(captured.body['top_p']).toBe(0.9);
    expect(captured.body['max_tokens']).toBe(500);
    expect(captured.body['model']).toBe('claude-haiku-4-5-20251001');
  });

  it('throws on API error with status and body', async () => {
    const { fetch } = createMockFetch({ error: { type: 'invalid_api_key' } }, 401);
    const provider = new AnthropicProvider({ apiKey: 'bad-key', fetchFn: fetch });

    await expect(provider.complete([{ role: 'user', content: 'Hi' }]))
      .rejects.toThrow('Anthropic API error (401)');
  });

  it('returns correct provider name', () => {
    const { fetch } = createMockFetch({});
    expect(new AnthropicProvider({ apiKey: 'x', fetchFn: fetch }).getProviderName()).toBe('anthropic');
  });
});

// ═══════════════════════════════════════════════════════════
// OPENAI PROVIDER
// ═══════════════════════════════════════════════════════════

describe('@formwork/ai: OpenAIProvider', () => {
  it('sends messages in OpenAI chat completions format', async () => {
    const { fetch, captured } = createMockFetch({
      choices: [{ message: { content: 'Hi from GPT!' }, finish_reason: 'stop' }],
      model: 'gpt-4o',
      usage: { prompt_tokens: 8, completion_tokens: 4 },
    });

    const provider = new OpenAIProvider({ apiKey: 'sk-openai-test', fetchFn: fetch });
    const result = await provider.complete([
      { role: 'system', content: 'Be helpful.' },
      { role: 'user', content: 'Hello' },
    ]);

    // OpenAI keeps system messages inline
    expect((captured.body['messages'] as unknown[]).length).toBe(2);
    // Auth uses Bearer token
    expect(captured.headers['Authorization']).toBe('Bearer sk-openai-test');
    // URL includes /v1/chat/completions
    expect(captured.url).toContain('/v1/chat/completions');
    // Result
    expect(result.content).toBe('Hi from GPT!');
    expect(result.provider).toBe('openai');
  });

  it('throws on API error', async () => {
    const { fetch } = createMockFetch({ error: 'bad request' }, 400);
    const provider = new OpenAIProvider({ apiKey: 'x', fetchFn: fetch });
    await expect(provider.complete([{ role: 'user', content: 'x' }]))
      .rejects.toThrow('OpenAI API error (400)');
  });
});

// ═══════════════════════════════════════════════════════════
// GROQ + OLLAMA (OpenAI-compatible)
// ═══════════════════════════════════════════════════════════

describe('@formwork/ai: GroqProvider', () => {
  it('uses Groq base URL and provider name', () => {
    const { fetch } = createMockFetch({});
    const p = new GroqProvider({ apiKey: 'x', fetchFn: fetch });
    expect(p.getProviderName()).toBe('groq');
  });
});

describe('@formwork/ai: OllamaProvider', () => {
  it('defaults to localhost:11434 and no API key required', () => {
    const { fetch } = createMockFetch({});
    const p = new OllamaProvider({ fetchFn: fetch });
    expect(p.getProviderName()).toBe('ollama');
  });
});

// ═══════════════════════════════════════════════════════════
// AI MANAGER
// ═══════════════════════════════════════════════════════════

describe('@formwork/ai: AIManager', () => {
  it('resolves default provider', () => {
    const { fetch } = createMockFetch({});
    const manager = new AIManager('anthropic', {
      anthropic: { driver: 'anthropic', apiKey: 'x', fetchFn: fetch },
    });
    expect(manager.provider().getProviderName()).toBe('anthropic');
  });

  it('resolves named provider', () => {
    const { fetch } = createMockFetch({});
    const manager = new AIManager('anthropic', {
      anthropic: { driver: 'anthropic', apiKey: 'x', fetchFn: fetch },
      openai: { driver: 'openai', apiKey: 'y', fetchFn: fetch },
    });
    expect(manager.provider('openai').getProviderName()).toBe('openai');
  });

  it('caches provider instances (singleton)', () => {
    const { fetch } = createMockFetch({});
    const manager = new AIManager('anthropic', {
      anthropic: { driver: 'anthropic', apiKey: 'x', fetchFn: fetch },
    });
    expect(manager.provider()).toBe(manager.provider());
  });

  it('throws for unconfigured provider', () => {
    const manager = new AIManager('nope', {});
    expect(() => manager.provider()).toThrow('not configured');
  });

  it('supports custom drivers', () => {
    const { fetch } = createMockFetch({});
    const custom: IAIProvider = { getProviderName: () => 'custom', complete: async () => ({ content: 'x', model: 'x', usage: { inputTokens: 0, outputTokens: 0 }, finishReason: 'stop', provider: 'custom' }) };
    const manager = new AIManager('my', { my: { driver: 'my-driver' } });
    manager.registerDriver('my-driver', () => custom);
    expect(manager.provider().getProviderName()).toBe('custom');
  });
});

// ═══════════════════════════════════════════════════════════
// AI AGENT (ReAct Loop)
// ═══════════════════════════════════════════════════════════

describe('@formwork/ai: Agent', () => {
  describe('direct answer (no tools needed)', () => {
    it('returns FINAL_ANSWER immediately', async () => {
      const agent = new Agent({
        provider: createMockAI(['FINAL_ANSWER: Paris is the capital of France.']),
        tools: [],
      });
      const result = await agent.run('Capital of France?');
      expect(result.answer).toBe('Paris is the capital of France.');
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].type).toBe('final_answer');
    });
  });

  describe('tool calling', () => {
    const calculator: AgentTool = {
      name: 'calculator',
      description: 'Evaluate a math expression',
      parameters: { expression: { type: 'string', description: 'The math expression', required: true } },
      execute: async (args) => {
        // Safe eval for testing only
        const expr = String(args['expression']);
        if (expr === '42 * 2') return '84';
        return 'unknown';
      },
    };

    it('executes tool and uses observation in next step', async () => {
      const agent = new Agent({
        provider: createMockAI([
          'THOUGHT: I need to calculate 42 * 2\nACTION: calculator\nARGS: {"expression": "42 * 2"}',
          'THOUGHT: The calculator returned 84\nFINAL_ANSWER: 42 × 2 = 84',
        ]),
        tools: [calculator],
      });

      const result = await agent.run('What is 42 times 2?');
      expect(result.answer).toBe('42 × 2 = 84');

      // Verify the step sequence: thought → action → observation → thought → final_answer
      const types = result.steps.map((s) => s.type);
      expect(types).toContain('thought');
      expect(types).toContain('action');
      expect(types).toContain('observation');
      expect(types).toContain('final_answer');

      // Verify the observation contains the tool's actual output
      const obs = result.steps.find((s) => s.type === 'observation');
      expect(obs?.content).toBe('84');
    });

    it('handles unknown tool name gracefully', async () => {
      const agent = new Agent({
        provider: createMockAI([
          'ACTION: nonexistent\nARGS: {}',
          'FINAL_ANSWER: I could not find that tool.',
        ]),
        tools: [],
      });

      const result = await agent.run('Use a tool');
      const obs = result.steps.find((s) => s.type === 'observation');
      expect(obs?.content).toContain('not found');
    });

    it('handles tool execution errors gracefully', async () => {
      const broken: AgentTool = {
        name: 'broken',
        description: 'Always throws',
        execute: async () => { throw new Error('Connection refused'); },
      };

      const agent = new Agent({
        provider: createMockAI([
          'ACTION: broken\nARGS: {}',
          'FINAL_ANSWER: The tool encountered an error.',
        ]),
        tools: [broken],
      });

      const result = await agent.run('Try broken tool');
      const obs = result.steps.find((s) => s.type === 'observation');
      expect(obs?.content).toContain('Connection refused');
    });
  });

  describe('step limits', () => {
    it('stops at maxSteps to prevent infinite loops', async () => {
      // Provider always returns an action — never a final answer
      const agent = new Agent({
        provider: createMockAI(['ACTION: search\nARGS: {"q":"test"}']),
        tools: [{ name: 'search', description: 'Search', execute: async () => 'No results' }],
        maxSteps: 3,
      });

      const result = await agent.run('Keep searching forever');
      expect(result.maxStepsReached).toBe(true);
      expect(result.answer).toContain('maximum step limit');
    });
  });

  describe('step callbacks', () => {
    it('fires onStep for every step (useful for streaming UI)', async () => {
      const logged: AgentStep[] = [];

      const agent = new Agent({
        provider: createMockAI(['THOUGHT: Analyzing\nFINAL_ANSWER: Done']),
        tools: [],
        onStep: (step) => logged.push(step),
      });

      await agent.run('Test');
      expect(logged.length).toBeGreaterThan(0);
      expect(logged.every((s) => s.timestamp > 0)).toBe(true);
    });
  });

  describe('getToolNames', () => {
    it('returns list of registered tool names', () => {
      const agent = new Agent({
        provider: createMockAI([]),
        tools: [
          { name: 'search', description: 'Web search', execute: async () => '' },
          { name: 'calculator', description: 'Math', execute: async () => '' },
          { name: 'weather', description: 'Weather lookup', execute: async () => '' },
        ],
      });
      expect(agent.getToolNames()).toEqual(['search', 'calculator', 'weather']);
    });
  });
});
