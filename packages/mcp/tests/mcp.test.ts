import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '../src/index.js';

describe('@formwork/mcp: McpServer', () => {
  let server: McpServer;

  beforeEach(() => {
    server = new McpServer();
  });

  describe('tools', () => {
    it('registers and calls a tool', async () => {
      server.tool({
        name: 'get_weather',
        description: 'Get weather for a city',
        inputSchema: { type: 'object', properties: { city: { type: 'string' } } },
        handler: async (input) => ({
          content: [{ type: 'text', text: `Weather in ${input['city']}: Sunny, 25°C` }],
        }),
      });

      const result = await server.callTool('get_weather', { city: 'Tokyo' });
      expect(result.content[0]).toEqual({ type: 'text', text: 'Weather in Tokyo: Sunny, 25°C' });
      expect(result.isError).toBeUndefined();
    });

    it('returns error for unknown tool', async () => {
      const result = await server.callTool('nonexistent', {});
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('not found');
    });

    it('passes context to handler', async () => {
      let receivedCtx: unknown;
      server.tool({
        name: 'ctx_tool',
        description: 'Test context',
        inputSchema: {},
        handler: async (_input, ctx) => {
          receivedCtx = ctx;
          return { content: [{ type: 'text', text: 'ok' }] };
        },
      });

      await server.callTool('ctx_tool', {}, { userId: 42, metadata: { tenant: 'acme' } });
      expect((receivedCtx as { userId: number }).userId).toBe(42);
    });

    it('listTools() returns tool definitions', () => {
      server.tool({ name: 'a', description: 'Tool A', inputSchema: {}, handler: async () => ({ content: [] }) });
      server.tool({ name: 'b', description: 'Tool B', inputSchema: { type: 'object' }, handler: async () => ({ content: [] }) });

      const tools = server.listTools();
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('a');
      expect(tools[1].description).toBe('Tool B');
    });

    it('hasTool()', () => {
      server.tool({ name: 'exists', description: '', inputSchema: {}, handler: async () => ({ content: [] }) });
      expect(server.hasTool('exists')).toBe(true);
      expect(server.hasTool('nope')).toBe(false);
    });
  });

  describe('resources', () => {
    it('registers and reads a resource', async () => {
      server.resource({
        uri: 'carpenter://config/database',
        name: 'Database Config',
        mimeType: 'application/json',
        handler: async () => ({
          uri: 'carpenter://config/database',
          mimeType: 'application/json',
          text: JSON.stringify({ host: 'localhost', port: 5432 }),
        }),
      });

      const content = await server.readResource('carpenter://config/database');
      expect(content.mimeType).toBe('application/json');
      expect(JSON.parse(content.text!)).toEqual({ host: 'localhost', port: 5432 });
    });

    it('throws for unknown resource', async () => {
      await expect(server.readResource('carpenter://nope')).rejects.toThrow('not found');
    });

    it('listResources()', () => {
      server.resource({ uri: 'a://1', name: 'R1', handler: async () => ({ uri: 'a://1', mimeType: 'text/plain' }) });
      expect(server.listResources()).toHaveLength(1);
      expect(server.listResources()[0].name).toBe('R1');
    });

    it('hasResource()', () => {
      server.resource({ uri: 'a://1', name: 'R1', handler: async () => ({ uri: 'a://1', mimeType: 'text/plain' }) });
      expect(server.hasResource('a://1')).toBe(true);
      expect(server.hasResource('nope')).toBe(false);
    });
  });

  describe('prompts', () => {
    it('registers and gets a prompt', async () => {
      server.prompt({
        name: 'code_review',
        description: 'Review code changes',
        arguments: [{ name: 'language', required: true }],
        handler: async (args) => ({
          messages: [
            { role: 'user', content: `Review this ${args['language']} code for best practices.` },
          ],
        }),
      });

      const result = await server.getPrompt('code_review', { language: 'TypeScript' });
      expect(result.messages[0].content).toContain('TypeScript');
    });

    it('throws for unknown prompt', async () => {
      await expect(server.getPrompt('nope')).rejects.toThrow('not found');
    });

    it('listPrompts()', () => {
      server.prompt({ name: 'p1', handler: async () => ({ messages: [] }) });
      expect(server.listPrompts()).toHaveLength(1);
    });
  });

  describe('call log + assertions', () => {
    beforeEach(() => {
      server.tool({ name: 'tool1', description: '', inputSchema: {}, handler: async () => ({ content: [{ type: 'text', text: 'ok' }] }) });
      server.resource({ uri: 'res://1', name: 'R1', handler: async () => ({ uri: 'res://1', mimeType: 'text/plain', text: 'data' }) });
    });

    it('records all calls', async () => {
      await server.callTool('tool1', { x: 1 });
      await server.readResource('res://1');

      expect(server.getCallLog()).toHaveLength(2);
      expect(server.getCallLog()[0].type).toBe('tool');
      expect(server.getCallLog()[1].type).toBe('resource');
    });

    it('assertToolCalled()', async () => {
      await server.callTool('tool1', {});
      server.assertToolCalled('tool1');
      expect(() => server.assertToolCalled('nope')).toThrow();
    });

    it('assertToolCalledWith()', async () => {
      await server.callTool('tool1', { query: 'test' });
      server.assertToolCalledWith('tool1', { query: 'test' });
    });

    it('assertResourceRead()', async () => {
      await server.readResource('res://1');
      server.assertResourceRead('res://1');
    });

    it('assertCallCount()', async () => {
      await server.callTool('tool1', {});
      await server.callTool('tool1', {});
      server.assertCallCount(2);
    });

    it('reset() clears everything', async () => {
      await server.callTool('tool1', {});
      server.reset();
      server.assertCallCount(0);
      expect(server.hasTool('tool1')).toBe(false);
    });
  });
});
