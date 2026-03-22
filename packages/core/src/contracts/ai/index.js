/**
 * @module @formwork/core/contracts/ai
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
export {};
//# sourceMappingURL=index.js.map