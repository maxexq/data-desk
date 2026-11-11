// Render the share image to public/og.png (1200×630, the size Facebook, LINE, X and Discord expect).
//   node scripts/og/render.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = fileURLToPath(new URL('../..', import.meta.url));
const server = await createServer({ root, logLevel: 'error', server: { port: 5299 } });
await server.listen();
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto('http://localhost:5299/scripts/og/index.html');
  await page.locator('[data-ready]').waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.locator('#og').screenshot({ path: `${root}public/og.png` });
  console.log('wrote public/og.png');
} finally {
  await browser.close();
  await server.close();
}
