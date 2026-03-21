/**
 * @module @formwork/mcp
 * @description Model Context Protocol — expose Carpenter resources and tools to AI models
 *
 * Architecture:
 *   McpServer registers tools (functions AI can call) and resources (data AI can read)
 *   Each tool has a schema (JSON Schema for parameters) and a handler
 *   InMemoryMcpServer enables testing tool definitions and handler logic
 *
 * @patterns Command (tools), Registry (tool/resource registration), Adapter (protocol handling)
 * @principles OCP — new tools/resources registered dynamically
 *             SRP — tool definition separate from execution
 *
 * @example
 * ```ts
 * import { McpServer } from '@formwork/mcp';
 *
 * const server = new McpServer();
 *
 * server.tool({
 *   name: 'add',
 *   description: 'Add two numbers',
 *   inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } } },
 *   handler: async (input) => ({
 *     content: [{ type: 'text', text: String((input.a as number) + (input.b as number)) }],
 *   }),
 * });
 *
 * server.resource({
 *   uri: 'res://greeting',
 *   name: 'Greeting',
 *   mimeType: 'text/plain',
 *   handler: async () => ({ uri: 'res://greeting', mimeType: 'text/plain', text: 'Hello!' }),
 * });
 *
 * server.prompt({
 *   name: 'code_review',
 *   description: 'Simple prompt',
 *   arguments: [{ name: 'language', required: true }],
 *   handler: async (args) => ({ messages: [{ role: 'user', content: `Review ${args.language}` }] }),
 * });
 *
 * const toolResult = await server.callTool('add', { a: 1, b: 2 });
 * const resource = await server.readResource('res://greeting');
 * const prompt = await server.getPrompt('code_review', { language: 'TypeScript' });
 * ```
 */

// ── Tool Definition ───────────────────────────────────────

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>; // JSON Schema
  handler: McpToolHandler;
}

export type McpToolHandler = (
  input: Record<string, unknown>,
  context: McpContext,
) => Promise<McpToolResult>;

export interface McpToolResult {
  content: Array<
    { type: "text"; text: string } | { type: "image"; data: string; mimeType: string }
  >;
  isError?: boolean;
}

// ── Resource Definition ───────────────────────────────────

export interface McpResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  handler: McpResourceHandler;
}

export type McpResourceHandler = (uri: string, context: McpContext) => Promise<McpResourceContent>;

export interface McpResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: string; // base64
}

// ── Prompt Template ───────────────────────────────────────

export interface McpPromptDefinition {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
  handler: McpPromptHandler;
}

export type McpPromptHandler = (
  args: Record<string, string>,
  context: McpContext,
) => Promise<McpPromptResult>;

export interface McpPromptResult {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
}

// ── Context ───────────────────────────────────────────────

export interface McpContext {
  /** Current authenticated user (if any) */
  userId?: string | number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

// ── MCP Server ────────────────────────────────────────────

/**
 * McpServer — in-memory MCP server for registering tools/resources/prompts and executing them.
 *
 * This class is framework-agnostic: it does not bind to a specific transport/protocol
 * implementation; instead, it provides a structured registry plus local execution helpers.
 *
 * @example
 * ```ts
 * const server = new McpServer();
 *
 * server
 *   .tool({
 *     name: 'add',
 *     description: 'Add two numbers',
 *     inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } } },
 *     handler: async (input) => ({
 *       content: [{ type: 'text', text: String((input.a as number) + (input.b as number)) }],
 *     }),
 *   });
 *
 * const result = await server.callTool('add', { a: 1, b: 2 });
 * // result.content[0].text === '3'
 * ```
 */
export class McpServer {
  private tools = new Map<string, McpToolDefinition>();
  private resources = new Map<string, McpResourceDefinition>();
  private prompts = new Map<string, McpPromptDefinition>();
  private callLog: Array<{
    type: "tool" | "resource" | "prompt";
    name: string;
    input: unknown;
    timestamp: Date;
  }> = [];

  /** Register a tool */
  /**
   * @param {McpToolDefinition} definition
   * @returns {this}
   */
  tool(definition: McpToolDefinition): this {
    this.tools.set(definition.name, definition);
    return this;
  }

