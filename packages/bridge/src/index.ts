/**
 * @module @formwork/bridge
 * @description Polyglot microservices bridge — typed RPC clients + service registry.
 *
 * Use this package to:
 * - Register service endpoints in a {@link ServiceRegistry}
 * - Create typed RPC clients with {@link RemoteService}
 * - Swap transports (e.g. {@link InMemoryTransport} for tests, HTTP transports in production)
 *
 * @example
 * ```ts
 * import { ServiceRegistry, InMemoryTransport, RemoteService } from '@formwork/bridge';
 *
 * const registry = new ServiceRegistry()
 *   .register({ service: 'users', transport: 'memory', host: '127.0.0.1', weight: 1 });
 *
 * const transport = new InMemoryTransport();
 * await transport.connect();
 *
 * transport.onRequest('users', async (msg) => ({
 *   id: msg.id,
 *   payload: { ok: true, method: msg.method },
 * }));
 *
 * const usersClient = new RemoteService('users', transport);
 * const res = await usersClient.call('health', {});
 * ```
 *
 * @see ServiceRegistry — endpoint registration + resolution
 * @see RemoteService — typed RPC calls
 * @see InMemoryTransport — deterministic in-test transport
 */

export * from "./types.js";
export * from "./transports.js";
export * from "./registry.js";
export * from "./remote.js";
export * from "./exceptions/index.js";
export * from "./health.js";
export * from "./http-transport.js";
export * from "./stubs.js";
export * from "./manager/index.js";
export { UnixSocketTransport, createUnixSocketServer } from "./unix-socket.js";
