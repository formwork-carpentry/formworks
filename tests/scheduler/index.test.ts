import { describe, expect, it, vi } from 'vitest';

import { FrequencyBuilder, Scheduler, isDue, parseCron } from '../../src/scheduler/index.js';

describe('scheduler/index', () => {
  it('parses cron expressions and checks due timestamps', () => {
    // Arrange
    const expression = '15 10 * * 2';
    const due = new Date('2026-03-24T10:15:00Z');

    // Act
    const parsed = parseCron(expression);

    // Assert
    expect(parsed.minute).toContain(15);
    expect(parsed.hour).toContain(10);
    expect(isDue(expression, due)).toBe(true);
  });

  it('builds common frequencies fluently', () => {
    // Arrange
    const builder = new FrequencyBuilder();

    // Act
    const expression = builder.weeklyOn(2, 9, 30).getExpression();

    // Assert
    expect(expression).toBe('30 9 * * 2');
  });

  it('runs due scheduled tasks and records history', async () => {
    // Arrange
    const scheduler = new Scheduler();
    const handler = vi.fn(async () => {});
    const now = new Date('2026-03-24T12:34:00Z');
    const expr = `${now.getUTCMinutes()} ${now.getUTCHours()} * * *`;

    scheduler.schedule('job.ping', handler).cron(expr);

    // Act
    const results = await scheduler.runDue(now);

    // Assert
    expect(results.length).toBe(1);
    expect(results[0]?.task).toBe('job.ping');
    expect(results[0]?.success).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    scheduler.assertTaskRan('job.ping');
  });
});
