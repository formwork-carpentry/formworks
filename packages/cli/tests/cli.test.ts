import { describe, it, expect, beforeEach } from 'vitest';
import {
  BaseCommand, CommandRegistry, CliApp, InMemoryConsole, parseArgv,
} from '../src/index.js';
import type { CommandOutput } from '../src/index.js';

// ── Test Command Fixtures ─────────────────────────────────

class GreetCommand extends BaseCommand {
  name = 'greet';
  description = 'Greet a user';
  constructor() {
    super();
    this.argument('name', 'Name to greet');
    this.option('loud', 'Use uppercase', 'boolean');
    this.shortOption('times', 't', 'Repeat N times', 'number');
  }
  async handle(args: Record<string, string>, options: Record<string, unknown>, output: CommandOutput): Promise<number> {
    const name = args['name'];
    const loud = options['loud'] as boolean;
    const times = (options['times'] as number) || 1;
    for (let i = 0; i < times; i++) {
      const msg = `Hello, ${name}!`;
      output.info(loud ? msg.toUpperCase() : msg);
    }
    return 0;
  }
}

class MigrateCommand extends BaseCommand {
  name = 'migrate';
  description = 'Run database migrations';
  constructor() {
    super();
    this.option('seed', 'Run seeders after migration', 'boolean');
    this.option('step', 'Number of migrations to run', 'number');
  }
  async handle(_args: Record<string, string>, options: Record<string, unknown>, output: CommandOutput): Promise<number> {
    const step = options['step'] as number | undefined;
    output.info(`Running migrations${step ? ` (${step} steps)` : ''}...`);
    if (options['seed']) output.info('Running seeders...');
    output.success('Migrations complete.');
    return 0;
  }
}

class FailCommand extends BaseCommand {
  name = 'fail';
  description = 'Always fails';
  async handle(_a: Record<string, string>, _o: Record<string, unknown>, output: CommandOutput): Promise<number> {
    output.error('Something went wrong');
    return 1;
  }
}

// ── parseArgv ─────────────────────────────────────────────

describe('@carpentry/cli: parseArgv', () => {
  it('parses positional arguments', () => {
    const { args } = parseArgv(
      ['Alice'],
      [{ name: 'name', description: 'Name', required: true }],
      [],
    );
    expect(args['name']).toBe('Alice');
  });

  it('parses --key=value options', () => {
    const { options } = parseArgv(
      ['--host=localhost', '--port=3000'],
      [],
      [{ name: 'host', description: '', type: 'string' }, { name: 'port', description: '', type: 'number' }],
    );
    expect(options['host']).toBe('localhost');
    expect(options['port']).toBe(3000);
  });

  it('parses --key value options', () => {
    const { options } = parseArgv(
      ['--name', 'Alice'],
      [],
      [{ name: 'name', description: '', type: 'string' }],
    );
    expect(options['name']).toBe('Alice');
  });

  it('parses boolean flags', () => {
    const { options } = parseArgv(
      ['--verbose'],
      [],
      [{ name: 'verbose', description: '', type: 'boolean' }],
    );
    expect(options['verbose']).toBe(true);
  });

  it('boolean defaults to false', () => {
    const { options } = parseArgv(
      [],
      [],
      [{ name: 'verbose', description: '', type: 'boolean' }],
    );
    expect(options['verbose']).toBe(false);
  });

  it('parses short flags', () => {
    const { options } = parseArgv(
      ['-v'],
      [],
      [{ name: 'verbose', short: 'v', description: '', type: 'boolean' }],
    );
    expect(options['verbose']).toBe(true);
  });

  it('parses mixed args and options', () => {
    const { args, options } = parseArgv(
      ['Alice', '--loud', '-t', '3'],
      [{ name: 'name', description: '', required: true }],
      [{ name: 'loud', description: '', type: 'boolean' }, { name: 'times', short: 't', description: '', type: 'number' }],
    );
    expect(args['name']).toBe('Alice');
    expect(options['loud']).toBe(true);
    expect(options['times']).toBe(3);
  });

  it('applies default values', () => {
    const { args, options } = parseArgv(
      [],
      [{ name: 'env', description: '', defaultValue: 'production' }],
      [{ name: 'port', description: '', type: 'number', defaultValue: 3000 }],
    );
    expect(args['env']).toBe('production');
    expect(options['port']).toBe(3000);
  });
});

