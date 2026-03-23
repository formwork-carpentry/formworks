/**
 * @module @carpentry/graphql
 * @description GraphQL Subscriptions — in-memory pub/sub engine for real-time GraphQL.
 *
 * WHY: GraphQL subscriptions let clients receive live updates (new messages, price changes,
 * notifications) without polling. This module provides the pub/sub backbone that the
 * WebSocket transport layer uses to push events to subscribers.
 *
 * HOW: Resolvers publish events via `pubsub.publish('POST_CREATED', data)`. Clients
 * subscribe via `pubsub.subscribe('POST_CREATED', callback)`. The PubSub engine
 * matches events to subscribers and delivers payloads. AsyncIterator support lets
 * this plug into any GraphQL server (Apollo, graphql-ws, etc.).
 *
 * @patterns Observer (pub/sub), Iterator (async iteration for subscriptions)
 * @principles SRP (event routing only), OCP (add topics without modifying engine)
 *
 * @example
 * ```ts
 * const pubsub = new PubSub();
 *
 * // In a mutation resolver:
 * async createPost(_, { title }) {
 *   const post = await Post.create({ title });
 *   pubsub.publish('POST_CREATED', { postCreated: post });
 *   return post;
 * }
 *
 * // In a subscription resolver:
 * postCreated: {
 *   subscribe: () => pubsub.asyncIterator('POST_CREATED'),
 * }
 * ```
 */

/** Subscription callback — receives the published payload */
export type SubscriptionCallback = (payload: unknown) => void;

/** Subscription handle returned by subscribe() — call to unsubscribe */
export type Unsubscribe = () => void;

/**
 * In-memory PubSub engine for GraphQL subscriptions.
 *
 * For multi-server deployments, extend this with Redis PubSub or
 * use the @carpentry/realtime broadcaster as the transport.
 *
 * @example
 * ```ts
 * import { PubSub } from '@carpentry/graphql';
 * const bus = new PubSub();
 * bus.subscribe('evt', console.log);
 * bus.publish('evt', { x: 1 });
 * ```
 */
export class PubSub {
  /** topic → Set of callbacks */
  private subscribers = new Map<string, Set<SubscriptionCallback>>();
  /** Total events published (for monitoring) */
  private publishCount = 0;

  /**
   * Subscribe to a topic. Returns an unsubscribe function.
   *
   * @param topic - Event name (e.g., 'POST_CREATED', 'COMMENT_ADDED')
   * @param callback - Function called with the payload when events are published
   * @returns Unsubscribe function — call it to stop receiving events
   *
   * @example
   * ```ts
   * const unsub = pubsub.subscribe('USER_ONLINE', (payload) => {
   *   console.log('User came online:', payload);
   * });
   * // Later:
   * unsub();
   * ```
   */
  subscribe(topic: string, callback: SubscriptionCallback): Unsubscribe {
    if (!this.subscribers.has(topic)) {
      this.subscribers.set(topic, new Set());
    }
    this.subscribers.get(topic)?.add(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(topic);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) this.subscribers.delete(topic);
      }
    };
  }

  /**
   * Publish an event to all subscribers of a topic.
   *
   * @param topic - Event name
   * @param payload - Data to deliver to subscribers
   * @returns Number of subscribers that received the event
   */
  publish(topic: string, payload: unknown): number {
    this.publishCount++;
    const subs = this.subscribers.get(topic);
    if (!subs || subs.size === 0) return 0;

    // Deliver to all subscribers synchronously
    for (const callback of subs) {
      try {
        callback(payload);
      } catch {
        // Don't let one subscriber's error break others
      }
    }
    return subs.size;
  }

  /**
   * Create an AsyncIterator for a topic — used by GraphQL subscription resolvers.
   * The iterator yields payloads as they're published, and completes when
   * the returned object's `return()` method is called.
   *
   * @example
   * ```ts
   * // In a GraphQL subscription resolver:
   * subscribe: () => pubsub.asyncIterator('NOTIFICATION'),
   *
   * // Or subscribe to multiple topics:
   * subscribe: () => pubsub.asyncIterator(['CHAT_MESSAGE', 'TYPING_INDICATOR']),
   * ```
   */
  asyncIterator(topics: string | string[]): AsyncIterableIterator<unknown> {
    const topicList = Array.isArray(topics) ? topics : [topics];
    const queue: unknown[] = [];
    let resolveNext: ((value: IteratorResult<unknown>) => void) | null = null;
    let done = false;

    const onEvent = (payload: unknown) => {
      if (done) return;
      if (resolveNext) {
        const r = resolveNext;
        resolveNext = null;
        r({ value: payload, done: false });
      } else queue.push(payload);
    };

    const unsubs = topicList.map((t) => this.subscribe(t, onEvent));

    return this.buildIterator(
      queue,
      unsubs,
      () => done,
      (v) => {
        done = v;
      },
      () => resolveNext,
      (v) => {
        resolveNext = v;
      },
    );
  }

  /** Build the AsyncIterableIterator object with next/return/Symbol.asyncIterator */
  private buildIterator(
    queue: unknown[],
    unsubs: Array<() => void>,
    getDone: () => boolean,
    setDone: (v: boolean) => void,
    getResolve: () => ((v: IteratorResult<unknown>) => void) | null,
    setResolve: (v: ((v: IteratorResult<unknown>) => void) | null) => void,
  ): AsyncIterableIterator<unknown> {
    return {
      next(): Promise<IteratorResult<unknown>> {
        if (getDone()) return Promise.resolve({ value: undefined, done: true });
        if (queue.length > 0) return Promise.resolve({ value: queue.shift(), done: false });
        return new Promise((resolve) => {
          setResolve(resolve);
        });
      },
      return(): Promise<IteratorResult<unknown>> {
        setDone(true);
        for (const u of unsubs) u();
        const r = getResolve();
        if (r) {
          r({ value: undefined, done: true });
          setResolve(null);
        }
        return Promise.resolve({ value: undefined, done: true });
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }

  /** Get subscriber count for a topic */
  /**
   * @param {string} topic
   * @returns {number}
   */
  getSubscriberCount(topic: string): number {
    return this.subscribers.get(topic)?.size ?? 0;
  }

  /** Get all topics that have at least one subscriber */
  getActiveTopics(): string[] {
    return [...this.subscribers.keys()];
  }

  /** Get total publish count since creation */
  getPublishCount(): number {
    return this.publishCount;
  }

  /** Clear all subscriptions (for testing/shutdown) */
  clear(): void {
    this.subscribers.clear();
  }
}
