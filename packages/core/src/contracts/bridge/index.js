/**
 * @module @formwork/core/contracts/bridge
 * @description Microservice bridge contracts - transport, service registry, health checking.
 *
 * Implementations: InMemoryTransport, HttpTransport, GrpcTransportStub, ServiceRegistry
 *
 * @example
 * ```ts
 * const service = new RemoteService('users', transport, { timeoutMs: 5000 });
 * const user = await service.call<Request, Response>('getUser', { id: 42 });
 * ```
 */
export {};
//# sourceMappingURL=index.js.map