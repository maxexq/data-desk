// Shareware Shelf and its three apps: Sandbox, Snapshot, ER Diagram.
import type { Page } from '@playwright/test';
import { STORAGE_KEY } from '../src/config';
import { expect, openTicket, run, test } from './desk';

const shelfItem = (page: Page, id: string) => page.locator(`[data-shelf="${id}"]`);
const icon = (page: Page, id: string) => page.locator(`[data-icon="${id}"]`);
const closeInbox = (page: Page) => page.getByRole('button', { name: 'ปิด Inbox' }).click();

/** Skip the install animation: put every app on the desktop, then reload. */
async function installAll(page: Page) {
  await page.evaluate((key) => localStorage.setItem(`${key}-shelf`, JSON.stringify({ state: { installed: ['sandbox', 'snapshot', 'erd'] }, version: 1 })), STORAGE_KEY);
  await page.reload();
  await expect(page.locator('[data-ticket]').first()).toBeVisible({ timeout: 45_000 });
}

test('apps stay locked until their ticket is closed', async ({ desk }) => {
  await desk.evaluate((key) => localStorage.setItem(key, JSON.stringify({ state: { unlockAll: false }, version: 1 })), STORAGE_KEY);
  await desk.reload();
  await expect(desk.locator('[data-ticket]').first()).toBeVisible({ timeout: 45_000 });
  await closeInbox(desk);
  await expect(desk.getByTestId('shelf-new')).toHaveCount(0);
  await icon(desk, 'shelf').dblclick();
  for (const id of ['sandbox', 'snapshot', 'erd']) {
    await expect(shelfItem(desk, id)).toHaveAttribute('data-state', 'locked');
    await expect(shelfItem(desk, id).getByRole('button', { name: 'Install' })).toBeDisabled();
  }
  await expect(shelfItem(desk, 'sandbox')).toContainText('T-101');
});

test('install puts the app on the desktop, uninstall takes it off', async ({ desk }) => {
  await closeInbox(desk);
  await expect(desk.getByTestId('shelf-new')).toBeVisible(); // unlock-all: three new disks
  await expect(icon(desk, 'erd')).toHaveCount(0);

  await icon(desk, 'shelf').dblclick();
  await expect(desk.getByTestId('shelf-new')).toHaveCount(0); // looked at the shelf
  await shelfItem(desk, 'erd').getByRole('button', { name: 'Install' }).click();
  await expect(desk.getByTestId('installer')).toContainText('of 1');
  await expect(desk.getByTestId('installer')).toHaveCount(0, { timeout: 10_000 });
  await expect(shelfItem(desk, 'erd')).toHaveAttribute('data-state', 'installed');
  await expect(icon(desk, 'erd')).toBeVisible();

  await shelfItem(desk, 'erd').getByRole('button', { name: 'Uninstall' }).click();
  await expect(icon(desk, 'erd')).toHaveCount(0);
  await expect(shelfItem(desk, 'erd')).toHaveAttribute('data-state', 'available');
});

test('Sandbox runs on its own server with Chinook and Pagila', async ({ desk }) => {
  await installAll(desk);
  await openTicket(desk, 't01');
  await run(desk, 'SELECT count(*) AS n FROM door_logs');

  await icon(desk, 'sandbox').dblclick();
  await expect(desk.getByTestId('sandbox-run')).toBeEnabled({ timeout: 30_000 });
  await desk.getByTestId('sandbox-run').click(); // the starter query: top 10 artists
  await expect(desk.getByTestId('sandbox-status')).toContainText('10 rows');
  await expect(desk.getByTestId('sandbox-result')).toContainText('Iron Maiden');

  await desk.getByTestId('sandbox-dataset').selectOption('pagila');
  await expect(desk.getByTestId('sandbox-run')).toBeEnabled({ timeout: 30_000 });
  await desk.getByTestId('sandbox-run').click();
  await expect(desk.getByTestId('sandbox-status')).toContainText('16 rows');

  // Breaking the sandbox leaves the ticket alone.
  await desk.locator('.sandbox .cm-content').click();
  await desk.keyboard.press('ControlOrMeta+a');
  await desk.keyboard.press('Delete');
  await desk.keyboard.insertText('DROP TABLE payment');
  await desk.getByTestId('sandbox-run').click();
  await expect(desk.getByTestId('sandbox-status')).toContainText('OK');
  await desk.getByRole('button', { name: 'ปิด Sandbox' }).click();
  await run(desk, 'SELECT count(*) AS n FROM door_logs');
  await expect(desk.getByTestId('result')).toContainText('36');
});

