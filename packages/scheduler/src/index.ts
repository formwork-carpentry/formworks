/**
 * @module @formwork/scheduler
 * @description Task scheduling — cron expressions, frequency builder, and due-task resolution (in-memory).
 *
 * Use this package to:
 * - Define scheduled tasks with cron expressions
 * - Build common schedules with {@link FrequencyBuilder}
 * - Execute tasks that are due at a given time using {@link Scheduler.runDue}
 *
 * @example
 * ```ts
 * import { Scheduler } from '@formwork/scheduler';
 *
 * const scheduler = new Scheduler();
 *
 * // Schedule a task that will be due in the current minute/hour.
 * const now = new Date();
 * const cron = `${now.getMinutes()} ${now.getHours()} * * *`;
 *
 * scheduler
 *   .schedule('ping', async () => {
 *     // do work
 *   })
 *   .cron(cron);
 *
 * const results = await scheduler.runDue(now);
 * // results contains success/error + duration per task
 * ```
 *
 * @see Scheduler — Register tasks and run due tasks
 * @see FrequencyBuilder — Convenience cron helpers
 * @patterns Builder (frequency), Command (scheduled tasks), Registry (task list)
 */

// ── Types ─────────────────────────────────────────────────

export type ScheduledTaskHandler = () => Promise<void> | void;

export interface ScheduledTask {
  name: string;
  handler: ScheduledTaskHandler;
  expression: string;      // cron expression "* * * * *"
  timezone?: string;
  overlapping: boolean;
  description?: string;
  lastRanAt?: Date;
  enabled: boolean;
}

// ── Cron Parser (simplified) ──────────────────────────────

/**
 * @param {string} expression
 */
export function parseCron(expression: string): { minute: number[]; hour: number[]; dayOfMonth: number[]; month: number[]; dayOfWeek: number[] } {
  const parts = expression.trim().split(/\s+/);
  /**
   * @param {unknown} [parts.length !== 5]
   */
  if (parts.length !== 5) throw new Error(`Invalid cron expression: "${expression}". Expected 5 fields.`);

  return {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dayOfMonth: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12),
    dayOfWeek: parseField(parts[4], 0, 6),
  };
}

function parseField(field: string, min: number, max: number): number[] {
  /**
   * @param {unknown} [field === '*']
   */
  if (field === '*') return range(min, max);

  const values = new Set<number>();
  /**
   * @param {unknown} const part of field.split(','
   */
  for (const part of field.split(',')) {
    if (part.includes('/')) {
      const [base, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      const start = base === '*' ? min : parseInt(base, 10);
      for (let i = start; i <= max; i += step) values.add(i);
    } else if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number);
      for (let i = lo; i <= hi; i++) values.add(i);
    } else {
      values.add(parseInt(part, 10));
    }
  }
  return [...values].sort((a, b) => a - b);
}

function range(min: number, max: number): number[] {
  const r: number[] = [];
  /**
   * @param {unknown} [let i = min; i <= max; i++]
   */
  for (let i = min; i <= max; i++) r.push(i);
  return r;
}

/** Check if a cron expression is due at a given time */
/**
 * @param {string} expression
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isDue(expression: string, now: Date = new Date()): boolean {
  const cron = parseCron(expression);
  /**
   * @param {unknown} cron.minute.includes(now.getMinutes(
   */
  return (
    cron.minute.includes(now.getMinutes()) &&
    cron.hour.includes(now.getHours()) &&
    cron.dayOfMonth.includes(now.getDate()) &&
    cron.month.includes(now.getMonth() + 1) &&
    cron.dayOfWeek.includes(now.getDay())
  );
}

// ── Frequency Builder ─────────────────────────────────────

/**
 * FrequencyBuilder — builds cron expressions fluently.
 *
 * Used with {@link Scheduler.schedule}, for example:
 * `scheduler.schedule('ping', handler).everyMinute()`.
 */
export class FrequencyBuilder {
  private expr = '* * * * *';

  /** Raw cron expression */
  /**
   * @param {string} expression
   * @returns {this}
   */
  cron(expression: string): this { this.expr = expression; return this; }

