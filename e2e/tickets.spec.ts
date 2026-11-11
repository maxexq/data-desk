// One ticket per judge type, played through the UI with the ticket's own model answers.
import { expect, openTicket, playTicket, run, submit, test, ticketOf } from './desk';

const failed = '[data-testid="report-line"][data-ok="false"]';

test('result check: T-101 closes and awards XP', async ({ desk }) => {
  const t = ticketOf('t01');
  await openTicket(desk, t.id);
  await playTicket(desk, t);
  await expect(desk.getByTestId('xp')).toHaveText(`${t.xp} XP`);
});

test('result check: a wrong answer does not advance', async ({ desk }) => {
  await openTicket(desk, 't02');
  await run(desk, 'SELECT branch_id, 1 FROM orders GROUP BY branch_id');
  await expect(desk.locator('[data-task-state="done"]')).toHaveCount(0);
});

test('state check: T-104 starts inside an open transaction and needs COMMIT', async ({ desk }) => {
  const t = ticketOf('t04');
  await openTicket(desk, t.id);
  await expect(desk.getByTestId('txn')).toBeVisible();

  await submit(desk); // nothing done yet
  await expect(desk.getByTestId('report')).toHaveAttribute('data-pass', 'false');

  await run(desk, 'ROLLBACK');
  await expect(desk.getByTestId('txn')).toBeHidden();
  await submit(desk);
  await expect(desk.locator('[data-task-state="done"]')).toHaveCount(1);

  // Correct change, but never committed: must not count.
  await run(desk, "BEGIN; UPDATE menu SET price_baht = 89 WHERE name = 'Mango Sticky Rice';");
  await expect(desk.getByTestId('txn')).toBeVisible();
  await submit(desk);
  await expect(desk.getByTestId('report')).toHaveAttribute('data-pass', 'false');
  await expect(desk.locator('[data-task-state="done"]')).toHaveCount(1);
});

test('state check: T-104 plays through', async ({ desk }) => {
  const t = ticketOf('t04');
  await openTicket(desk, t.id);
  await playTicket(desk, t);
});

test('script check: T-106 reads up.sql and down.sql from their tabs', async ({ desk }) => {
  const t = ticketOf('t06');
  await openTicket(desk, t.id);
  await submit(desk); // the untouched templates
  await expect(desk.locator(failed).first()).toBeVisible();
  await playTicket(desk, t);
  await expect(desk.locator(failed)).toHaveCount(0);
});

test('plan check: T-107 fails on a sequential scan and passes with an index', async ({ desk }) => {
  const t = ticketOf('t07');
  await openTicket(desk, t.id);
  await run(desk, t.tasks[0].solution as string);
  await expect(desk.getByTestId('result')).toContainText('Seq Scan');
  await submit(desk);
  await expect(desk.getByTestId('report')).toHaveAttribute('data-pass', 'false');
  await run(desk, t.tasks[1].solution as string);
  await submit(desk);
  await expect(desk.getByTestId('closed')).toBeVisible();
});

test('Reset data restores the seed', async ({ desk }) => {
  await openTicket(desk, 't02');
  await run(desk, 'DROP TABLE orders');
  await run(desk, 'SELECT count(*) FROM orders');
  await expect(desk.getByTestId('status')).toHaveText('Error');
  await desk.getByTestId('reset-data').click();
  await run(desk, 'SELECT count(*) FROM orders');
  await expect(desk.getByTestId('result')).toContainText('60');
});
