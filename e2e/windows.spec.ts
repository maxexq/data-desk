import { expect, test } from './desk';

const win = '.win[aria-label="Inbox"]';

test('windows can be dragged, minimized, restored and maximized', async ({ desk }) => {
  const title = desk.locator(`${win} .win-title`);
  const before = (await title.boundingBox())!;
  await desk.mouse.move(before.x + 120, before.y + 12);
  await desk.mouse.down();
  await desk.mouse.move(before.x + 200, before.y + 72, { steps: 5 });
  await desk.mouse.up();
  const after = (await title.boundingBox())!;
  expect(Math.round(after.x - before.x)).toBe(80);
  expect(Math.round(after.y - before.y)).toBe(60);

  await desk.getByRole('button', { name: 'ย่อ Inbox' }).click();
  await expect(desk.locator(win)).toHaveCount(0);
  await desk.locator('.task', { hasText: 'Inbox' }).click();
  await expect(desk.locator(win)).toBeVisible();

  await desk.getByRole('button', { name: 'ขยาย Inbox' }).click();
  const box = (await desk.locator(win).boundingBox())!;
  expect(box.width).toBe(1366);
});
