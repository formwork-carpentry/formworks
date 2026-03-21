/**
 * @module @formwork/ai
 * @description MCP Client — connects to external Model Context Protocol servers
 * to discover and invoke tools, read resources, and use prompt templates.
 *
 * WHY: The MCP Server (already built) lets our app EXPOSE tools to AI models.
 * The MCP Client lets our app CONSUME tools from external MCP servers —
 * e.g., connecting to a database MCP server, a Slack MCP server, etc.
 *
 * HOW: Create an McpClient with a transport (HTTP or custom), call discover()
 * to list available tools/resources, then callTool() or readResource() to use them.
 *
 * @patterns Proxy (remote tool invocation), Adapter (transport abstraction)
 * @principles DIP (depends on transport interface), SRP (client protocol only)
 *
 * @example
 * ```ts
 * // Connect to a database MCP server
 * const client = new McpClient({
 *   name: 'db-server',
 *   transport: new HttpMcpTransport('http://localhost:8080/mcp'),
 * });
 *
 * // Discover what's available
 * const capabilities = await client.discover();
 * console.log(capabilities.tools); // [{ name: 'query', description: '...' }, ...]
 *
 * // Call a tool
 * const result = await client.callTool('query', { sql: 'SELECT * FROM users LIMIT 5' });
 * console.log(result.content); // query results
 *
 * // Read a resource
 * const schema = await client.readResource('schema://public/users');
 * ```
 */

// ── Transport Interface ───────────────────────────────────
// Transport abstracts how we communicate with the MCP server.
// HttpMcpTransport sends JSON-RPC over HTTP; other transports
// could use WebSockets, stdio pipes, etc.

export interface IMcpTransport {
  /** Send a JSON-RPC request and receive a response */
  /**
   * @param {McpRequest} request
   * @returns {Promise<McpResponse>}
   */
  send(request: McpRequest): Promise<McpResponse>;
}

/** JSON-RPC-style request to an MCP server */
export interface McpRequest {
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC-style response from an MCP server */
export interface McpResponse {
  result?: unknown;
  error?: { code: number; message: string };
}

// ── MCP Server Capabilities ───────────────────────────────

/** Description of a tool exposed by an MCP server */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

/** Description of a resource exposed by an MCP server */
export interface McpResourceDefinition {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/** Description of a prompt template exposed by an MCP server */
export interface McpPromptDefinition {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

/** Everything an MCP server can do */
export interface McpCapabilities {
  tools: McpToolDefinition[];
  resources: McpResourceDefinition[];
  prompts: McpPromptDefinition[];
  serverName?: string;
  serverVersion?: string;
}

/** Result from calling a tool */
export interface McpToolResult {
  content: unknown;
  isError: boolean;
}

// ── HTTP Transport ────────────────────────────────────────

/**
 * HTTP-based MCP transport. Sends JSON-RPC requests as POST to the server URL.
 *
 * @example
 * ```ts
 * const transport = new HttpMcpTransport('http://localhost:8080/mcp');
 * const response = await transport.send({ method: 'tools/list' });
 * ```
 */
export class HttpMcpTransport implements IMcpTransport {
  constructor(
    private readonly url: string,
    private readonly headers: Record<string, string> = {},
    /** Injected fetch for testing — defaults to globalThis.fetch */
    private readonly fetchFn: typeof fetch = globalThis.fetch,
  ) {}

  /**
   * @param {McpRequest} request
   * @returns {Promise<McpResponse>}
   */
  async send(request: McpRequest): Promise<McpResponse> {
    // MCP uses JSON-RPC 2.0 format over HTTP POST
    const body = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: request.method,
      params: request.params ?? {},
    };

    const response = await this.fetchFn(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...this.headers },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return {
        error: {
          code: response.status,
          message: `HTTP ${response.status}: ${response.statusText}`,
        },
      };
    }

    const data = (await response.json()) as {
      result?: unknown;
      error?: { code: number; message: string };
    };
    return { result: data.result, error: data.error };
  }
}

// ── In-Memory Transport (for testing) ─────────────────────

/**
 * Mock MCP transport that returns pre-configured responses.
 * Use in tests to simulate MCP server behavior without network.
 *
 * @example
 * ```ts
 * const transport = new InMemoryMcpTransport();
 * transport.onMethod('tools/list', { tools: [{ name: 'query', description: 'Run SQL' }] });
 * transport.onMethod('tools/call', { content: [{ type: 'text', text: 'result' }] });
 *
 * const client = new McpClient({ name: 'test', transport });
 * ```
 */
export class InMemoryMcpTransport implements IMcpTransport {
  /** Configured responses keyed by method name */
  private responses = new Map<string, unknown>();
  /** Log of all requests sent through this transport */
  private requestLog: McpRequest[] = [];

  /** Configure a response for a method */
  /**
   * @param {string} method
   * @param {unknown} result
   * @returns {this}
   */
  onMethod(method: string, result: unknown): this {
    this.responses.set(method, result);
    return this;
  }

