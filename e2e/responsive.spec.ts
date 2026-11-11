// Windows never leave the screen, and the game works on phones and tablets.
import type { Page } from '@playwright/test';
import { expect, test } from './desk';

/** Every open window lies fully inside the area above the taskbar. */
async function windowsOnScreen(page: Page) {
  return page.evaluate(() => {
    const bar = document.querySelector('.taskbar')!.getBoundingClientRect().top;
    return [...document.querySelectorAll<HTMLElement>('.win')].map((w) => {
      const r = w.getBoundingClientRect();
      return { name: w.getAttribute('aria-label'), inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= bar + 0.5 };
    });
  });
}

test.describe('desktop', () => {
  test('a window cannot be dragged past any edge', async ({ desk }) => {
    const title = desk.locator('.win', { hasText: 'Inbox' }).locator('.win-title');
    const size = desk.viewportSize()!;
    for (const [tx, ty] of [
      [size.width + 400, size.height + 400],
      [-400, -400],
      [size.width + 400, -400],
    ]) {
      const b = (await title.boundingBox())!;
      await desk.mouse.move(b.x + 60, b.y + 10);
      await desk.mouse.down();
      await desk.mouse.move(tx, ty, { steps: 6 });
      await desk.mouse.up();
      expect(await windowsOnScreen(desk)).toEqual([{ name: 'Inbox', inside: true }]);
    }
  });

  test('shrinking the browser pulls windows back in', async ({ desk }) => {
    await desk.locator('[data-ticket="t01"]').click();
    await expect(desk.getByTestId('run')).toBeEnabled();
    await desk.setViewportSize({ width: 900, height: 620 });
    await expect.poll(() => windowsOnScreen(desk)).toEqual(expect.arrayContaining([{ name: 'SQL Console', inside: true }]));
    expect((await windowsOnScreen(desk)).every((w) => w.inside)).toBe(true);
  });
});

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 700 }, hasTouch: true, isMobile: true });

  test('windows fill the screen and there is no sideways scrolling', async ({ desk }) => {
    const inbox = (await desk.locator('.win').first().boundingBox())!;
    expect(Math.round(inbox.x)).toBe(0);
    expect(Math.round(inbox.width)).toBe(390);
    await expect(desk.getByRole('button', { name: 'ขยาย Inbox' })).toHaveCount(0);
    expect(await desk.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await desk.locator('[data-ticket="t01"]').tap();
    await expect(desk.getByTestId('run')).toBeEnabled();
    expect((await windowsOnScreen(desk)).every((w) => w.inside)).toBe(true);
    await expect(desk.locator('.task')).toHaveCount(2); // console and ticket, icons only
    await expect(desk.locator('.task span').first()).toBeHidden();
  });

  test('one tap opens a desktop icon, a long press opens the menu', async ({ desk }) => {
    await desk.getByRole('button', { name: 'ปิด Inbox' }).tap();
    await desk.locator('[data-icon="notepad"]').tap();
    await expect(desk.locator('.win', { hasText: 'Notepad' })).toBeVisible();
    await desk.getByRole('button', { name: 'ปิด Notepad' }).tap();

    // Long press on empty desktop, through real touch events.
    const cdp = await desk.context().newCDPSession(desk);
    const at = { x: 300, y: 600 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [at] });
    await desk.waitForTimeout(800);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const menu = desk.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Refresh' })).toBeVisible();
    await desk.waitForTimeout(800); // the lifted finger must not have picked an item
    await expect(menu).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Open Inbox', exact: true }).tap();
    await expect(desk.locator('.win', { hasText: 'Inbox' })).toBeVisible();
  });
});