  everyMinute(): this { this.expr = '* * * * *'; return this; }
  everyFiveMinutes(): this { this.expr = '*/5 * * * *'; return this; }
  everyTenMinutes(): this { this.expr = '*/10 * * * *'; return this; }
  everyFifteenMinutes(): this { this.expr = '*/15 * * * *'; return this; }
  everyThirtyMinutes(): this { this.expr = '*/30 * * * *'; return this; }
  hourly(): this { this.expr = '0 * * * *'; return this; }
  /**
   * @param {number} minute
   * @returns {this}
   */
  hourlyAt(minute: number): this { this.expr = `${minute} * * * *`; return this; }
  daily(): this { this.expr = '0 0 * * *'; return this; }
  /**
   * @param {number} hour
   * @param {number} [minute]
   * @returns {this}
   */
  dailyAt(hour: number, minute: number = 0): this { this.expr = `${minute} ${hour} * * *`; return this; }
  weekly(): this { this.expr = '0 0 * * 0'; return this; }
  /**
   * @param {number} day
   * @param {number} [hour]
   * @param {number} [minute]
   * @returns {this}
   */
  weeklyOn(day: number, hour: number = 0, minute: number = 0): this { this.expr = `${minute} ${hour} * * ${day}`; return this; }
  monthly(): this { this.expr = '0 0 1 * *'; return this; }
  /**
   * @param {number} day
   * @param {number} [hour]
   * @param {number} [minute]
   * @returns {this}
   */
  monthlyOn(day: number, hour: number = 0, minute: number = 0): this { this.expr = `${minute} ${hour} ${day} * *`; return this; }
  yearly(): this { this.expr = '0 0 1 1 *'; return this; }
  weekdays(): this { this.expr = '0 0 * * 1-5'; return this; }
  weekends(): this { this.expr = '0 0 * * 0,6'; return this; }

  getExpression(): string { return this.expr; }
}

// ── Scheduler ─────────────────────────────────────────────

/**
 * Scheduler — register tasks with schedules and run due tasks.
 *
 * This in-memory scheduler keeps a list of tasks and checks due times against a
 * simplified cron matcher. Use `schedule()` to register tasks, then call `runDue()`
 * periodically from your loop.
 *
 * @example
 * ```ts
 * const scheduler = new Scheduler();
 *
 * scheduler
 *   .schedule('ping', async () => {
 *     // do work
 *   })
 *   .hourly();
 *
 * const results = await scheduler.runDue(new Date());
 * // results contains one entry per due task
 * ```
 */
export class Scheduler {
  private tasks: ScheduledTask[] = [];
  private running = new Set<string>();
  private history: Array<{ task: string; ranAt: Date; durationMs: number; error?: string }> = [];

  /** Register a task with a fluent frequency builder */
  /**
   * @param {string} name
   * @param {ScheduledTaskHandler} handler
   * @returns {TaskBuilder}
   */
  schedule(name: string, handler: ScheduledTaskHandler): TaskBuilder {
    const task: ScheduledTask = {
      name, handler, expression: '* * * * *',
      overlapping: false, enabled: true,
    };
    this.tasks.push(task);
    return new TaskBuilder(task);
  }

  /** Get all tasks that are due right now */
  /**
   * @param {Date} [now]
   * @returns {ScheduledTask[]}
   */
  dueAt(now: Date = new Date()): ScheduledTask[] {
    return this.tasks.filter((t) => t.enabled && isDue(t.expression, now));
  }

  /** Run all due tasks */
  /**
   * @param {Date} [now]
   * @returns {Promise<Array<}
   */
  async runDue(now: Date = new Date()): Promise<Array<{ task: string; success: boolean; durationMs: number; error?: string }>> {
    const due = this.dueAt(now);
    const results: Array<{ task: string; success: boolean; durationMs: number; error?: string }> = [];

    for (const task of due) {
      if (!task.overlapping && this.running.has(task.name)) continue;

      this.running.add(task.name);
      const start = Date.now();
      try {
        await task.handler();
        const duration = Date.now() - start;
        task.lastRanAt = now;
        this.history.push({ task: task.name, ranAt: now, durationMs: duration });
        results.push({ task: task.name, success: true, durationMs: duration });
      } catch (error) {
        const duration = Date.now() - start;
        const errMsg = (error as Error).message;
        this.history.push({ task: task.name, ranAt: now, durationMs: duration, error: errMsg });
        results.push({ task: task.name, success: false, durationMs: duration, error: errMsg });
      } finally {
        this.running.delete(task.name);
      }
    }
    return results;
  }

