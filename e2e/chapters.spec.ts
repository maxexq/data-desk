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
  await expect(desk.getByTestId('chapter-summary')).toContainText('จบบทที่ 1');
  await desk.getByRole('button', { name: 'เริ่มบทที่ 2 · อ่านยอดขายให้เป็น' }).click();
  await expect(desk.locator('.ticket-head')).toContainText('บทที่ 2 · อ่านยอดขายให้เป็น');
  await desk.reload();
  await desk.locator('.start').click();
  await expect(desk.locator('[data-chapter="first-day"]')).toContainText('จบบทแล้ว · ปิดงาน 1/1');
  await expect(desk.locator('[data-chapter="sales"]')).toContainText('พร้อมเล่น · ปิดงาน 0/2');
  await expect(desk.locator('[data-ticket="t02"]')).toBeEnabled();
  await expect(desk.locator('[data-ticket="t03"]')).toBeDisabled();
});

test('existing saves supply chapter progress without a migration', async ({ desk }) => {
  await desk.evaluate((key) => localStorage.setItem(key, JSON.stringify({
    state: { unlockAll: false, progress: { t01: { task: 4, done: true, queries: 4, hints: 0, hintLevel: 0 } } }, version: 1,
  })), STORAGE_KEY);
  await desk.setViewportSize({ width: 390, height: 844 });
  await desk.reload();
  await expect(desk.locator('[data-chapter="first-day"] progress')).toHaveAttribute('value', '1');
  await expect(desk.locator('[data-ticket="t02"]')).toBeEnabled();
  await expect(desk.locator('[data-ticket="daily"]')).toBeEnabled();
  expect(await desk.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