// ── InMemoryConsole ───────────────────────────────────────

describe('@carpentry/cli: InMemoryConsole', () => {
  let console: InMemoryConsole;

  beforeEach(() => { console = new InMemoryConsole(); });

  it('captures info/error/warn/success', () => {
    console.info('info msg');
    console.error('error msg');
    console.warn('warn msg');
    console.success('success msg');

    expect(console.count()).toBe(4);
    console.assertOutputContains('info msg');
    console.assertOutputContains('error msg');
  });

  it('captures table output', () => {
    console.table(['Name', 'Age'], [['Alice', '30'], ['Bob', '25']]);
    console.assertOutputContains('Alice');
    console.assertOutputContains('Bob');
  });

  it('assertNoErrors()', () => {
    console.info('ok');
    console.assertNoErrors();
  });

  it('assertHasError()', () => {
    console.error('boom');
    console.assertHasError('boom');
  });

  it('getErrors()', () => {
    console.error('e1');
    console.error('e2');
    console.info('ok');
    expect(console.getErrors()).toEqual(['e1', 'e2']);
  });

  it('assertOutputNotContains()', () => {
    console.info('hello');
    console.assertOutputNotContains('secret');
  });
});

// ── CommandRegistry ───────────────────────────────────────

describe('@carpentry/cli: CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
    registry.register(new GreetCommand());
    registry.register(new MigrateCommand());
  });

  it('registers and retrieves commands', () => {
    expect(registry.has('greet')).toBe(true);
    expect(registry.has('migrate')).toBe(true);
    expect(registry.has('nope')).toBe(false);
  });

  it('names() lists all commands', () => {
    expect(registry.names()).toEqual(['greet', 'migrate']);
  });

  it('help() generates command help', () => {
    const help = registry.help('greet');
    expect(help).toContain('greet');
    expect(help).toContain('Name to greet');
    expect(help).toContain('--loud');
  });

  it('helpAll() lists all commands', () => {
    const help = registry.helpAll();
    expect(help).toContain('greet');
    expect(help).toContain('migrate');
  });
});

// ── CliApp ────────────────────────────────────────────────

describe('@carpentry/cli: CliApp', () => {
  let app: CliApp;
  let output: InMemoryConsole;

  beforeEach(() => {
    output = new InMemoryConsole();
    app = new CliApp(undefined, output);
    app.register(new GreetCommand());
    app.register(new MigrateCommand());
    app.register(new FailCommand());
  });

  it('runs a command successfully', async () => {
    const code = await app.run(['greet', 'Alice'], output);
    expect(code).toBe(0);
    output.assertOutputContains('Hello, Alice!');
  });

  it('passes options to command', async () => {
    await app.run(['greet', 'Bob', '--loud'], output);
    output.assertOutputContains('HELLO, BOB!');
  });

  it('passes short options', async () => {
    await app.run(['greet', 'Alice', '-t', '3'], output);
    const lines = output.all().filter((l) => l.content.includes('Hello'));
    expect(lines).toHaveLength(3);
  });

  it('returns non-zero for failed commands', async () => {
    const code = await app.run(['fail'], output);
    expect(code).toBe(1);
    output.assertHasError('Something went wrong');
  });

  it('returns 1 for unknown command', async () => {
    const code = await app.run(['nonexistent'], output);
    expect(code).toBe(1);
    output.assertHasError('Unknown command');
  });

  it('shows help for --help flag', async () => {
    await app.run(['greet', '--help'], output);
    output.assertOutputContains('Name to greet');
  });

  it('shows all commands for "help"', async () => {
    await app.run(['help'], output);
    output.assertOutputContains('greet');
    output.assertOutputContains('migrate');
  });

  it('validates required arguments', async () => {
    const code = await app.run(['greet'], output); // missing required 'name'
    expect(code).toBe(1);
    output.assertHasError('Missing required argument');
  });

  it('migrate command with options', async () => {
    await app.run(['migrate', '--seed', '--step', '5'], output);
    output.assertOutputContains('5 steps');
    output.assertOutputContains('seeders');
  });
});
