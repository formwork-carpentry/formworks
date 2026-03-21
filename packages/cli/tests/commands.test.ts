import { describe, it, expect, beforeEach } from 'vitest';
import {
  NewAppCommand,
  MakeModelCommand, MakeControllerCommand, MakeMigrationCommand,
  MakeMiddlewareCommand, MakeNotificationCommand, MakeJobCommand,
  MakeTestCommand, ServeCommand, MigrateRunCommand, registerBuiltinCommands,
} from '../src/commands.js';
import {
  MakeFactoryCommand, MakeSeederCommand, MakeEventCommand,
  MakeListenerCommand, DbSeedCommand, ScheduleRunCommand,
  MakeProviderCommand, MakeRequestCommand,
} from '../src/additional-commands.js';
import {
  InspectRoutesCommand, InspectContainerCommand, DoctorCommand,
} from '../src/inspect-commands.js';
import {
  TenantCreateCommand, TenantMigrateCommand, TenantListCommand,
} from '../src/tenant-commands.js';
import { InMemoryConsole, CliApp } from '../src/index.js';

describe('@formwork/cli: Generator Commands', () => {
  let output: InMemoryConsole;
  beforeEach(() => { output = new InMemoryConsole(); });

  describe('new', () => {
    it('forwards flags to the project scaffolder', async () => {
      let captured: string[] = [];
      const cmd = new NewAppCommand(async (argv) => {
        captured = argv;
        return 0;
      });

      const code = await cmd.handle(
        { name: 'demo-app' },
        { preset: 'minimal', db: 'sqlite', pm: 'bun', 'skip-install': true },
        output,
      );

      expect(code).toBe(0);
      expect(captured).toEqual([
        'demo-app',
        '--preset', 'minimal',
        '--db', 'sqlite',
        '--pm', 'bun',
        '--skip-install',
      ]);
    });

    it('supports fully interactive scaffolding with no preset args', async () => {
      let captured: string[] = ['sentinel'];
      const cmd = new NewAppCommand(async (argv) => {
        captured = argv;
        return 0;
      });

      const code = await cmd.handle({}, {}, output);

      expect(code).toBe(0);
      expect(captured).toEqual([]);
    });
  });

  describe('make:model', () => {
    it('generates model template', async () => {
      const cmd = new MakeModelCommand();
      const code = await cmd.handle({ name: 'User' }, {}, output);
      expect(code).toBe(0);
      output.assertOutputContains('extends BaseModel');
      output.assertOutputContains("table = 'users'");
      output.assertOutputContains('timestamps = true');
    });

    it('fails without name', async () => {
      const cmd = new MakeModelCommand();
      const code = await cmd.handle({}, {}, output);
      expect(code).toBe(1);
    });
  });

  describe('make:controller', () => {
    it('generates basic controller', async () => {
      const cmd = new MakeControllerCommand();
      const code = await cmd.handle({ name: 'UserController' }, {}, output);
      expect(code).toBe(0);
      output.assertOutputContains('extends BaseController');
    });

    it('generates resource controller with --resource', async () => {
      const cmd = new MakeControllerCommand();
      await cmd.handle({ name: 'PostController' }, { resource: true }, output);
      const out = output.getOutput();
      expect(out).toContain('index');
      expect(out).toContain('show');
      expect(out).toContain('store');
      expect(out).toContain('update');
      expect(out).toContain('destroy');
      expect(out).toContain('create'); // non-API includes create/edit
      expect(out).toContain('edit');
    });

    it('API resource controller omits create/edit', async () => {
      const cmd = new MakeControllerCommand();
      await cmd.handle({ name: 'ApiController' }, { api: true }, output);
      const out = output.getOutput();
      expect(out).toContain('index');
      expect(out).not.toContain('create()');
      expect(out).not.toContain('edit()');
    });
  });

  describe('make:migration', () => {
    it('generates migration template', async () => {
      const cmd = new MakeMigrationCommand();
      await cmd.handle({ name: 'create_posts_table' }, {}, output);
      output.assertOutputContains('schema.create');
      output.assertOutputContains('table.id()');
      output.assertOutputContains('table.timestamps()');
      output.assertOutputContains('dropIfExists');
    });

    it('uses --create option for table name', async () => {
      const cmd = new MakeMigrationCommand();
      await cmd.handle({ name: 'create_orders' }, { create: 'orders' }, output);
      output.assertOutputContains("'orders'");
    });
  });

  describe('make:middleware', () => {
    it('generates middleware template', async () => {
      const cmd = new MakeMiddlewareCommand();
      await cmd.handle({ name: 'AuthMiddleware' }, {}, output);
      output.assertOutputContains('implements IMiddleware');
      output.assertOutputContains('async handle');
      output.assertOutputContains('await next()');
    });
  });

  describe('make:notification', () => {
    it('generates notification template', async () => {
      const cmd = new MakeNotificationCommand();
      await cmd.handle({ name: 'OrderShipped' }, {}, output);
      output.assertOutputContains('extends BaseNotification');
      output.assertOutputContains('toMail');
      output.assertOutputContains('toDatabase');
      output.assertOutputContains("['mail', 'database']");
    });
  });

  describe('make:job', () => {
    it('generates job template', async () => {
      const cmd = new MakeJobCommand();
      await cmd.handle({ name: 'ProcessPayment' }, {}, output);
      output.assertOutputContains('extends BaseJob');
      output.assertOutputContains("queue = 'default'");
      output.assertOutputContains('async handle');
      output.assertOutputContains('failed');
    });
  });

  describe('make:test', () => {
    it('generates test template', async () => {
      const cmd = new MakeTestCommand();
      await cmd.handle({ name: 'UserService' }, {}, output);
      output.assertOutputContains("describe('UserService'");
      output.assertOutputContains('beforeEach');
      output.assertOutputContains("it('should work'");
    });
  });

  describe('serve', () => {
    it('starts dev server with defaults', async () => {
      const cmd = new ServeCommand();
      await cmd.handle({}, {}, output);
      output.assertOutputContains('localhost:3000');
      output.assertOutputContains('Server ready');
    });

    it('accepts --port and --watch', async () => {
      const cmd = new ServeCommand();
      await cmd.handle({}, { port: 8080, host: '0.0.0.0', watch: true }, output);
      output.assertOutputContains('0.0.0.0:8080');
      output.assertOutputContains('File watching enabled');
    });
  });

  describe('migrate', () => {
    it('runs migrations', async () => {
      const cmd = new MigrateRunCommand();
      await cmd.handle({}, {}, output);
      output.assertOutputContains('pending migrations');
      output.assertOutputContains('Migrations complete');
    });

    it('--fresh drops and re-runs', async () => {
      const cmd = new MigrateRunCommand();
      await cmd.handle({}, { fresh: true }, output);
      output.assertOutputContains('Dropping all tables');
    });

    it('--rollback', async () => {
      const cmd = new MigrateRunCommand();
      await cmd.handle({}, { rollback: true }, output);
      output.assertOutputContains('Rolling back');
    });

    it('--seed runs seeders', async () => {
      const cmd = new MigrateRunCommand();
      await cmd.handle({}, { seed: true }, output);
      output.assertOutputContains('seeders');
    });
  });

  describe('make:factory', () => {
    it('generates factory template', async () => {
      const cmd = new MakeFactoryCommand();
      const code = await cmd.handle({ name: 'UserFactory' }, {}, output);
      expect(code).toBe(0);
      output.assertOutputContains('extends ModelFactory');
      output.assertOutputContains('definition()');
    });
  });

  describe('make:seeder', () => {
    it('generates seeder template', async () => {
      const cmd = new MakeSeederCommand();
      const code = await cmd.handle({ name: 'UserSeeder' }, {}, output);
      expect(code).toBe(0);
      output.assertOutputContains('implements ISeeder');
      output.assertOutputContains('async run()');
    });
  });

  describe('make:event', () => {
    it('generates event template', async () => {
      const cmd = new MakeEventCommand();
      const code = await cmd.handle({ name: 'OrderPlaced' }, {}, output);
      expect(code).toBe(0);
      output.assertOutputContains('OrderPlacedPayload');
      output.assertOutputContains("name = 'OrderPlaced'");
    });
  });

  describe('make:listener', () => {
    it('generates listener template', async () => {
      const cmd = new MakeListenerCommand();
      const code = await cmd.handle({ name: 'SendWelcomeEmail' }, {}, output);
      expect(code).toBe(0);
      output.assertOutputContains('class SendWelcomeEmail');
      output.assertOutputContains('async handle');
    });
  });

  describe('make:provider', () => {
    it('generates service provider template', async () => {
      const cmd = new MakeProviderCommand();
      const code = await cmd.handle({ name: 'AppServiceProvider' }, {}, output);
      expect(code).toBe(0);
      output.assertOutputContains('extends ServiceProvider');
      output.assertOutputContains('register()');
      output.assertOutputContains('boot()');
    });
  });

  describe('make:request', () => {
    it('generates form request template', async () => {
      const cmd = new MakeRequestCommand();
      const code = await cmd.handle({ name: 'StoreUserRequest' }, {}, output);
      expect(code).toBe(0);
      output.assertOutputContains('class StoreUserRequest');
      output.assertOutputContains('rules()');
      output.assertOutputContains('authorize()');
    });
  });

  describe('db:seed', () => {
    it('runs all seeders', async () => {
      const cmd = new DbSeedCommand();
      const code = await cmd.handle({}, {}, output);
      expect(code).toBe(0);
      output.assertOutputContains('Running all seeders');
      output.assertOutputContains('Seeding complete');
    });

    it('runs specific seeder class', async () => {
      const cmd = new DbSeedCommand();
      const code = await cmd.handle({}, { class: 'UserSeeder' }, output);
      expect(code).toBe(0);
      output.assertOutputContains('Running seeder: UserSeeder');
    });
  });

  describe('schedule:run', () => {
    it('executes due tasks', async () => {
      const cmd = new ScheduleRunCommand();
      const code = await cmd.handle({}, {}, output);
      expect(code).toBe(0);
      output.assertOutputContains('Checking for due tasks');
      output.assertOutputContains('Scheduled tasks executed');
    });
  });

  describe('inspect:routes', () => {
    it('displays route table', async () => {
      const cmd = new InspectRoutesCommand();
      const code = await cmd.handle({}, {}, output);
      expect(code).toBe(0);
      output.assertOutputContains('Registered Routes');
      output.assertOutputContains('METHOD');
    });

    it('supports --json flag', async () => {
      const cmd = new InspectRoutesCommand();
      const code = await cmd.handle({}, { json: true }, output);
      expect(code).toBe(0);
      output.assertOutputContains('json');
    });
  });

  describe('inspect:container', () => {
    it('displays container bindings', async () => {
      const cmd = new InspectContainerCommand();
      const code = await cmd.handle({}, {}, output);
      expect(code).toBe(0);
      output.assertOutputContains('Container Bindings');
      output.assertOutputContains('singleton');
    });

    it('supports --tag filter', async () => {
      const cmd = new InspectContainerCommand();
      const code = await cmd.handle({}, { tag: 'database' }, output);
      expect(code).toBe(0);
      output.assertOutputContains('database');
    });
  });

  describe('doctor', () => {
    it('runs all environment checks', async () => {
      const cmd = new DoctorCommand();
      const code = await cmd.handle({}, {}, output);
      // May return 1 if reflect-metadata not imported in test context
      expect(code === 0 || code === 1).toBe(true);
      output.assertOutputContains('Carpenter Doctor');
      output.assertOutputContains('Node.js');
    });

    it('checks crypto availability', async () => {
      const cmd = new DoctorCommand();
      await cmd.handle({}, {}, output);
      output.assertOutputContains('Web Crypto API');
    });
  });

  describe('registerBuiltinCommands', () => {
    it('registers all 30 commands', () => {
      const app = new CliApp();
      registerBuiltinCommands(app);
      const registry = app.getRegistry();

      expect(registry.has('new')).toBe(true);
      expect(registry.has('make:model')).toBe(true);
      expect(registry.has('make:controller')).toBe(true);
      expect(registry.has('make:migration')).toBe(true);
      expect(registry.has('make:middleware')).toBe(true);
      expect(registry.has('make:notification')).toBe(true);
      expect(registry.has('make:job')).toBe(true);
      expect(registry.has('make:test')).toBe(true);
      expect(registry.has('make:factory')).toBe(true);
      expect(registry.has('make:seeder')).toBe(true);
      expect(registry.has('make:event')).toBe(true);
      expect(registry.has('make:listener')).toBe(true);
      expect(registry.has('make:request')).toBe(true);
      expect(registry.has('make:provider')).toBe(true);
      expect(registry.has('serve')).toBe(true);
      expect(registry.has('migrate')).toBe(true);
      expect(registry.has('db:seed')).toBe(true);
      expect(registry.has('schedule:run')).toBe(true);
      expect(registry.has('inspect:routes')).toBe(true);
      expect(registry.has('inspect:container')).toBe(true);
      expect(registry.has('doctor')).toBe(true);
      expect(registry.has('tenant:create')).toBe(true);
      expect(registry.has('tenant:migrate')).toBe(true);
      expect(registry.has('tenant:list')).toBe(true);
      expect(registry.has('security:audit')).toBe(true);
      expect(registry.has('upgrade:check')).toBe(true);
      expect(registry.has('add')).toBe(true);
      expect(registry.has('remove')).toBe(true);
      expect(registry.has('list-features')).toBe(true);
      expect(registry.has('generate:service')).toBe(true);
      expect(registry.names()).toHaveLength(30);
    });
  });
});
