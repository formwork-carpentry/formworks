/**
 * @module @carpentry/realtime
 * @description Realtime broadcasting — channels, presence, and collaboration primitives.
 * @patterns Mediator (broadcaster), Observer (channel subscriptions), Strategy (transport adapters)
 * @principles OCP — new transports (WebSocket, SSE, Pusher, Ably) without modifying core
 *             DIP — app broadcasts via interface; SRP — channel management separate from transport
 *
 * Use this package to:
 * - Broadcast events to subscribed connections/channels
 * - Track presence (who joined a channel)
 * - Synchronize collaborative text documents via CRDT operations ({@link CollaborativeDoc})
 *
 * @example
 * ```ts
 * import { InMemoryBroadcaster, CollaborativeDoc } from '@carpentry/realtime';
 *
 * const broadcaster = new InMemoryBroadcaster();
 * const doc = new CollaborativeDoc('doc-1');
 *
 * doc.onChange((op) => {
 *   broadcaster.broadcast('docs.doc-1', 'operation.applied', op);
 * });
 *
 * doc.insert(0, 'Hello', 'user-a');
 * ```
 *
 * @see InMemoryBroadcaster — Local/test broadcaster implementation
 * @see CollaborativeDoc — CRDT operations API
 */

// ── Channel Types ─────────────────────────────────────────

export type ChannelType = "public" | "private" | "presence";

export interface RealtimeChannel {
  name: string;
  type: ChannelType;
}

export interface PresenceMember {
  userId: string | number;
  userInfo?: Record<string, unknown>;
  joinedAt: Date;
}

export interface BroadcastMessage {
  channel: string;
  event: string;
  data: Record<string, unknown>;
  sender?: string | number;
}

// ── Broadcaster Interface ─────────────────────────────────

export interface IBroadcaster {
  /** Broadcast an event to a channel */
  /**
   * @param {string} channel
   * @param {string} event
   * @param {Object} data
   * @param {string | number} [excludeSender]
   * @returns {Promise<void>}
   */
  broadcast(
    channel: string,
    event: string,
    data: Record<string, unknown>,
    excludeSender?: string | number,
  ): Promise<void>;
  /** Subscribe a connection to a channel */
  /**
   * @param {string} connectionId
   * @param {string} channel
   * @param {string | number} [userId]
   * @param {Object} [userInfo]
   */
  subscribe(
    connectionId: string,
    channel: string,
    userId?: string | number,
    userInfo?: Record<string, unknown>,
  ): void;
  /** Unsubscribe from a channel */
  /**
   * @param {string} connectionId
   * @param {string} channel
   */
  unsubscribe(connectionId: string, channel: string): void;
  /** Disconnect a connection from all channels */
  /**
   * @param {string} connectionId
   */
  disconnect(connectionId: string): void;
  /** Get presence members for a channel */
  /**
   * @param {string} channel
   * @returns {PresenceMember[]}
   */
  presence(channel: string): PresenceMember[];
}

// ── InMemoryBroadcaster — for testing ─────────────────────

/**
 * InMemoryBroadcaster — local broadcaster implementation for tests/dev.
 *
 * Tracks:
 * - subscriptions (connectionId -> channel)
 * - presence members (presence channels)
 * - delivered broadcast messages
 *
 * @example
 * ```ts
 * const broadcaster = new InMemoryBroadcaster();
 *
 * broadcaster.onMessage('c1', (msg) => {
 *   console.log(msg.event, msg.data);
 * });
 *
 * broadcaster.subscribe('c1', 'docs-doc-1', 'user-a');
 * await broadcaster.broadcast('docs-doc-1', 'operation.applied', { opId: '1' });
 *
 * broadcaster.assertBroadcasted('operation.applied', 'docs-doc-1');
 * ```
 */
export class InMemoryBroadcaster implements IBroadcaster {
  private subscriptions = new Map<string, Set<string>>(); // channel → connectionIds
  private connections = new Map<string, Set<string>>(); // connectionId → channels
  private presenceData = new Map<string, Map<string, PresenceMember>>(); // channel → userId → member
  private broadcasted: BroadcastMessage[] = [];
  private messageHandlers = new Map<string, Array<(msg: BroadcastMessage) => void>>(); // connectionId → handlers

