import { makeDaily } from '../src/tickets/daily';
import { expect, openTicket, playTicket, test } from './desk';

// Freeze only the wall clock (timers keep running, PostgreSQL needs them).
const noon = (date: string) => new Date(`${date}T12:00:00+07:00`);

test('the daily ticket changes with the date and builds a streak', async ({ desk }) => {
  await desk.clock.setFixedTime(noon('2026-11-11'));
  await desk.reload();
  await openTicket(desk, 'daily');
  await playTicket(desk, makeDaily('2026-11-11'));
  await expect(desk.getByTestId('streak')).toHaveText('streak 1');

  await desk.clock.setFixedTime(noon('2026-11-12'));
  await desk.reload();
  await expect(desk.getByTestId('run')).toBeEnabled({ timeout: 45_000 });
  await desk.locator('.start').click();
  await expect(desk.locator('[data-ticket="daily"]')).toHaveAttribute('data-status', 'new');
  await openTicket(desk, 'daily');
  await playTicket(desk, makeDaily('2026-11-12'));
  await expect(desk.getByTestId('streak')).toHaveText('streak 2');
});