  /** Register a resource */
  /**
   * @param {McpResourceDefinition} definition
   * @returns {this}
   */
  resource(definition: McpResourceDefinition): this {
    this.resources.set(definition.uri, definition);
    return this;
  }

  /** Register a prompt template */
  /**
   * @param {McpPromptDefinition} definition
   * @returns {this}
   */
  prompt(definition: McpPromptDefinition): this {
    this.prompts.set(definition.name, definition);
    return this;
  }

  /** Execute a tool by name */
  /**
   * @param {string} name
   * @param {Object} input
   * @param {McpContext} [context]
   * @returns {Promise<McpToolResult>}
   */
  async callTool(
    name: string,
    input: Record<string, unknown>,
    context: McpContext = {},
  ): Promise<McpToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { content: [{ type: "text", text: `Tool "${name}" not found.` }], isError: true };
    }
    this.callLog.push({ type: "tool", name, input, timestamp: new Date() });
    return tool.handler(input, context);
  }

  /** Read a resource by URI */
  /**
   * @param {string} uri
   * @param {McpContext} [context]
   * @returns {Promise<McpResourceContent>}
   */
  async readResource(uri: string, context: McpContext = {}): Promise<McpResourceContent> {
    const resource = this.resources.get(uri);
    if (!resource) throw new Error(`Resource "${uri}" not found.`);
    this.callLog.push({ type: "resource", name: uri, input: {}, timestamp: new Date() });
    return resource.handler(uri, context);
  }

  /** Get a prompt by name */
  /**
   * @param {string} name
   * @param {Record<string, string>} [args]
   * @param {McpContext} [context]
   * @returns {Promise<McpPromptResult>}
   */
  async getPrompt(
    name: string,
    args: Record<string, string> = {},
    context: McpContext = {},
  ): Promise<McpPromptResult> {
    const prompt = this.prompts.get(name);
    if (!prompt) throw new Error(`Prompt "${name}" not found.`);
    this.callLog.push({ type: "prompt", name, input: args, timestamp: new Date() });
    return prompt.handler(args, context);
  }

  // ── Listing ─────────────────────────────────────────────

  listTools(): Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  listResources(): Array<{ uri: string; name: string; description?: string; mimeType?: string }> {
    return [...this.resources.values()].map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    }));
  }

  listPrompts(): Array<{
    name: string;
    description?: string;
    arguments?: Array<{ name: string; required?: boolean }>;
  }> {
    return [...this.prompts.values()].map((p) => ({
      name: p.name,
      description: p.description,
      arguments: p.arguments,
    }));
  }

  /**
   * @param {string} name
   * @returns {boolean}
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
  /**
   * @param {string} uri
   * @returns {boolean}
   */
  hasResource(uri: string): boolean {
    return this.resources.has(uri);
  }

  // ── Test Assertions ─────────────────────────────────────

  getCallLog() {
    return [...this.callLog];
  }

  /**
   * @param {string} name
   */
  assertToolCalled(name: string): void {
    if (!this.callLog.some((c) => c.type === "tool" && c.name === name)) {
      throw new Error(`Expected tool "${name}" to be called, but it was not.`);
    }
  }

  /**
   * @param {string} name
   * @param {Object} expectedInput
   */
  assertToolCalledWith(name: string, expectedInput: Record<string, unknown>): void {
    const match = this.callLog.find(
      (c) =>
        c.type === "tool" &&
        c.name === name &&
        JSON.stringify(c.input) === JSON.stringify(expectedInput),
    );
    if (!match)
      throw new Error(`Expected tool "${name}" called with ${JSON.stringify(expectedInput)}.`);
  }

  /**
   * @param {string} uri
   */
  assertResourceRead(uri: string): void {
    if (!this.callLog.some((c) => c.type === "resource" && c.name === uri)) {
      throw new Error(`Expected resource "${uri}" to be read, but it was not.`);
    }
  }

  /**
   * @param {number} count
   */
  assertCallCount(count: number): void {
    if (this.callLog.length !== count)
      throw new Error(`Expected ${count} MCP calls, got ${this.callLog.length}.`);
  }

  reset(): void {
    this.tools.clear();
    this.resources.clear();
    this.prompts.clear();
    this.callLog = [];
  }
}