  /** Get the log of all requests (for test assertions) */
  getRequestLog(): McpRequest[] {
    return [...this.requestLog];
  }

  /** Clear the request log */
  clearLog(): void {
    this.requestLog = [];
  }

  /**
   * @param {McpRequest} request
   * @returns {Promise<McpResponse>}
   */
  async send(request: McpRequest): Promise<McpResponse> {
    this.requestLog.push(request);
    const result = this.responses.get(request.method);
    if (result === undefined) {
      return { error: { code: -1, message: `No mock configured for method: ${request.method}` } };
    }
    return { result };
  }
}

// ── MCP Client ────────────────────────────────────────────

/**
 * MCP Client — discovers and invokes capabilities of an external MCP server.
 *
 * Lifecycle:
 * 1. Create client with a transport
 * 2. Call discover() to learn what the server offers
 * 3. Call callTool(), readResource(), or getPrompt() as needed
 *
 * @example
 * ```ts
 * const client = new McpClient({
 *   name: 'slack-mcp',
 *   transport: new HttpMcpTransport('http://mcp.slack.internal/rpc'),
 * });
 *
 * const caps = await client.discover();
 * console.log(`Server offers ${caps.tools.length} tools`);
 *
 * const result = await client.callTool('send_message', {
 *   channel: '#general',
 *   text: 'Hello from Carpenter!',
 * });
 * ```
 */
export class McpClient {
  private readonly name: string;
  private readonly transport: IMcpTransport;
  /** Cached capabilities from last discover() call */
  private capabilities: McpCapabilities | null = null;

  constructor(config: { name: string; transport: IMcpTransport }) {
    this.name = config.name;
    this.transport = config.transport;
  }

  /**
   * Discover the server's capabilities — tools, resources, prompts.
   * Caches the result; call refresh() to re-fetch.
   */
  async discover(): Promise<McpCapabilities> {
    // Fetch tools, resources, and prompts in parallel
    const [toolsRes, resourcesRes, promptsRes] = await Promise.all([
      this.transport.send({ method: "tools/list" }),
      this.transport.send({ method: "resources/list" }),
      this.transport.send({ method: "prompts/list" }),
    ]);

    this.capabilities = {
      tools: (toolsRes.result as { tools?: McpToolDefinition[] })?.tools ?? [],
      resources: (resourcesRes.result as { resources?: McpResourceDefinition[] })?.resources ?? [],
      prompts: (promptsRes.result as { prompts?: McpPromptDefinition[] })?.prompts ?? [],
    };

    return this.capabilities;
  }

  /**
   * Call a tool on the MCP server.
   *
   * @param toolName - Name of the tool to call (from discover().tools)
   * @param args - Arguments to pass to the tool
   * @returns Tool execution result
   * @throws Error if the server returns an error
   */
  async callTool(toolName: string, args: Record<string, unknown> = {}): Promise<McpToolResult> {
    const response = await this.transport.send({
      method: "tools/call",
      params: { name: toolName, arguments: args },
    });

    if (response.error) {
      throw new Error(`MCP tool "${toolName}" failed: ${response.error.message}`);
    }

    const result = (response.result as { content?: unknown; isError?: boolean }) ?? {};
    return { content: result.content ?? result, isError: result.isError ?? false };
  }

  /**
   * Read a resource from the MCP server.
   *
   * @param uri - Resource URI (e.g., 'schema://public/users', 'file:///etc/config.json')
   * @returns Resource content
   */
  async readResource(uri: string): Promise<unknown> {
    const response = await this.transport.send({
      method: "resources/read",
      params: { uri },
    });

    if (response.error) {
      throw new Error(`MCP resource "${uri}" failed: ${response.error.message}`);
    }

    return response.result;
  }

  /**
   * Get a prompt template from the MCP server.
   *
   * @param name - Prompt name (from discover().prompts)
   * @param args - Arguments to fill into the template
   * @returns Rendered prompt messages
   */
  async getPrompt(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const response = await this.transport.send({
      method: "prompts/get",
      params: { name, arguments: args },
    });

    if (response.error) {
      throw new Error(`MCP prompt "${name}" failed: ${response.error.message}`);
    }

    return response.result;
  }

  /** Get cached capabilities (null if discover() not called yet) */
  getCapabilities(): McpCapabilities | null {
    return this.capabilities;
  }

  /** Get the client name */
  getName(): string {
    return this.name;
  }

  /** Check if a specific tool is available */
  /**
   * @param {string} name
   * @returns {boolean}
   */
  hasTool(name: string): boolean {
    return this.capabilities?.tools.some((t) => t.name === name) ?? false;
  }

  /** Check if a specific resource is available */
  /**
   * @param {string} uri
   * @returns {boolean}
   */
  hasResource(uri: string): boolean {
    return this.capabilities?.resources.some((r) => r.uri === uri) ?? false;
  }
}
