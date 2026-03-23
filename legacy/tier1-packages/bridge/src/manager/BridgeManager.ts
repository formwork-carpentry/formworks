/**
 * @module @carpentry/bridge
 * @description BridgeManager — resolves named transport connections via the Domain Factory Manager pattern.
 * Extends {@link BaseManager} for shared driver registration, lazy resolution, and instance caching.
 *
 * @patterns Abstract Factory (transport resolution), Strategy (transport swapping)
 * @principles DIP — app code uses ITransport, never a concrete transport
 *             OCP — new transports via registerDriver without modifying core
 *             DRY — shared resolution logic via BaseManager
 */

import { CarpenterFactoryBase } from "@carpentry/core/adapters";
import type { ITransport } from "@carpentry/core/contracts";
import { InMemoryTransport } from "../transports.js";

export interface BridgeTransportConfig {
  driver: string;
  [key: string]: unknown;
}

export type BridgeTransportFactory = (config: BridgeTransportConfig) => ITransport;

/**
 * Resolve named transport connections and manage their lifecycle.
 *
 * @example
 * ```ts
 * import { BridgeManager } from '@carpentry/bridge';
 *
 * const manager = new BridgeManager('memory', {
 *   memory: { driver: 'memory' },
 * });
 *
 * const transport = manager.transport();
 * await transport.connect();
 * const res = await transport.send(message);
 * ```
 *
 * @see ITransport — Transport contract
 * @see BaseManager — shared driver registration and resolution
 */
export class BridgeManager extends CarpenterFactoryBase<ITransport, BridgeTransportConfig> {
  protected readonly resolverLabel = "transport";
  protected readonly domainLabel = "Bridge";

  constructor(defaultTransport = "memory", configs: Record<string, BridgeTransportConfig> = {}) {
    super(defaultTransport, configs);
    this.registerDriver("memory", () => new InMemoryTransport());
  }

  /**
   * Get a transport connection by name (defaults to the configured default).
   * @param {string} [name]
   * @returns {ITransport}
   */
  transport(name?: string): ITransport {
    return this.resolve(name);
  }

  /**
   * Disconnect a specific transport and remove it from the cache.
   * @param {string} [name]
   * @returns {Promise<void>}
   */
  async disconnect(name?: string): Promise<void> {
    const transportName = name ?? this.getDefaultName();
    try {
      const t = this.transport(transportName);
      await t.disconnect();
    } catch {
      // Transport may not be resolved yet — nothing to disconnect
    }
    await this.purge(transportName);
  }

  /**
   * Disconnect all transports and clear the cache.
   * @returns {Promise<void>}
   */
  async disconnectAll(): Promise<void> {
    await this.purgeAll();
  }
}
