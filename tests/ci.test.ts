// CI runs inside Playwright's Docker image, which carries one browser build. If @playwright/test is
// upgraded without moving the image tag, every browser test would fail with "Executable doesn't exist".
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const installed = JSON.parse(read('package-lock.json')).packages['node_modules/@playwright/test'].version as string;

describe('CI Playwright image', () => {
  it.each(['.github/workflows/ci.yml', '.github/workflows/smoke-deployed.yml'])('%s uses the installed Playwright version', (file) => {
    const tags = [...read(file).matchAll(/mcr\.microsoft\.com\/playwright:v([\d.]+)-/g)].map((m) => m[1]);
    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) expect(tag).toBe(installed);
  });
});
