import { TICKETS } from '../src/tickets';
import { APP_NAME } from '../src/config';
import { expect, openTicket, run, test } from './desk';

test('boots PostgreSQL and lists every ticket @smoke', async ({ desk }) => {
  await expect(desk).toHaveTitle(APP_NAME);
  await expect(desk.locator('[data-ticket]')).toHaveCount(TICKETS.length + 1); // + the daily ticket
});

test('runs a query against the seeded database @smoke', async ({ desk }) => {
  await openTicket(desk, 't01');
  await run(desk, 'SELECT count(*) AS n FROM door_logs');
  await expect(desk.getByTestId('result')).toContainText('36');
  await expect(desk.getByTestId('status')).toContainText('1 row');
});
