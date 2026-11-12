// Sign-in and progress sync, against a mocked backend (the real one needs Google / GitHub).
import type { Page, Route } from '@playwright/test';
import { expect, test } from './desk';

const USER = { id: 'u1', provider: 'github', name: 'Octo Cat', avatarUrl: null };

async function backend(page: Page, opts: { user: typeof USER | null; save?: unknown }) {
  const puts: unknown[] = [];
  await page.route('**/api/me', (r: Route) => r.fulfill({ json: { user: opts.user, providers: ['google', 'github'] } }));
  await page.route('**/api/progress', async (r: Route) => {
    if (r.request().method() === 'PUT') {
      puts.push(JSON.parse(r.request().postData() ?? '{}').data);
      return r.fulfill({ json: { updatedAt: Date.now() } });
    }
    return r.fulfill({ json: { data: opts.save ?? null, updatedAt: null } });
  });
  await page.route('**/api/logout', (r: Route) => r.fulfill({ json: { ok: true } }));
  await page.route('**/api/auth/**', (r: Route) => r.fulfill({ status: 200, body: 'provider page' }));
  await page.reload();
  await expect(page.locator('[data-ticket]').first()).toBeVisible({ timeout: 45_000 });
  return puts;
}

test('without a backend there is no login button at all', async ({ desk }) => {
  await expect(desk.locator('[data-ticket]').first()).toBeVisible();
  await desk.waitForTimeout(500);
  await expect(desk.getByTestId('tray-account')).toHaveCount(0);
});

test('signed out: the Log On window sends the player to the provider', async ({ desk }) => {
  await backend(desk, { user: null });
  await expect(desk.getByTestId('tray-account')).toHaveText('Log on');
  await desk.getByTestId('tray-account').click();
  await expect(desk.locator('[data-provider]')).toHaveCount(2);
  const nav = desk.waitForURL('**/api/auth/github/login');
  await desk.locator('[data-provider="github"]').click();
  await nav;
});

test('signed in: the server save is merged in, and changes are uploaded', async ({ desk }) => {
  const remote = { v: 1, progress: { t01: { task: 4, done: true, queries: 6, hints: 0, hintLevel: 0 } }, legacyUnlocked: [], streak: { last: null, count: 0 }, notes: 'from my other laptop', tabsets: {}, installed: ['erd'], seen: [] };
  const puts = await backend(desk, { user: USER, save: remote });
  await expect(desk.getByTestId('tray-account')).toHaveText('Octo Cat');
  // t01 was closed on the other device
  await expect(desk.locator('[data-ticket="t01"]')).toHaveAttribute('data-status', /done|closed/);
  await expect(desk.locator('[data-icon="erd"]')).toBeVisible();
  await expect.poll(() => puts.length).toBeGreaterThan(0);
  const first = puts[0] as { notes: string; progress: Record<string, { done: boolean }> };
  expect(first.notes).toBe('from my other laptop');
  expect(first.progress.t01.done).toBe(true);

  await desk.getByTestId('tray-account').click();
  await expect(desk.getByTestId('account-name')).toHaveText('Octo Cat');
  await desk.getByTestId('logout').click();
  await expect(desk.getByTestId('tray-account')).toHaveText('Log on');
});

test('a failed sign-in is explained', async ({ desk }) => {
  await desk.route('**/api/me', (r) => r.fulfill({ json: { user: null, providers: ['google'] } }));
  await desk.goto('/?login_error=cancelled');
  await expect(desk.locator('.toast')).toContainText('ยกเลิกการเข้าสู่ระบบ');
  expect(new URL(desk.url()).search).toBe('');
});
