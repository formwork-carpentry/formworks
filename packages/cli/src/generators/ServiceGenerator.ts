/**
 * @module @carpentry/cli
 * @description CSDL Code Generator — reads .proto or .csdl service definitions
 * and generates TypeScript interfaces, client stubs, and server handlers.
 *
 * @example
 * ```bash
 * carpenter generate:service services/users.proto
 * # Generates:
 * #   src/services/users/IUsersService.ts    — interface
 * #   src/services/users/UsersClient.ts      — RemoteService client stub
 * #   src/services/users/UsersHandler.ts     — server handler scaffold
 * ```
 */

/**
 * @typedef {Object} ServiceDefinition - Parsed service definition
 */
export interface ServiceDefinition {
  name: string;
  methods: MethodDefinition[];
  package?: string;
}

/**
 * @typedef {Object} MethodDefinition - A single RPC method
 */
export interface MethodDefinition {
  name: string;
  inputType: string;
  outputType: string;
  streaming?: boolean;
}

/**
 * @typedef {Object} MessageDefinition - A message/type definition
 */
export interface MessageDefinition {
  name: string;
  fields: Array<{ name: string; type: string; repeated?: boolean; optional?: boolean }>;
}

/**
 * Parse a simplified .proto file into service and message definitions.
 *
 * @param {string} source - Proto file content
 * @returns {{ services: ServiceDefinition[], messages: MessageDefinition[] }}
 *
 * @example
 * ```ts
 * const source = `
 *   message GetUserRequest { string id = 1; }
 *   message User { string id = 1; string name = 2; string email = 3; }
 *   service UserService {
 *     rpc GetUser(GetUserRequest) returns (User);
 *     rpc ListUsers(Empty) returns (stream User);
 *   }
 * `;
 * const { services, messages } = parseProto(source);
 * ```
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: proto parser needs multiple state-machine branches
export function parseProto(source: string): {
  services: ServiceDefinition[];
  messages: MessageDefinition[];
} {
  const services: ServiceDefinition[] = [];
  const messages: MessageDefinition[] = [];

  const lines = source
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("message ")) {
      const name = line
        .replace("message ", "")
        .replace(/\s*\{.*/, "")
        .trim();
      const fields: MessageDefinition["fields"] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("}")) {
        const fieldMatch = lines[i].match(/^\s*(repeated\s+)?(optional\s+)?(\w+)\s+(\w+)\s*=/);
        if (fieldMatch) {
          fields.push({
            name: fieldMatch[4],
            type: protoToTs(fieldMatch[3]),
            repeated: !!fieldMatch[1],
            optional: !!fieldMatch[2],
          });
        }
        i++;
      }
      messages.push({ name, fields });
    }

    if (line.startsWith("service ")) {
      const name = line
        .replace("service ", "")
        .replace(/\s*\{.*/, "")
        .trim();
      const methods: MethodDefinition[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("}")) {
        const rpcMatch = lines[i].match(
          /rpc\s+(\w+)\s*\(\s*(stream\s+)?(\w+)\s*\)\s*returns\s*\(\s*(stream\s+)?(\w+)\s*\)/,
        );
        if (rpcMatch) {
          methods.push({
            name: rpcMatch[1],
            inputType: rpcMatch[3],
            outputType: rpcMatch[5],
            streaming: !!(rpcMatch[2] || rpcMatch[4]),
          });
        }
        i++;
      }
      services.push({ name, methods });
    }

    i++;
  }

  return { services, messages };
}

/**
 * Generate TypeScript code from parsed service definitions.
 *
 * @param {ServiceDefinition[]} services - Parsed services
 * @param {MessageDefinition[]} messages - Parsed message types
 * @returns {{ interface: string, client: string, handler: string }} Generated code
 *
 * @example
 * ```ts
 * const { services, messages } = parseProto(source);
 * const code = generateTypeScript(services, messages);
 * writeFileSync('IUserService.ts', code.interface);
 * writeFileSync('UserServiceClient.ts', code.client);
 * writeFileSync('UserServiceHandler.ts', code.handler);
 * ```
 */
export function generateTypeScript(
  services: ServiceDefinition[],
  messages: MessageDefinition[],
): { interface: string; client: string; handler: string } {
  const typeCode = messages.map(genMessageType).join("\n\n");
  const svc = services[0];
  if (!svc) return { interface: "", client: "", handler: "" };

  const iface = genInterface(svc, typeCode);
  const client = genClient(svc);
  const handler = genHandler(svc);

  return { interface: iface, client, handler };
}

// ── Internal generators ───────────────────────────────────

function protoToTs(protoType: string): string {
  const map: Record<string, string> = {
    string: "string",
    int32: "number",
    int64: "number",
    float: "number",
    double: "number",
    bool: "boolean",
    bytes: "Uint8Array",
    Empty: "void",
  };
  return map[protoType] ?? protoType;
}

function genMessageType(msg: MessageDefinition): string {
  const fields = msg.fields.map((f) => {
    const type = f.repeated ? `${f.type}[]` : f.type;
    return `  ${f.name}${f.optional ? "?" : ""}: ${type};`;
  });
  return `export interface ${msg.name} {\n${fields.join("\n")}\n}`;
}

function genInterface(svc: ServiceDefinition, types: string): string {
  const methods = svc.methods.map((m) => {
    const input = m.inputType === "Empty" ? "" : `request: ${m.inputType}`;
    const output = m.streaming ? `AsyncIterable<${m.outputType}>` : `Promise<${m.outputType}>`;
    return `  ${m.name}(${input}): ${output};`;
  });

  return [
    "/**",
    ` * ${svc.name} — auto-generated from CSDL definition.`,
    " */",
    "",
    types,
    "",
    `export interface I${svc.name} {`,
    ...methods,
    "}",
  ].join("\n");
}

function genClient(svc: ServiceDefinition): string {
  const methods = svc.methods.map((m) => {
    const input = m.inputType === "Empty" ? "" : `request: ${m.inputType}`;
    const args = m.inputType === "Empty" ? "{}" : "request";
    return [
      `  async ${m.name}(${input}): Promise<${m.outputType}> {`,
      "    const response = await this.transport.send({",
      `      id: crypto.randomUUID(), service: '${svc.name}',`,
      `      method: '${m.name}', payload: ${args}, timestamp: Date.now(),`,
      "    });",
      "    if (response.error) throw new Error(response.error.message);",
      `    return response.data as ${m.outputType};`,
      "  }",
    ].join("\n");
  });

  return [
    `import type { ITransport } from '@carpentry/formworks/core/contracts/bridge/index.js';`,
    `import type { I${svc.name} } from './I${svc.name}.js';`,
    "",
    "/**",
    ` * ${svc.name} client — calls the remote service via transport.`,
    " */",
    `export class ${svc.name}Client implements I${svc.name} {`,
    "  constructor(private transport: ITransport) {}",
    "",
    ...methods,
    "}",
  ].join("\n");
}

function genHandler(svc: ServiceDefinition): string {
  const methods = svc.methods.map((m) => {
    const input = m.inputType === "Empty" ? "" : `_request: ${m.inputType}`;
    return [
      `  async ${m.name}(${input}): Promise<${m.outputType}> {`,
      `    throw new Error('${m.name} not implemented');`,
      "  }",
    ].join("\n");
  });

  return [
    `import type { I${svc.name} } from './I${svc.name}.js';`,
    "",
    "/**",
    ` * ${svc.name} handler — implement your business logic here.`,
    " */",
    `export class ${svc.name}Handler implements I${svc.name} {`,
    ...methods,
    "}",
  ].join("\n");
}
