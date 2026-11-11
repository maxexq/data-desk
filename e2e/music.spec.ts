// Desk Tunes: the built-in stations play, pause and keep going while minimized; local files can be added.
import type { Page } from '@playwright/test';
import { expect, test } from './desk';

const seconds = async (page: Page) => {
  const [m, s] = (await page.getByTestId('amp-time').textContent())!.split(':').map(Number);
  return m * 60 + s;
};

/** A short silent WAV, made here so the test needs no audio file. */
function wav(secs: number) {
  const rate = 8000;
  const n = rate * secs;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  return b;
}

test.beforeEach(async ({ desk }) => {
  await desk.getByRole('button', { name: 'ปิด Inbox' }).click();
  await desk.locator('[data-icon="music"]').dblclick();
});

test('a station plays, pauses and moves on', async ({ desk }) => {
  await desk.locator('.amp-item').first().dblclick();
  await expect(desk.getByTestId('tray-music')).toContainText('Rainy Desk');
  await expect.poll(() => seconds(desk), { timeout: 5_000 }).toBeGreaterThanOrEqual(2);

  await desk.getByTestId('amp-pause').click();
  const held = await seconds(desk);
  await desk.waitForTimeout(1500);
  expect(await seconds(desk)).toBe(held);

  await desk.getByTestId('amp-next').click();
  await expect(desk.getByTestId('amp-title')).toContainText('Mango Café');
  await expect(desk.locator('.amp-item.on')).toContainText('Mango Café');
});

test('music keeps playing while minimized and stops when the player closes', async ({ desk }) => {
  await desk.getByTestId('amp-play').click();
  await desk.getByRole('button', { name: 'ย่อ Desk Tunes' }).click();
  await expect(desk.getByTestId('tray-music')).toBeVisible();
  await desk.getByTestId('tray-music').click(); // brings the player back
  await expect(desk.getByTestId('amp-lcd')).toBeVisible();
  await expect.poll(() => seconds(desk)).toBeGreaterThanOrEqual(1);
  await desk.getByRole('button', { name: 'ปิด Desk Tunes' }).click();
  await expect(desk.getByTestId('tray-music')).toHaveCount(0);
});

test('Z X C V B drive the player from the keyboard', async ({ desk }) => {
  await desk.locator('.amp-item').first().click();
  await desk.keyboard.press('x');
  await expect(desk.getByTestId('tray-music')).toBeVisible();
  await desk.keyboard.press('b');
  await expect(desk.getByTestId('amp-title')).toContainText('Mango Café');
  await desk.keyboard.press('v');
  await expect(desk.getByTestId('tray-music')).toHaveCount(0);
});

test('a file from the computer joins the playlist and plays', async ({ desk }) => {
  await desk.getByTestId('amp-files').setInputFiles({ name: 'my-song.wav', mimeType: 'audio/wav', buffer: wav(3) });
  const item = desk.locator('.amp-item', { hasText: 'my-song' });
  await expect(item).toBeVisible();
  await item.dblclick();
  await expect(desk.getByTestId('amp-title')).toContainText('my-song');
  await expect(desk.getByTestId('amp-lcd')).toContainText('00:03'); // its length, unlike a LIVE station
});
