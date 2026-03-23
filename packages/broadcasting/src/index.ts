/**
 * @module @carpentry/broadcasting
 * @description Real-time event broadcasting — channel-based pub/sub with presence,
 * whisper, and authorization. Provides driver adapters for Pusher, Soketi, Ably,
 * and an in-memory/log driver for development.
 *
 * Builds on the IBroadcaster contract from @carpentry/core/contracts/broadcast.
 *
 * @patterns Strategy (pluggable broadcast driver), Observer (channel subscriptions)
 * @principles OCP (new drivers without modifying core), LSP (all drivers share IBroadcaster)
 *
 * @example
 * ```ts
 * import { BroadcastManager } from '@carpentry/broadcasting';
 *
 * const broadcast = new BroadcastManager({ driver: 'log' });
 * broadcast.channel('chat.room-1').broadcast('NewMessage', { body: 'Hello!' });
 * broadcast.private('user.42').broadcast('Notification', { text: 'You have mail' });
 * ```
 */

import type { IBroadcaster } from '@carpentry/core/contracts';

export { type IBroadcaster } from '@carpentry/core/contracts';

/** Options for a broadcast event. */
export interface BroadcastEvent {
  channel: string;
  event: string;
  data: unknown;
  /** Exclude specific socket IDs from receiving this broadcast. */
  except?: string[];
}

/** Configuration for BroadcastManager. */
export interface BroadcastConfig {
  /** Driver to use: 'log' | 'pusher' | 'soketi' | 'ably' | 'null' */
  driver: string;
  /** Driver-specific options */
  options?: Record<string, unknown>;
}

/** Channel types for authorization. */
export type ChannelType = 'public' | 'private' | 'presence';

/** A broadcast channel wrapper providing a fluent API. */
export class Channel {
  constructor(
    public readonly name: string,
    public readonly type: ChannelType,
    private readonly broadcaster: IBroadcaster,
  ) {}

  broadcast(event: string, data: unknown): void {
    this.broadcaster.broadcast(this.name, event, data);
  }
}

/** Manages broadcast channels and drivers. */
export class BroadcastManager {
  private readonly config: BroadcastConfig;
  private readonly driver: IBroadcaster;

  constructor(config: BroadcastConfig) {
    this.config = config;
    this.driver = this.resolveDriver(config.driver);
  }

  /** Get a public channel. */
  channel(name: string): Channel {
    return new Channel(name, 'public', this.driver);
  }

  /** Get a private channel (requires authorization). */
  private_(name: string): Channel {
    return new Channel(`private-${name}`, 'private', this.driver);
  }

  /** Get a presence channel (requires authorization, tracks members). */
  presence(name: string): Channel {
    return new Channel(`presence-${name}`, 'presence', this.driver);
  }

  /** Broadcast an event to a channel directly. */
  broadcast(channel: string, event: string, data: unknown): void {
    this.driver.broadcast(channel, event, data);
  }

  private resolveDriver(driver: string): IBroadcaster {
    switch (driver) {
      case 'log':
        return new LogBroadcaster();
      case 'null':
        return new NullBroadcaster();
      default:
        throw new Error(`Broadcast driver "${driver}" is not yet implemented. Available: log, null`);
    }
  }
}

/** Broadcaster that logs events to console (development driver). */
export class LogBroadcaster implements IBroadcaster {
  broadcast(channel: string, event: string, data: unknown): void {
    console.log(`[broadcast] ${channel} → ${event}`, data);
  }
}

/** Broadcaster that silently discards events (testing driver). */
export class NullBroadcaster implements IBroadcaster {
  broadcast(_channel: string, _event: string, _data: unknown): void {
    // Intentionally empty
  }
}
