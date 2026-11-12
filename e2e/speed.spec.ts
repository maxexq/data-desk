// The page meter and the "ทำให้เร็ว" chapter: a correct but slow query must not pass.
import { STORAGE_KEY } from '../src/config';
import { expect, openTicket, run, test } from './desk';

const OFFSET = 'SELECT id, created_at, title FROM posts ORDER BY created_at DESC, id DESC OFFSET 39999 LIMIT 20';
const KEYSET = "SELECT id, created_at, title FROM posts WHERE (created_at, id) < ('2026-01-01 01:51:07', 20002) ORDER BY created_at DESC, id DESC LIMIT 20";

test('the page meter fails a right answer that reads too much, and passes the fast one', async ({ desk }) => {
  await openTicket(desk, 'p01');
  await run(desk, 'SELECT id, created_at, title FROM posts ORDER BY created_at DESC, id DESC LIMIT 20');
  await expect(desk.locator('[data-task-state="done"]')).toHaveCount(1);
  await expect(desk.getByTestId('pages')).toHaveText(/^\d+ pages?\s\/ งบ 20$/);

  await run(desk, OFFSET);
  await expect(desk.getByTestId('pages')).toHaveClass(/bad/);
  await expect(desk.getByTestId('report')).toContainText('เกินงบ 20 page');
  await expect(desk.locator('[data-task-state="done"]')).toHaveCount(1);

  await run(desk, KEYSET);
  await expect(desk.getByTestId('report')).toContainText('อ่านแค่');
  await expect(desk.locator('[data-task-state="done"]')).toHaveCount(2);
});

test('statements that change data are not measured', async ({ desk }) => {
  await openTicket(desk, 't01');
  await run(desk, 'SELECT count(*) FROM door_logs');
  await expect(desk.getByTestId('pages')).toHaveText(/^\d+ pages?$/);
  await run(desk, 'BEGIN; SELECT 1');
  await expect(desk.getByTestId('pages')).toHaveText('— pages');
  await run(desk, 'ROLLBACK');
});

test('the mascot warns about a deep OFFSET', async ({ desk }) => {
  await desk.evaluate((key) => localStorage.setItem(`${key}-mascot`, JSON.stringify({ state: { met: true, chatty: true }, version: 1 })), STORAGE_KEY);
  await desk.reload();
  await openTicket(desk, 'p01');
  await run(desk, OFFSET);
  await expect(desk.getByTestId('mascot-say')).toContainText('OFFSET 39,999');
});