  /** Run a specific task by name (regardless of schedule) */
  /**
   * @param {string} name
   * @returns {Promise<void>}
   */
  async runTask(name: string): Promise<void> {
    const task = this.tasks.find((t) => t.name === name);
    if (!task) throw new Error(`Task "${name}" not found.`);
    await task.handler();
    task.lastRanAt = new Date();
  }

  getTasks(): ScheduledTask[] { return [...this.tasks]; }
  getHistory(): typeof this.history { return [...this.history]; }

  /**
   * @param {string} name
   */
  assertTaskExists(name: string): void {
    if (!this.tasks.some((t) => t.name === name)) throw new Error(`Task "${name}" not found.`);
  }

  /**
   * @param {string} name
   */
  assertTaskRan(name: string): void {
    if (!this.history.some((h) => h.task === name)) throw new Error(`Task "${name}" never ran.`);
  }

  /**
   * @param {string} name
   * @param {number} times
   */
  assertTaskRanTimes(name: string, times: number): void {
    const count = this.history.filter((h) => h.task === name).length;
    if (count !== times) throw new Error(`Expected "${name}" to run ${times} times, ran ${count}.`);
  }

  reset(): void { this.tasks = []; this.running.clear(); this.history = []; }
}

class TaskBuilder {
  private frequency = new FrequencyBuilder();
  constructor(private task: ScheduledTask) {}

  /**
   * @param {string} expr
   * @returns {this}
   */
  cron(expr: string): this { this.task.expression = expr; return this; }
  everyMinute(): this { this.frequency.everyMinute(); this.task.expression = this.frequency.getExpression(); return this; }
  everyFiveMinutes(): this { this.frequency.everyFiveMinutes(); this.task.expression = this.frequency.getExpression(); return this; }
  everyTenMinutes(): this { this.frequency.everyTenMinutes(); this.task.expression = this.frequency.getExpression(); return this; }
  everyFifteenMinutes(): this { this.frequency.everyFifteenMinutes(); this.task.expression = this.frequency.getExpression(); return this; }
  hourly(): this { this.frequency.hourly(); this.task.expression = this.frequency.getExpression(); return this; }
  /**
   * @param {number} m
   * @returns {this}
   */
  hourlyAt(m: number): this { this.frequency.hourlyAt(m); this.task.expression = this.frequency.getExpression(); return this; }
  daily(): this { this.frequency.daily(); this.task.expression = this.frequency.getExpression(); return this; }
  /**
   * @param {number} h
   * @param {number} [m]
   * @returns {this}
   */
  dailyAt(h: number, m?: number): this { this.frequency.dailyAt(h, m); this.task.expression = this.frequency.getExpression(); return this; }
  weekly(): this { this.frequency.weekly(); this.task.expression = this.frequency.getExpression(); return this; }
  /**
   * @param {number} d
   * @param {number} [h]
   * @param {number} [m]
   * @returns {this}
   */
  weeklyOn(d: number, h?: number, m?: number): this { this.frequency.weeklyOn(d, h, m); this.task.expression = this.frequency.getExpression(); return this; }
  monthly(): this { this.frequency.monthly(); this.task.expression = this.frequency.getExpression(); return this; }
  yearly(): this { this.frequency.yearly(); this.task.expression = this.frequency.getExpression(); return this; }
  weekdays(): this { this.frequency.weekdays(); this.task.expression = this.frequency.getExpression(); return this; }
  weekends(): this { this.frequency.weekends(); this.task.expression = this.frequency.getExpression(); return this; }
  withoutOverlapping(): this { this.task.overlapping = false; return this; }
  allowOverlapping(): this { this.task.overlapping = true; return this; }
  /**
   * @param {string} desc
   * @returns {this}
   */
  description(desc: string): this { this.task.description = desc; return this; }
  disable(): this { this.task.enabled = false; return this; }
}
