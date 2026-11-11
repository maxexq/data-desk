import { STORAGE_KEY } from '../src/config';
import { CHAPTERS } from '../src/tickets';
import { expect, openTicket, playTicket, test, ticketOf } from './desk';

test('chapters preserve campaign locks and advance across chapter boundaries', async ({ desk }) => {
  await desk.evaluate((key) => localStorage.setItem(key, JSON.stringify({ state: { unlockAll: false }, version: 1 })), STORAGE_KEY);
  await desk.reload();
  await expect(desk.locator('[data-chapter]')).toHaveCount(CHAPTERS.length);
  await expect(desk.locator('[data-chapter="sales"]')).toContainText('ยังไม่ปลดล็อก');
  await expect(desk.locator('[data-ticket="t02"]')).toBeDisabled();
  await openTicket(desk, 't01');
  await playTicket(desk, ticketOf('t01'));
  await desk.getByRole('button', { name: 'งานถัดไป: T-101A', exact: true }).click();
  await playTicket(desk, ticketOf('f04'));
  await expect(desk.getByTestId('chapter-summary')).toContainText('จบบทที่ 1');
  await desk.getByRole('button', { name: 'เริ่มบทที่ 2 · อ่านยอดขายให้เป็น' }).click();
  await expect(desk.locator('.ticket-head')).toContainText('บทที่ 2 · อ่านยอดขายให้เป็น');
  await desk.reload();
  await desk.locator('.start').click();
  await expect(desk.locator('[data-chapter="first-day"]')).toContainText('จบบทแล้ว · ปิดงาน 2/2');
  await expect(desk.locator('[data-chapter="sales"]')).toContainText('พร้อมเล่น · ปิดงาน 0/7');
  await expect(desk.locator('[data-ticket="f01"]')).toBeEnabled();
  await expect(desk.locator('[data-ticket="t02"]')).toBeDisabled();
  await expect(desk.locator('[data-ticket="t03"]')).toBeDisabled();
  await openTicket(desk, 'f01');
  await playTicket(desk, ticketOf('f01'));
  await desk.getByRole('button', { name: 'งานถัดไป: T-102', exact: true }).click();
  await expect(desk.locator('.ticket-head')).toContainText('ยอดขายรายสาขา');
});

test('version 1 saves keep unlocked work after migrating and reloading', async ({ desk }) => {
  await desk.evaluate((key) => localStorage.setItem(key, JSON.stringify({
    state: { unlockAll: false, progress: { t01: { task: 4, done: true, queries: 4, hints: 0, hintLevel: 0 } } }, version: 1,
  })), STORAGE_KEY);
  await desk.setViewportSize({ width: 390, height: 844 });
  await desk.reload();
  await expect(desk.locator('[data-chapter="first-day"] progress')).toHaveAttribute('value', '1');
  await expect(desk.locator('[data-ticket="t02"]')).toBeEnabled();
  await expect(desk.locator('[data-ticket="f01"]')).toBeEnabled();
  await desk.reload();
  await expect(desk.locator('[data-ticket="t02"]')).toBeEnabled();
  await expect(desk.locator('[data-ticket="daily"]')).toBeEnabled();
  expect(await desk.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('saves from before T-101A / T-102A / T-102D keep what was already open', async ({ desk }) => {
  // Played under the v2 order: T-101, T-101B and T-102 done, nothing else started.
  await desk.evaluate((key) => localStorage.setItem(key, JSON.stringify({
    state: {
      unlockAll: false,
      progress: Object.fromEntries(['t01', 'f01', 't02'].map((id) => [id, { task: 9, done: true, queries: 3, hints: 0, hintLevel: 0 }])),
    },
    version: 2,
  })), STORAGE_KEY);
  await desk.reload();
  await expect(desk.locator('[data-ticket="f02"]')).toBeEnabled(); // was next after T-102 before
  await expect(desk.locator('[data-ticket="f04"]')).toBeEnabled(); // new, right after T-101
  await expect(desk.locator('[data-ticket="f05"]')).toBeEnabled(); // new, right after T-102
  await expect(desk.locator('[data-ticket="f06"]')).toBeDisabled(); // new, after T-102C which is not done
  await expect(desk.locator('[data-ticket="t03"]')).toBeDisabled();
});

test('saves from before the data-team chapter keep T-104 open after T-103', async ({ desk }) => {
  const done = ['t01', 'f04', 'f01', 't02', 'f05', 'f02', 'f03', 'f06', 't03'];
  await desk.evaluate(([key, ids]) => localStorage.setItem(key, JSON.stringify({
    state: { unlockAll: false, progress: Object.fromEntries(ids.map((id) => [id, { task: 9, done: true, queries: 3, hints: 0, hintLevel: 0 }])) },
    version: 3,
  })), [STORAGE_KEY, done] as const);
  await desk.reload();
  await expect(desk.locator('[data-ticket="t04"]')).toBeEnabled(); // was next after T-103 before
  await expect(desk.locator('[data-ticket="f07"]')).toBeEnabled(); // the new chapter starts after T-103
  await expect(desk.locator('[data-ticket="f08"]')).toBeDisabled();
  await expect(desk.locator('[data-ticket="t05"]')).toBeDisabled();
});
