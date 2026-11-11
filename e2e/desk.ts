// Shared fixture and helpers. Specs drive the game the way a player does, but take
// their SQL from the tickets' own model answers, so editing a ticket never breaks a spec.
import { test as base, expect, type Page } from '@playwright/test';
import { STORAGE_KEY } from '../src/config';
import { getTicket } from '../src/tickets';
import type { Ticket } from '../src/tickets/types';

export { expect };

export const test = base.extend<{ desk: Page }>({
  /** The game, booted, with every ticket unlocked and any browser error failing the test. */
  desk: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript((key) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify({ state: { unlockAll: true }, version: 1 }));
      // The mascot speaks up on its own; keep it quiet unless a spec is about it (mascot.spec.ts).
      if (!localStorage.getItem(`${key}-mascot`)) localStorage.setItem(`${key}-mascot`, JSON.stringify({ state: { met: true, chatty: false }, version: 1 }));
    }, STORAGE_KEY);
    await page.goto('/');
    await expect(page.locator('[data-ticket]').first()).toBeVisible({ timeout: 45_000 });
    await use(page);
    expect(errors, 'browser console errors').toEqual([]);
  },
});

export const ticketOf = (id: string): Ticket => getTicket(id)!;

/** Open a ticket from the Inbox and wait until its database is seeded. */
export async function openTicket(page: Page, id: string) {
  if (!(await page.locator(`[data-ticket="${id}"]`).isVisible())) await page.locator('.start').click();
  await page.locator(`[data-ticket="${id}"]`).click();
  await expect(page.getByTestId('run')).toBeEnabled();
}

/** Replace the editor's content. insertText avoids the editor's auto-closing of quotes and brackets. */
/** Close the autocomplete list (it opens a moment after typing and can cover the editor or the toolbar). */
async function closeCompletions(page: Page) {
  if (await page.locator('.cm-tooltip-autocomplete').count()) {
    await page.locator('.cm-content').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('.cm-tooltip-autocomplete')).toHaveCount(0);
  }
}

export async function setEditor(page: Page, sql: string) {
  await closeCompletions(page);
  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(sql);
  await page.waitForTimeout(50); // let a completion list open now, so it is closed here and not later
  await closeCompletions(page);
}

export async function run(page: Page, sql: string) {
  await setEditor(page, sql);
  await page.getByTestId('run').click();
  await expect(page.getByTestId('status')).not.toHaveText(/Running|Loading/);
}

export async function submit(page: Page) {
  await page.getByTestId('submit').click();
  await expect(page.getByTestId('report')).toBeVisible();
  await expect(page.getByTestId('submit').or(page.getByTestId('closed'))).toBeVisible();
}

const doneTasks = (page: Page) => page.locator('[data-task-state="done"]');

/** Play a whole ticket with its model answers and expect it to close. */
export async function playTicket(page: Page, ticket: Ticket) {
  for (const [i, task] of ticket.tasks.entries()) {
    if (typeof task.solution === 'string') {
      await run(page, task.solution);
    } else {
      for (const [file, code] of Object.entries(task.solution)) {
        await page.getByRole('tab', { name: file }).click();
        await setEditor(page, code);
      }
    }
    if (task.check.kind !== 'result') await submit(page);
    await expect(doneTasks(page), `${ticket.no} task ${i + 1}`).toHaveCount(i + 1);
  }
  await expect(page.getByTestId('closed')).toBeVisible();
}
