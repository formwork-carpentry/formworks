import 'reflect-metadata';
import { Container } from '@carpentry/core/container';
import { Router } from '../../src/http/router/Router.js';
import { HttpKernel } from '../../src/http/kernel/HttpKernel.js';
import { Request } from '../../src/http/request/Request.js';
import { CarpenterResponse } from '../../src/http/response/Response.js';
import { BaseController } from '../../src/http/controller/BaseController.js';
import { BaseModel } from '../../src/orm/model/BaseModel.js';
import { MockDatabaseAdapter } from '../../src/orm/adapters/MockDatabaseAdapter.js';
import { Validator } from '../../src/validation/validator/Validator.js';
import { MemoryCacheStore } from '../../src/cache/adapters/MemoryCacheStore.js';
import { EventDispatcher } from '../../src/events/dispatcher/EventDispatcher.js';
import { Logger, ArrayChannel } from '../../src/log/index.js';
import { AuditLogger, InMemoryAuditChannel } from '../../src/log/index.js';
import { BaseNotification } from '../../src/notifications/index.js';
import type { Notifiable, MailChannelMessage, SmsChannelMessage } from '../../src/notifications/index.js';

export class User extends BaseModel {
  static table = 'users';
  static fillable = ['name', 'email', 'role'];
  static userstamps = true;
}

export class UserController extends BaseController {
  private validator = new Validator();

  constructor(
    private readonly cache: MemoryCacheStore,
    private readonly events: EventDispatcher,
  ) {
    super();
  }

  async index() {
    const cached = await this.cache.get('users:all');
    if (cached) return this.json({ data: cached, source: 'cache' });

    const users = await User.all();
    await this.cache.put('users:all', users.map((u) => u.toJSON()), 300);
    return this.json({ data: users.map((u) => u.toJSON()), source: 'db' });
  }

  async store(request: Request) {
    const body = request.body<{ name: string; email: string }>() ?? {};

    const result = this.validator.validate(body as Record<string, unknown>, {
      name: 'required|string|min:2',
      email: 'required|email',
    });

    if (!result.passes) {
      return CarpenterResponse.json({ errors: result.errors }, 422);
    }

    const user = await User.create(result.validated as Record<string, unknown>);
    await this.events.emit('user.created', { userId: user.getKey(), name: body.name });
    await this.cache.forget('users:all');

    return this.created({ data: user.toJSON() });
  }
}

export class NotifiableUser implements Notifiable {
  constructor(
    public id: number,
    public email: string,
    public phone: string,
  ) {}

  routeNotificationFor(channel: string): string | null {
    if (channel === 'mail') return this.email;
    if (channel === 'sms') return this.phone;
    return String(this.id);
  }
}

export class WelcomeNotification extends BaseNotification<{ name: string }> {
  via() {
    return ['mail', 'sms'];
  }

  toMail(n: Notifiable): MailChannelMessage {
    return {
      to: [{ email: n.routeNotificationFor('mail')! }],
      subject: `Welcome, ${this.data.name}!`,
      html: `<p>Hello ${this.data.name}</p>`,
    };
  }

  toSms(n: Notifiable): SmsChannelMessage {
    return { to: n.routeNotificationFor('sms')!, body: `Welcome, ${this.data.name}!` };
  }
}

export type IntegrationHarness = {
  db: MockDatabaseAdapter;
  cache: MemoryCacheStore;
  events: EventDispatcher;
  logChannel: ArrayChannel;
  auditChannel: InMemoryAuditChannel;
  container: Container;
  router: Router;
  kernel: HttpKernel;
};

export function createRequest(method: string, url: string, options: RequestInit = {}): Request {
  return new Request(new globalThis.Request(url, { method, ...options }));
}

export function createIntegrationHarness(): IntegrationHarness {
  const db = new MockDatabaseAdapter();
  const cache = new MemoryCacheStore();
  const events = new EventDispatcher();
  const logChannel = new ArrayChannel('app');
  const auditChannel = new InMemoryAuditChannel();

  BaseModel.adapter = db;
  BaseModel.clearEvents();
  BaseModel.userResolver = () => 1;

  const container = new Container();
  container.instance('db', db);
  container.instance('cache', cache);
  container.instance('events', events);
  container.instance('log', new Logger(logChannel));
  container.instance('audit', new AuditLogger([auditChannel]));

  const router = new Router();
  const kernel = new HttpKernel(container, router, { debug: true });

  const ctrl = new UserController(cache, events);
  router.get('/api/users', async () => ctrl.index());
  router.post('/api/users', async (req) => ctrl.store(req as unknown as Request));

  return {
    db,
    cache,
    events,
    logChannel,
    auditChannel,
    container,
    router,
    kernel,
  };
}