  /**
   * @param {string} channel
   * @param {string} event
   * @param {Object} data
   * @param {string | number} [excludeSender]
   * @returns {Promise<void>}
   */
  async broadcast(
    channel: string,
    event: string,
    data: Record<string, unknown>,
    excludeSender?: string | number,
  ): Promise<void> {
    const msg: BroadcastMessage = { channel, event, data, sender: excludeSender };
    this.broadcasted.push(msg);

    const subscribers = this.subscriptions.get(channel);
    if (!subscribers) return;

    for (const connId of subscribers) {
      if (excludeSender && connId === String(excludeSender)) continue;
      const handlers = this.messageHandlers.get(connId) ?? [];
      for (const handler of handlers) handler(msg);
    }
  }

  /**
   * @param {string} connectionId
   * @param {string} channel
   * @param {string | number} [userId]
   * @param {Object} [userInfo]
   */
  subscribe(
    connectionId: string,
    channel: string,
    userId?: string | number,
    userInfo?: Record<string, unknown>,
  ): void {
    if (!this.subscriptions.has(channel)) this.subscriptions.set(channel, new Set());
    this.subscriptions.get(channel)?.add(connectionId);

    if (!this.connections.has(connectionId)) this.connections.set(connectionId, new Set());
    this.connections.get(connectionId)?.add(channel);

    // Track presence for presence channels
    if (userId !== undefined) {
      if (!this.presenceData.has(channel)) this.presenceData.set(channel, new Map());
      this.presenceData.get(channel)?.set(String(userId), {
        userId,
        userInfo,
        joinedAt: new Date(),
      });
    }
  }

  /**
   * @param {string} connectionId
   * @param {string} channel
   */
  unsubscribe(connectionId: string, channel: string): void {
    this.subscriptions.get(channel)?.delete(connectionId);
    this.connections.get(connectionId)?.delete(channel);
  }

  /**
   * @param {string} connectionId
   */
  disconnect(connectionId: string): void {
    const channels = this.connections.get(connectionId);
    if (channels) {
      for (const ch of channels) {
        this.subscriptions.get(ch)?.delete(connectionId);
      }
    }
    this.connections.delete(connectionId);
  }

  /**
   * @param {string} channel
   * @returns {PresenceMember[]}
   */
  presence(channel: string): PresenceMember[] {
    const members = this.presenceData.get(channel);
    return members ? [...members.values()] : [];
  }

  /** Register a message handler for a connection */
  /**
   * @param {string} connectionId
   * @param {(msg: BroadcastMessage} handler
   */
  onMessage(connectionId: string, handler: (msg: BroadcastMessage) => void): void {
    if (!this.messageHandlers.has(connectionId)) this.messageHandlers.set(connectionId, []);
    this.messageHandlers.get(connectionId)?.push(handler);
  }

  /** Get subscriber count for a channel */
  /**
   * @param {string} channel
   * @returns {number}
   */
  subscriberCount(channel: string): number {
    return this.subscriptions.get(channel)?.size ?? 0;
  }

  /** Get all channels a connection is subscribed to */
  /**
   * @param {string} connectionId
   * @returns {string[]}
   */
  channelsFor(connectionId: string): string[] {
    return [...(this.connections.get(connectionId) ?? [])];
  }

  // ── Test Assertions ─────────────────────────────────────

  getBroadcasted(): BroadcastMessage[] {
    return [...this.broadcasted];
  }

  /**
   * @param {string} event
   * @param {string} [channel]
   */
  assertBroadcasted(event: string, channel?: string): void {
    const matches = this.broadcasted.filter(
      (m) => m.event === event && (channel === undefined || m.channel === channel),
    );
    if (matches.length === 0)
      throw new Error(
        `Expected broadcast of "${event}"${channel ? ` on "${channel}"` : ""}, but none found.`,
      );
  }

  /**
   * @param {string} event
   */
  assertNotBroadcasted(event: string): void {
    if (this.broadcasted.some((m) => m.event === event)) {
      throw new Error(`Expected "${event}" NOT to be broadcast, but it was.`);
    }
  }

  /**
   * @param {number} count
   */
  assertBroadcastCount(count: number): void {
    if (this.broadcasted.length !== count)
      throw new Error(`Expected ${count} broadcasts, got ${this.broadcasted.length}.`);
  }

