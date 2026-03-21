/**
 * @module carpenter
 * @description End-to-end integration test — proves all major packages work together
 *
 * Simulates a realistic app flow:
 *   1. Bootstrap application with IoC container
 *   2. Configure ORM, cache, events, auth, logging
 *   3. Handle HTTP request through kernel → router → controller
 *   4. Validate input, query database, cache results
 *   5. Fire events, send notifications, log audit trail
 */

import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';

// Core
import { Container } from '@formwork/core/container';
import { Config } from '@formwork/core/config';

// HTTP
import { Router } from '../packages/http/src/router/Router.js';
import { HttpKernel } from '../packages/http/src/kernel/HttpKernel.js';
import { Request } from '../packages/http/src/request/Request.js';
import { CarpenterResponse } from '../packages/http/src/response/Response.js';
import { BaseController } from '../packages/http/src/controller/BaseController.js';

// ORM
import { QueryBuilder } from '../packages/orm/src/query/QueryBuilder.js';
import { BaseModel } from '../packages/orm/src/model/BaseModel.js';
import { MockDatabaseAdapter } from '../packages/orm/src/adapters/MockDatabaseAdapter.js';

// Validation
import { Validator } from '../packages/validation/src/validator/Validator.js';

// Cache
import { MemoryCacheStore } from '../packages/cache/src/adapters/MemoryCacheStore.js';

// Events
import { EventDispatcher } from '../packages/events/src/dispatcher/EventDispatcher.js';

// Auth
import { HashManager } from '../packages/auth/src/hash/HashManager.js';
import { Gate } from '../packages/auth/src/gate/Gate.js';
import { MemoryGuard, InMemoryUserProvider, SimpleUser } from '../packages/auth/src/guards/Guards.js';

// Logging
import { Logger, ArrayChannel } from '../packages/log/src/index.js';
import { AuditLogger, InMemoryAuditChannel } from '../packages/log/src/index.js';

// Notifications
import { NotificationManager, BaseNotification, ArrayChannel as NotifArrayChannel } from '../packages/notifications/src/index.js';
import type { Notifiable, MailChannelMessage, SmsChannelMessage } from '../packages/notifications/src/index.js';

// Session
import { Session, MemorySessionStore } from '../packages/session/src/index.js';

// i18n
import { Translator } from '../packages/i18n/src/Translator.js';
import { Pluralizer } from '../packages/i18n/src/pluralization/Pluralizer.js';
import { MemoryLoader } from '../packages/i18n/src/loader/Loaders.js';

// Testing
import { TestResponse } from '../packages/testing/src/index.js';

// ── Fixtures ──────────────────────────────────────────────

class User extends BaseModel {
  static table = 'users';
  static fillable = ['name', 'email', 'role'];
  static userstamps = true;
}

class UserController extends BaseController {
  private validator = new Validator();
  private cache: MemoryCacheStore;
  private events: EventDispatcher;

  constructor(cache: MemoryCacheStore, events: EventDispatcher) {
    super();
    this.cache = cache;
    this.events = events;
  }

  async index() {
    // Try cache first
    const cached = await this.cache.get('users:all');
    if (cached) return this.json({ data: cached, source: 'cache' });

    const users = await User.all();
    await this.cache.put('users:all', users.map((u) => u.toJSON()), 300);
    return this.json({ data: users.map((u) => u.toJSON()), source: 'db' });
  }

  async store(request: Request) {
    const body = request.body<{ name: string; email: string }>() ?? {};

    // Validate
    const result = this.validator.validate(body as Record<string, unknown>, {
      name: 'required|string|min:2',
      email: 'required|email',
    });

    if (!result.passes) {
      return CarpenterResponse.json({ errors: result.errors }, 422);
    }

    // Create user
    const user = await User.create(result.validated as Record<string, unknown>);

    // Fire event
    await this.events.emit('user.created', { userId: user.getKey(), name: body.name });

    // Invalidate cache
    await this.cache.forget('users:all');

    return this.created({ data: user.toJSON() });
  }
}

class NotifiableUser implements Notifiable {
  constructor(public id: number, public email: string, public phone: string) {}
  routeNotificationFor(channel: string): string | null {
    if (channel === 'mail') return this.email;
    if (channel === 'sms') return this.phone;
    return String(this.id);
  }
}

class WelcomeNotification extends BaseNotification<{ name: string }> {
  via() { return ['mail', 'sms']; }
  toMail(n: Notifiable): MailChannelMessage {
    return { to: [{ email: n.routeNotificationFor('mail')! }], subject: `Welcome, ${this.data.name}!`, html: `<p>Hello ${this.data.name}</p>` };
  }
  toSms(n: Notifiable): SmsChannelMessage {
    return { to: n.routeNotificationFor('sms')!, body: `Welcome, ${this.data.name}!` };
  }
}

