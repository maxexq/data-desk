// Desktop icons behave like Windows, and right-click opens the game's own menu.
import { CELL, cellToPoint } from '../src/lib/deskLayout';
import { expect, test } from './desk';
import type { Locator, Page } from '@playwright/test';

const icon = (page: Page, id: string) => page.locator(`[data-icon="${id}"]`);
const menu = (page: Page) => page.getByRole('menu');
const item = (page: Page, name: string) =>
  menu(page).getByRole('menuitem', { name, exact: true }).or(menu(page).getByRole('menuitemcheckbox', { name, exact: true }));
/** The Inbox opens on boot and covers part of the desktop. */
const closeInbox = (page: Page) => page.getByRole('button', { name: 'ปิด Inbox' }).click();
const win = (page: Page, title: string) => page.locator('.win', { has: page.locator('.win-title', { hasText: title }) });

const place = async (l: Locator) => {
  const b = (await l.boundingBox())!;
  return { x: Math.round(b.x), y: Math.round(b.y) };
};

/** Right-click an empty bit of desktop (bottom-left corner, clear of icons and windows). */
async function desktopMenu(page: Page) {
  const size = page.viewportSize()!;
  await page.mouse.click(30, size.height - 60, { button: 'right' });
  await expect(menu(page)).toBeVisible();
}

async function dragTo(page: Page, id: string, col: number, row: number) {
  const b = (await icon(page, id).boundingBox())!;
  const to = cellToPoint(col, row);
  await page.mouse.move(b.x + b.width / 2, b.y + 20);
  await page.mouse.down();
  await page.mouse.move(to.x + CELL.w / 2, to.y + 30, { steps: 8 });
  await page.mouse.up();
}

test('click selects, double-click opens', async ({ desk }) => {
  await closeInbox(desk);
  await icon(desk, 'manual').click();
  await expect(icon(desk, 'manual')).toHaveClass(/selected/);
  await expect(win(desk, 'Instruction Manual')).toHaveCount(0);
  await icon(desk, 'manual').dblclick();
  await expect(win(desk, 'Instruction Manual')).toBeVisible();
});

test('a dragged icon snaps to the grid and stays there after a reload', async ({ desk }) => {
  await closeInbox(desk);
  await dragTo(desk, 'notepad', 3, 2);
  expect(await place(icon(desk, 'notepad'))).toEqual(cellToPoint(3, 2));
  // the others did not move
  expect(await place(icon(desk, 'inbox'))).toEqual(cellToPoint(0, 0));
  expect(await place(icon(desk, 'settings'))).toEqual(cellToPoint(0, 7));

  await desk.reload();
  await expect(icon(desk, 'notepad')).toBeVisible({ timeout: 45_000 });
  expect(await place(icon(desk, 'notepad'))).toEqual(cellToPoint(3, 2));
});

test('dropping on another icon swaps the two', async ({ desk }) => {
  await closeInbox(desk);
  await dragTo(desk, 'settings', 0, 0);
  expect(await place(icon(desk, 'settings'))).toEqual(cellToPoint(0, 0));
  expect(await place(icon(desk, 'inbox'))).toEqual(cellToPoint(0, 7));
});

test('desktop menu sorts and auto-arranges icons', async ({ desk }) => {
  await closeInbox(desk);
  await dragTo(desk, 'inbox', 4, 1);

  await desktopMenu(desk);
  await item(desk, 'Sort by name').click();
  await expect(menu(desk)).toHaveCount(0);
  // console, inbox, manual, notepad, settings, shareware, tables, ticket
  expect(await place(icon(desk, 'console'))).toEqual(cellToPoint(0, 0));
  expect(await place(icon(desk, 'inbox'))).toEqual(cellToPoint(0, 1));
  expect(await place(icon(desk, 'ticket'))).toEqual(cellToPoint(0, 7));

  await desktopMenu(desk);
  await item(desk, 'Auto arrange').click();
  await dragTo(desk, 'ticket', 5, 3); // far away: auto-arrange pulls it back into the column
  expect(await place(icon(desk, 'ticket'))).toEqual(cellToPoint(0, 7));
  await dragTo(desk, 'ticket', 0, 0); // dropping on the first slot reorders
  expect(await place(icon(desk, 'ticket'))).toEqual(cellToPoint(0, 0));
  expect(await place(icon(desk, 'console'))).toEqual(cellToPoint(0, 1));

  await desktopMenu(desk);
  await expect(item(desk, 'Auto arrange')).toHaveAttribute('aria-checked', 'true');
  await expect(item(desk, 'Align to grid')).toBeDisabled();
  await desk.keyboard.press('Escape');
  await expect(menu(desk)).toHaveCount(0);
});

test('menus on icons, windows and the taskbar', async ({ desk }) => {
  await closeInbox(desk);

  await icon(desk, 'notepad').click({ button: 'right' });
  await item(desk, 'Open').click();
  await expect(win(desk, 'Notepad')).toBeVisible();

  await win(desk, 'Notepad').locator('.win-title').click({ button: 'right' });
  await item(desk, 'Minimize').click();
  await expect(win(desk, 'Notepad')).toBeHidden();

  await desk.locator('[data-task="notepad"]').click({ button: 'right' });
  await item(desk, 'Restore').click();
  await expect(win(desk, 'Notepad')).toBeVisible();

  await desk.locator('[data-task="notepad"]').click({ button: 'right' });
  await item(desk, 'Close').click();
  await expect(desk.locator('[data-task="notepad"]')).toHaveCount(0);
});

test('Refresh re-reads the database and keeps the game running', async ({ desk }) => {
  await desk.locator('[data-ticket="t01"]').click();
  await expect(desk.getByTestId('run')).toBeEnabled();
  const size = desk.viewportSize()!;
  await desk.mouse.click(30, size.height - 60, { button: 'right' });
  await expect(item(desk, 'Reset ticket data')).toBeEnabled();
  await item(desk, 'Refresh').click();
  await expect(menu(desk)).toHaveCount(0);
  await expect(desk.getByTestId('run')).toBeEnabled();
});

test('text keeps the browser menu', async ({ desk }) => {
  await desk.locator('[data-ticket="t01"]').click();
  await expect(desk.getByTestId('run')).toBeEnabled();
  await desk.locator('.cm-content').click({ button: 'right' });
  await expect(menu(desk)).toHaveCount(0);
});
