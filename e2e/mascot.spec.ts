// น้องข้าวเหนียว gives the hint ladder when asked, and speaks up when the player looks stuck.
import type { Page } from '@playwright/test';
import { STORAGE_KEY } from '../src/config';
import { expect, openTicket, run, test } from './desk';

const mascot = (page: Page) => page.getByTestId('mascot');

async function chatty(page: Page, met = true) {
  await page.evaluate(([key, m]) => localStorage.setItem(`${key}-mascot`, JSON.stringify({ state: { met: m, chatty: true }, version: 1 })), [STORAGE_KEY, met] as const);
  await page.reload();
  await expect(page.locator('[data-ticket]').first()).toBeVisible({ timeout: 45_000 });
}

test('introduces itself once', async ({ desk }) => {
  await chatty(desk, false);
  await expect(mascot(desk)).toContainText('ผู้ช่วยประจำ Mango Sticky Data Co.');
  await mascot(desk).getByRole('button', { name: 'ยินดีที่ได้รู้จัก' }).click();
  await expect(mascot(desk)).toHaveCount(0);
  await desk.reload();
  await expect(desk.locator('[data-ticket]').first()).toBeVisible({ timeout: 45_000 });
  await desk.waitForTimeout(2000);
  await expect(mascot(desk)).toHaveCount(0);
});

test('the Hint button brings the mascot with three hints, one at a time', async ({ desk }) => {
  await openTicket(desk, 't01');
  await desk.getByTestId('hint').click();
  await expect(mascot(desk)).toContainText('คำใบ้มี 3 ระดับ');
  await expect(desk.getByTestId('mascot-hint')).toHaveCount(0);
  for (const n of [1, 2, 3]) {
    await desk.getByTestId('mascot-next').click();
    await expect(desk.getByTestId('mascot-hint')).toHaveCount(n);
  }
  await expect(desk.getByTestId('mascot-next')).toHaveCount(0);
  await expect(mascot(desk)).toContainText('หมดคำใบ้แล้ว');
  await desk.getByRole('button', { name: 'ปิด น้องข้าวเหนียว' }).click();
  await expect(mascot(desk)).toHaveCount(0);
  await expect(desk.locator('.win', { hasText: /^Hint$/ })).toHaveCount(0); // the old window is gone
});

test('offers a hint after three errors in a row', async ({ desk }) => {
  await chatty(desk);
  await openTicket(desk, 't01');
  for (let i = 0; i < 2; i++) await run(desk, 'SELEC oops');
  await expect(mascot(desk)).toHaveCount(0);
  await run(desk, 'SELEC oops');
  await expect(desk.getByTestId('mascot-say')).toContainText('ติดตรงไหน');
  await mascot(desk).getByRole('button', { name: 'ขอคำใบ้' }).click();
  await expect(mascot(desk)).toContainText('คำใบ้มี 3 ระดับ');
});

test('warns about joining id to another table id', async ({ desk }) => {
  await chatty(desk);
  await openTicket(desk, 't03');
  await run(desk, 'SELECT st.name, sum(s.amount_baht) FROM sales AS s JOIN staff AS st ON st.id = s.staff_id GROUP BY st.name');
  await expect(mascot(desk)).toHaveCount(0); // the real foreign key: fine
  await run(desk, 'SELECT * FROM sales AS a JOIN sales AS b ON b.id = a.id');
  await expect(mascot(desk)).toHaveCount(0); // a self-join: fine
  await run(desk, 'SELECT st.name, sum(s.amount_baht) FROM sales AS s JOIN staff AS st ON st.id = s.id GROUP BY st.name');
  await expect(desk.getByTestId('mascot-say')).toContainText('st.id = s.id');
  await expect(desk.getByTestId('mascot-say')).toContainText('staff_id');
});

test('stays quiet when chatty is off', async ({ desk }) => {
  await openTicket(desk, 't01');
  for (let i = 0; i < 3; i++) await run(desk, 'SELEC oops');
  await expect(mascot(desk)).toHaveCount(0);
});
