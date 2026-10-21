import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installMask, newMaskMock, type MaskMock } from './privacy-mask-mock';
import { AR, BIDI, EMAIL, EMOJI, LONG_HE, MIXED, ONE, RU, UNBREAK, UNBREAK_HE, digest, measure } from './breakui-worst';

// BREAKUI-295: the privacy-mask editor (Settings > Security > Privacy masks) against WORST-CASE camera names (very long, unbreakable, one letter,
// Arabic / Russian / mixed / emoji / bidi), 30 cameras, a full 4-region camera, a read that fails, a missing picture, no cameras, no write
// permission. Mocked backend (tests/privacy-mask-mock.ts), fake pictures only; nothing is written to a device. SW_SHOTS=1 -> docs/design/evidence/BREAKUI-295.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/BREAKUI-295');
const SCREEN = 'sw-app system-security system-security-privacy-masks';
const NAMES = [LONG_HE, UNBREAK, UNBREAK_HE, EMAIL, MIXED, AR, RU, ONE, EMOJI, BIDI];

function worstCameras(st: MaskMock, n: number) {
  const base = st.base.cameras[0];
  st.base.cameras.length = 0;
  for (let i = 1; i <= n; i++) {
    st.base.cameras.push({ ...JSON.parse(JSON.stringify(base)), camera_id: `cam-${i}`, channel: i, source_ref: String(i), name: NAMES[(i - 1) % NAMES.length] + (i > 10 ? ` ${i}` : ''), online: i % 6 !== 0 });
    if (!st.masks[`cam-${i}`]) st.masks[`cam-${i}`] = { enabled: i % 2 === 0, regions: i % 2 ? [] : [{ id: '1', points: [[10, 10], [200, 10], [200, 120], [10, 120]] }], etag: `e-${i}` };
  }
}

async function open(page: Page, scheme: 'light' | 'dark') {
  await page.goto('about:blank');
  await page.goto(`/?design=a&scheme=${scheme}#/system/security/cameras`);
  await page.waitForSelector('sw-app');
  await page.evaluate(() => (window.location.hash = '#/system/security/privacy-masks'));
}
async function shot(page: Page, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`) });
}
async function check(page: Page, label: string) {
  const r = await measure(page, label, SCREEN);
  const text = digest(label, r);
  console.log(text);
  expect(r.scroll, `${label} horizontal page scroll`).toBeLessThanOrEqual(1);
  expect(r.found, text).toEqual([]);
  if ((page.viewportSize()?.width ?? 1440) <= 480) expect(r.targets, text).toEqual([]);
}
const q = (page: Page, sel: string) => page.locator(`${SCREEN} ${sel}`);

for (const scheme of ['light', 'dark'] as const) {
  test(`privacy masks worst case: 30 cameras, full flow [${scheme}]`, async ({ page }) => {
    const w = test.info().project.name === 'mobile' ? 400 : 1440;
    await page.setViewportSize({ width: w, height: w === 400 ? 844 : 900 });
    const st = newMaskMock();
    worstCameras(st, 30);
    st.mode['cam-2'] = 'fail';
    await installMask(page, st);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await open(page, scheme);
    await expect(q(page, '[data-pm-screen]')).toHaveAttribute('data-state', 'ready');
    await expect(q(page, '[data-pm-frame]')).toBeVisible();
    await check(page, `ready ${scheme}`);
    await shot(page, `pm-ready-${scheme}`);
    // fill cam-1 to the 4-region limit, edit cam-2 and cam-3 too
    for (let i = 0; i < 5; i++) if (!(await q(page, '[data-pm-add]').isDisabled().catch(() => false))) await q(page, '[data-pm-add]').click();
    await check(page, `four-regions ${scheme}`);
    await shot(page, `pm-four-regions-${scheme}`);
    for (const id of ['cam-2', 'cam-3']) {
      await q(page, `[data-pm-camera="${id}"]`).click();
      if (!(await q(page, '[data-pm-add]').isDisabled().catch(() => true))) await q(page, '[data-pm-add]').click();
    }
    await q(page, '[data-pm-review]').click();
    await expect(q(page, '[data-pm-review-step]')).toBeVisible();
    await check(page, `review ${scheme}`);
    await shot(page, `pm-review-${scheme}`);
    await q(page, '[data-pm-next]').click();
    await expect(page.locator(`${SCREEN} [data-pm-confirm]`)).toBeVisible();
    await check(page, `confirm ${scheme}`);
    await shot(page, `pm-confirm-${scheme}`);
    await page.locator(`${SCREEN} [data-pm-confirm]`).click();
    await expect(q(page, '[data-pm-done-step]')).toBeVisible();
    await check(page, `results ${scheme}`);
    await shot(page, `pm-results-${scheme}`);
    expect(errors).toEqual([]);
  });
}

const STATES: [string, (st: MaskMock) => void][] = [
  ['read-fails', (st) => { st.readDown.push('cam-1'); }],
  ['no-picture', (st) => { st.noPicture.push('cam-1', 'cam-2', 'cam-3'); }],
  ['no-cameras', (st) => { st.base.cameras.length = 0; }],
  ['no-write-permission', (st) => { st.canWrite = false; }],
  ['switch-off', (st) => { st.switchOn = false; }],
];
for (const [name, prep] of STATES) {
  test(`privacy masks state: ${name}`, async ({ page }) => {
    const w = test.info().project.name === 'mobile' ? 400 : 1440;
    await page.setViewportSize({ width: w, height: w === 400 ? 844 : 900 });
    const st = newMaskMock();
    worstCameras(st, 12);
    prep(st);
    await installMask(page, st);
    await open(page, 'light');
    await page.waitForTimeout(1500);
    await check(page, name);
    await shot(page, `pm-state-${name}-light`);
  });
}
