import { describe, it, expect, beforeEach } from 'vitest';
import { parseCron, isDue, FrequencyBuilder, Scheduler } from '../src/index.js';

describe('@carpentry/scheduler: parseCron', () => {
  it('parses wildcard', () => {
    const cron = parseCron('* * * * *');
    expect(cron.minute).toHaveLength(60);
    expect(cron.hour).toHaveLength(24);
  });

  it('parses specific values', () => {
    const cron = parseCron('30 14 * * *');
    expect(cron.minute).toEqual([30]);
    expect(cron.hour).toEqual([14]);
  });

  it('parses step values', () => {
    const cron = parseCron('*/15 * * * *');
    expect(cron.minute).toEqual([0, 15, 30, 45]);
  });

  it('parses ranges', () => {
    const cron = parseCron('0 9-17 * * *');
    expect(cron.hour).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it('parses comma-separated', () => {
    const cron = parseCron('0 0 * * 1,3,5');
    expect(cron.dayOfWeek).toEqual([1, 3, 5]);
  });

  it('throws on invalid expression', () => {
    expect(() => parseCron('* * *')).toThrow('Invalid cron');
  });
});

describe('@carpentry/scheduler: isDue', () => {
  it('every minute is always due', () => {
    expect(isDue('* * * * *')).toBe(true);
  });

  it('specific time matches', () => {
    const now = new Date(2025, 0, 15, 14, 30, 0); // Jan 15, 2025, 14:30, Wednesday (day 3)
    expect(isDue('30 14 * * *', now)).toBe(true);
    expect(isDue('0 14 * * *', now)).toBe(false); // wrong minute
    expect(isDue('30 15 * * *', now)).toBe(false); // wrong hour
  });

  it('day of week filter', () => {
    const wednesday = new Date(2025, 0, 15, 0, 0); // Wednesday = 3
    expect(isDue('0 0 * * 3', wednesday)).toBe(true);
    expect(isDue('0 0 * * 1', wednesday)).toBe(false);
  });

  it('monthly on specific day', () => {
    const jan1 = new Date(2025, 0, 1, 0, 0);
    const jan15 = new Date(2025, 0, 15, 0, 0);
    expect(isDue('0 0 1 * *', jan1)).toBe(true);
    expect(isDue('0 0 1 * *', jan15)).toBe(false);
  });
});

describe('@carpentry/scheduler: FrequencyBuilder', () => {
  it('everyMinute', () => { expect(new FrequencyBuilder().everyMinute().getExpression()).toBe('* * * * *'); });
  it('everyFiveMinutes', () => { expect(new FrequencyBuilder().everyFiveMinutes().getExpression()).toBe('*/5 * * * *'); });
  it('hourly', () => { expect(new FrequencyBuilder().hourly().getExpression()).toBe('0 * * * *'); });
  it('hourlyAt(15)', () => { expect(new FrequencyBuilder().hourlyAt(15).getExpression()).toBe('15 * * * *'); });
  it('daily', () => { expect(new FrequencyBuilder().daily().getExpression()).toBe('0 0 * * *'); });
  it('dailyAt(9, 30)', () => { expect(new FrequencyBuilder().dailyAt(9, 30).getExpression()).toBe('30 9 * * *'); });
  it('weekly', () => { expect(new FrequencyBuilder().weekly().getExpression()).toBe('0 0 * * 0'); });
  it('monthly', () => { expect(new FrequencyBuilder().monthly().getExpression()).toBe('0 0 1 * *'); });
  it('yearly', () => { expect(new FrequencyBuilder().yearly().getExpression()).toBe('0 0 1 1 *'); });
  it('weekdays', () => { expect(new FrequencyBuilder().weekdays().getExpression()).toBe('0 0 * * 1-5'); });
  it('weekends', () => { expect(new FrequencyBuilder().weekends().getExpression()).toBe('0 0 * * 0,6'); });
});

describe('@carpentry/scheduler: Scheduler', () => {
  let scheduler: Scheduler;
  let log: string[];

  beforeEach(() => {
    scheduler = new Scheduler();
    log = [];
  });

  it('registers and lists tasks', () => {
    scheduler.schedule('cleanup', () => { log.push('cleanup'); }).daily();
    scheduler.schedule('backup', () => { log.push('backup'); }).weekly();

    expect(scheduler.getTasks()).toHaveLength(2);
    scheduler.assertTaskExists('cleanup');
    scheduler.assertTaskExists('backup');
  });

  it('runDue() executes due tasks', async () => {
    scheduler.schedule('always', () => { log.push('ran'); }).everyMinute();

    const results = await scheduler.runDue();
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(log).toEqual(['ran']);
    scheduler.assertTaskRan('always');
  });

  it('runDue() skips non-due tasks', async () => {
    // Schedule at midnight on Jan 1
    scheduler.schedule('yearly', () => { log.push('ran'); }).yearly();

    const midday = new Date(2025, 5, 15, 12, 30);
    const results = await scheduler.runDue(midday);
    expect(results).toHaveLength(0);
    expect(log).toEqual([]);
  });

  it('runTask() executes by name regardless of schedule', async () => {
    scheduler.schedule('manual', () => { log.push('manual'); }).yearly();
    await scheduler.runTask('manual');
    expect(log).toEqual(['manual']);
  });

  it('runTask() throws for unknown task', async () => {
    await expect(scheduler.runTask('nope')).rejects.toThrow('not found');
  });

  it('handles task errors gracefully', async () => {
    scheduler.schedule('failing', () => { throw new Error('boom'); }).everyMinute();

    const results = await scheduler.runDue();
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBe('boom');
  });

  it('tracks history', async () => {
    scheduler.schedule('task1', () => {}).everyMinute();
    await scheduler.runDue();
    await scheduler.runDue();

    const history = scheduler.getHistory();
    expect(history).toHaveLength(2);
    scheduler.assertTaskRanTimes('task1', 2);
  });

  it('disabled tasks are skipped', async () => {
    scheduler.schedule('disabled', () => { log.push('ran'); }).everyMinute().disable();
    await scheduler.runDue();
    expect(log).toEqual([]);
  });

  it('description()', () => {
    scheduler.schedule('cleanup', () => {}).daily().description('Clean old sessions');
    expect(scheduler.getTasks()[0].description).toBe('Clean old sessions');
  });
});