  reset(): void {
    this.subscriptions.clear();
    this.connections.clear();
    this.presenceData.clear();
    this.broadcasted = [];
    this.messageHandlers.clear();
  }
}

// ── Channel Authorization ─────────────────────────────────

export type ChannelAuthorizer = (
  userId: string | number,
  channel: string,
) => boolean | Promise<boolean>;

/**
 * ChannelManager — manages subscriptions with optional authorization checks.
 *
 * Use it when you have private/presence channels that require an allow/deny decision.
 * `ChannelManager.join()` consults configured authorizers and only then subscribes
 * the connection on the underlying broadcaster.
 *
 * @example
 * ```ts
 * const broadcaster = new InMemoryBroadcaster();
 * const manager = new ChannelManager(broadcaster)
 *   .authorize('private-orders.*', (userId) => userId === 'admin');
 *
 * const allowed = await manager.join('c1', 'private-orders.123', 'admin');
 * if (!allowed) throw new Error('Denied');
 *
 * // Now broadcasts to this channel would reach connection 'c1'
 * await broadcaster.broadcast('private-orders.123', 'order.updated', { id: 123 });
 * ```
 */
export class ChannelManager {
  private authorizers = new Map<string, ChannelAuthorizer>();
  private broadcaster: IBroadcaster;

  constructor(broadcaster: IBroadcaster) {
    this.broadcaster = broadcaster;
  }

  /** Register an authorizer for private/presence channels */
  /**
   * @param {string} channelPattern
   * @param {ChannelAuthorizer} authorizer
   * @returns {this}
   */
  authorize(channelPattern: string, authorizer: ChannelAuthorizer): this {
    this.authorizers.set(channelPattern, authorizer);
    return this;
  }

  /** Check if a user can join a channel */
  /**
   * @param {string | number} userId
   * @param {string} channel
   * @returns {Promise<boolean>}
   */
  async canJoin(userId: string | number, channel: string): Promise<boolean> {
    if (!channel.startsWith("private-") && !channel.startsWith("presence-")) return true;

    for (const [pattern, auth] of this.authorizers) {
      if (this.matchPattern(channel, pattern)) {
        return auth(userId, channel);
      }
    }
    return false; // deny by default for private/presence
  }

  /** Subscribe with authorization check */
  /**
   * @param {string} connectionId
   * @param {string} channel
   * @param {string | number} userId
   * @param {Object} [userInfo]
   * @returns {Promise<boolean>}
   */
  async join(
    connectionId: string,
    channel: string,
    userId: string | number,
    userInfo?: Record<string, unknown>,
  ): Promise<boolean> {
    const allowed = await this.canJoin(userId, channel);
    if (!allowed) return false;
    this.broadcaster.subscribe(connectionId, channel, userId, userInfo);
    return true;
  }

  getBroadcaster(): IBroadcaster {
    return this.broadcaster;
  }

  private matchPattern(channel: string, pattern: string): boolean {
    if (pattern === channel) return true;
    if (pattern.endsWith(".*")) {
      const prefix = pattern.slice(0, -2);
      return channel.startsWith(prefix);
    }
    // Simple wildcard: private-orders.{id} matches private-orders.123
    const regex = new RegExp(`^${pattern.replace(/\{[^}]+\}/g, "[^.]+")}$`);
    return regex.test(channel);
  }
}

// ── Facade ────────────────────────────────────────────────

let globalBroadcaster: IBroadcaster | null = null;
/**
 * @param {IBroadcaster} b
 */
export function setBroadcaster(b: IBroadcaster): void {
  globalBroadcaster = b;
}

export const Broadcast = {
  to: (channel: string, event: string, data: Record<string, unknown>) =>
    getBroadcaster().broadcast(channel, event, data),
  toOthers: (
    channel: string,
    event: string,
    data: Record<string, unknown>,
    sender: string | number,
  ) => getBroadcaster().broadcast(channel, event, data, sender),
  presence: (channel: string) => getBroadcaster().presence(channel),
};

function getBroadcaster(): IBroadcaster {
  /**
   * @param {unknown} !globalBroadcaster
   */
  if (!globalBroadcaster) throw new Error("Broadcaster not initialized.");
  return globalBroadcaster;
}

export { CollaborativeDoc } from "./CollaborativeDoc.js";
export type { DocOperation, UserCursor } from "./CollaborativeDoc.js";