// ── Integration Test ──────────────────────────────────────

describe('End-to-End Integration: Full Request Lifecycle', () => {
  let db: MockDatabaseAdapter;
  let cache: MemoryCacheStore;
  let events: EventDispatcher;
  let logChannel: ArrayChannel;
  let auditChannel: InMemoryAuditChannel;
  let container: Container;
  let router: Router;
  let kernel: HttpKernel;

  beforeEach(async () => {
    // 1. Set up infrastructure
    db = new MockDatabaseAdapter();
    cache = new MemoryCacheStore();
    events = new EventDispatcher();
    logChannel = new ArrayChannel('app');
    auditChannel = new InMemoryAuditChannel();

    BaseModel.adapter = db;
    BaseModel.clearEvents();
    BaseModel.userResolver = () => 1; // simulate logged-in user

    // 2. IoC Container
    container = new Container();
    container.instance('db', db);
    container.instance('cache', cache);
    container.instance('events', events);
    container.instance('log', new Logger(logChannel));
    container.instance('audit', new AuditLogger([auditChannel]));

    // 3. Router + Kernel
    router = new Router();
    kernel = new HttpKernel(container, router, { debug: true });

    // 4. Routes
    const ctrl = new UserController(cache, events);
    router.get('/api/users', async () => ctrl.index());
    router.post('/api/users', async (req) => ctrl.store(req as unknown as Request));
  });

  function req(method: string, url: string, options: RequestInit = {}): Request {
    return new Request(new globalThis.Request(url, { method, ...options }));
  }

  it('full create → cache → read cycle', async () => {
    // Track events
    const eventLog: string[] = [];
    events.on('user.created', (payload) => {
      eventLog.push(`user.created:${(payload as { name: string }).name}`);
    });

    // 1. POST /api/users — create a user
    db.queueResult([], 1, 1); // INSERT result
    const createRes = await kernel.handle(req('POST', 'http://localhost/api/users', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', email: 'alice@example.com' }),
    }));

    const testCreate = TestResponse.from(createRes);
    testCreate.assertCreated();
    testCreate.assertJsonHas('data');

    // Verify event fired
    expect(eventLog).toEqual(['user.created:Alice']);

    // 2. GET /api/users — first read (from DB)
    db.queueResult([{ id: 1, name: 'Alice', email: 'alice@example.com' }]);
    const firstRead = await kernel.handle(req('GET', 'http://localhost/api/users'));
    TestResponse.from(firstRead).assertOk();
    expect(firstRead.getBody()).toEqual({
      data: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
      source: 'db',
    });

    // 3. GET /api/users — second read (from cache)
    const secondRead = await kernel.handle(req('GET', 'http://localhost/api/users'));
    TestResponse.from(secondRead).assertOk();
    expect(secondRead.getBody()).toEqual({
      data: [{ id: 1, name: 'Alice', email: 'alice@example.com' }],
      source: 'cache',
    });

    // Verify only 1 DB query for the second read (cache hit)
    // First query: INSERT, Second: SELECT all, Third read: no query (cache)
    expect(db.executedQueries.length).toBe(2);
  });

  it('validation rejects invalid input with 422', async () => {
    const res = await kernel.handle(req('POST', 'http://localhost/api/users', {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', email: 'not-an-email' }),
    }));

    const test = TestResponse.from(res);
    test.assertUnprocessable();
    test.assertJsonHas('errors');

    const body = res.getBody() as { errors: Record<string, string[]> };
    expect(body.errors['name']).toBeDefined();
    expect(body.errors['email']).toBeDefined();

    // No DB queries should have been made
    db.assertQueryCount(0);
  });

  it('404 for unknown route', async () => {
    const res = await kernel.handle(req('GET', 'http://localhost/api/nonexistent'));
    TestResponse.from(res).assertNotFound();
  });

  it('auth guard + gate integration', async () => {
    // Set up auth
    const hash = new HashManager();
    const provider = new InMemoryUserProvider();
    const passwordHash = await hash.make('secret');
    const alice = new SimpleUser(1, 'alice@example.com', passwordHash, 'admin');
    provider.addUser(alice);

    const guard = new MemoryGuard(provider, hash);
    const gate = new Gate();
    gate.define('manage-users', (user) => (user as SimpleUser).role === 'admin');

    // Login
    const success = await guard.attempt({ email: 'alice@example.com', password: 'secret' });
    expect(success).toBe(true);

    // Check authorization
    const user = await guard.user<SimpleUser>();
    expect(await gate.allows(user!, 'manage-users')).toBe(true);
  });

  it('notifications dispatch across channels', async () => {
    const mailChannel = new NotifArrayChannel('mail');
    const smsChannel = new NotifArrayChannel('sms');

    const notifManager = new NotificationManager();
    notifManager.channel('mail', mailChannel).channel('sms', smsChannel);

    const user = new NotifiableUser(1, 'alice@example.com', '+1234567890');
    await notifManager.send(user, new WelcomeNotification({ name: 'Alice' }));

    mailChannel.assertCount(1);
    smsChannel.assertCount(1);

    const mailMsg = mailChannel.getSent()[0].message as MailChannelMessage;
    expect(mailMsg.subject).toContain('Alice');
    expect(mailMsg.to[0].email).toBe('alice@example.com');
  });

  it('session + flash data across requests', async () => {
    const store = new MemorySessionStore('sess-1');
    const session = new Session(store);
    await session.start();

    // Simulate: form submission fails validation → flash errors + old input
    await session.flash('errors', { email: ['Invalid email'] });
    await session.flashInput({ name: 'Alice', email: 'bad' });
    await session.save();

    // Next request: retrieve flash data
    const nextSession = new Session(store);
    await nextSession.start();
    expect(await nextSession.get('errors')).toEqual({ email: ['Invalid email'] });
    expect(await nextSession.old('name')).toBe('Alice');
    expect(await nextSession.old('email')).toBe('bad');

    // CSRF token round-trip
    const token = await nextSession.token();
    expect(await nextSession.verifyToken(token)).toBe(true);
    expect(await nextSession.verifyToken('forged-token')).toBe(false);
    await nextSession.save();

    // Third request: flash data is gone
    const thirdSession = new Session(store);
    await thirdSession.start();
    expect(await thirdSession.get('errors')).toBeNull();
    expect(await thirdSession.hasOldInput('name')).toBe(false);
    // CSRF token persists (not flash)
    expect(await thirdSession.verifyToken(token)).toBe(true);
  });

  it('i18n translation with pluralization', async () => {
    const loader = new MemoryLoader();
    loader.addTranslations('en', 'cart', {
      items: '{0} No items|{1} :count item|[2,*] :count items',
    });
    loader.addTranslations('fr', 'cart', {
      items: '{0} Aucun article|{1} :count article|[2,*] :count articles',
    });

    const translator = new Translator(loader, new Pluralizer(), 'en', 'en');
    await translator.loadAll('en');
    await translator.loadAll('fr');

    expect(translator.choice('cart.items', 0)).toBe('No items');
    expect(translator.choice('cart.items', 1)).toBe('1 item');
    expect(translator.choice('cart.items', 42)).toBe('42 items');

    // French
    expect(translator.choice('cart.items', 0, undefined, 'fr')).toBe('Aucun article');
    expect(translator.choice('cart.items', 5, undefined, 'fr')).toBe('5 articles');
  });

  it('audit logging tracks the full lifecycle', async () => {
    const audit = new AuditLogger([auditChannel]);
    audit.setUserResolver(() => 1);

    // Create
    await audit.created('User', 1, { name: 'Alice', email: 'alice@example.com' });
    // Update
    await audit.updated('User', 1, { name: 'Alice' }, { name: 'Alice Updated' });
    // View
    await audit.viewed('User', 1);
    // Login
    await audit.login(1, { ip: '192.168.1.1' });

    // Verify trail
    const trail = auditChannel.trail('User', 1);
    expect(trail.map((e) => e.action)).toEqual(['created', 'updated', 'viewed']);

    // Verify changes tracked
    auditChannel.assertChanges('User', 1, 'name');
    auditChannel.assertUserActed(1, 'created');
    auditChannel.assertRecorded('login', 'session');
  });

  it('model userstamps auto-set on create/update', async () => {
    BaseModel.userResolver = () => 42;
    db.queueResult([], 1, 1); // INSERT

    const user = new User({ name: 'Test' });
    await user.save();

    expect(user.getAttribute('created_by')).toBe(42);
    expect(user.getAttribute('updated_by')).toBe(42);

    // Update
    BaseModel.userResolver = () => 99;
    user.setAttribute('name', 'Updated');
    db.queueResult([], 1);
    await user.save();

    expect(user.getAttribute('created_by')).toBe(42); // unchanged
    expect(user.getAttribute('updated_by')).toBe(99); // updated
  });
});