test('Snapshot saves and restores the ticket workspace with pg_dump', async ({ desk }) => {
  await installAll(desk);
  await openTicket(desk, 't01');

  await icon(desk, 'snapshot').dblclick();
  await desk.getByRole('textbox', { name: 'ชื่อ snapshot' }).fill('clean');
  await desk.getByTestId('snapshot-save').click();
  await expect(desk.locator('[data-snapshot="clean"]')).toContainText('3 tables', { timeout: 20_000 });
  await desk.getByRole('button', { name: 'ปิด Snapshot' }).click();

  await run(desk, 'DELETE FROM door_logs');
  await run(desk, 'BEGIN; DELETE FROM suspects');
  await expect(desk.getByTestId('txn')).toBeVisible();

  await icon(desk, 'snapshot').dblclick();
  await expect(desk.getByTestId('snapshot-save')).toBeDisabled(); // pg_dump only sees committed data
  const snap = desk.locator('[data-snapshot="clean"]');
  await snap.getByRole('button', { name: 'View .sql' }).click();
  await expect(desk.getByTestId('snapshot-dump')).toContainText('CREATE TABLE ws.door_logs');
  await desk.getByRole('button', { name: 'ปิดไฟล์' }).click();
  await snap.getByRole('button', { name: 'Restore' }).click();
  await desk.locator('.snap-confirm').getByRole('button', { name: 'Restore' }).click();
  await expect(desk.getByTestId('txn')).toHaveCount(0);
  await desk.getByRole('button', { name: 'ปิด Snapshot' }).click();

  await run(desk, 'SELECT count(*) AS n FROM door_logs');
  await expect(desk.getByTestId('result')).toContainText('36');
  await run(desk, 'SELECT count(*) AS n FROM suspects');
  await expect(desk.getByTestId('result')).not.toContainText('Query error');
  await expect(desk.getByTestId('result')).not.toHaveText(/^n\s*0$/);

  // Snapshots live in IndexedDB, so they survive a reload.
  await desk.reload();
  await expect(desk.locator('[data-ticket]').first().or(desk.getByTestId('run'))).toBeVisible({ timeout: 45_000 });
  await icon(desk, 'snapshot').dblclick();
  await expect(desk.locator('[data-snapshot="clean"]')).toBeVisible();
});

test('ER Diagram draws the ticket tables and their foreign keys', async ({ desk }) => {
  await installAll(desk);
  await openTicket(desk, 't01');
  await icon(desk, 'erd').dblclick();
  await expect(desk.getByTestId('erd-status')).toHaveText('3 tables · 2 foreign keys');
  for (const t of ['suspects', 'door_logs', 'statements']) await expect(desk.locator(`[data-erd-table="${t}"]`)).toBeVisible();
  await expect(desk.locator('.erd-link')).toHaveCount(2);

  // It follows the workspace: a new table shows up after the run.
  await desk.locator('[data-task="console"]').click();
  await run(desk, 'CREATE TABLE notes (id int PRIMARY KEY, badge_id int REFERENCES suspects)');
  await desk.locator('[data-task="erd"]').click();
  await expect(desk.getByTestId('erd-status')).toHaveText('4 tables · 3 foreign keys');
});
