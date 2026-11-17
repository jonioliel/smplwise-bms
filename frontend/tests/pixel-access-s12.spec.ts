import { test, expect, type Page, type Request } from '@playwright/test';
import fs from 'node:fs';
import { installAccessMock, NOW, SKINS, type MockOptions } from './access-control-mocks';
import { installParityMock, type ParityMock } from './access-parity-mocks';
import { settlePage } from './pixel-settle';
import { pixelTitle, skinCheck } from './helpers/pixel-skins';
import { phoneRoom, stillAPhone } from './helpers/phone-tall-shot';

// CR-036 S12 pixel baselines, NEW states only: the stations-screen display card and the parity report (a report, another user's) in
// Settings › כללי › מתגי מסכי כניסה, every skin, and the intercom action log narrowed to one person (classic) - desktop 1440 and phone 390,
// against the mocked backend (deterministic data, fixed clock, performance:full). Each image is of the element itself, so the switches card above
// (not changed here) does not take part. Baselines are per OS: the Linux ones are generated on the runner with `--update-snapshots`, looked at,
// then committed; on an OS without a baseline the check is skipped instead of failing on a missing file.
//   ~/run_remote.sh spec <branch> tests/pixel-access-s12.spec.ts --project=desktop --project=mobile [--update-snapshots]
const D = 'sw-app system-diagnostics';
const SETTINGS = '/system/diagnostics?tab=access-control';

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

/**
 * FLAKY-S12-PIXEL-2412 / FLAKY-S12-FIX-2441. The cause of the phone cards that came out 15-23 px taller in a full gate and never alone
 * is in helpers/phone-tall-shot.ts: a screenshot of an element taller than the phone viewport drops the touch emulation of the page,
 * and the picture depended on whether the page had already re-laid itself out. compare() gives a phone element room first.
 *
 * Next to it, two waits that do not guess. The display card is `ready` as soon as the saved settings are in, and two more answers
 * still shape it: the readiness line of the media source and WisKey's engine list (without it the card is a whole row shorter:
 * 1090 px against 1258 on the phone). settlePage() sees an open request only through `networkidle` and its 400 ms quiet window, so the
 * spec counts the API requests that are still open itself (apiIdle), and the card says that nothing that shapes it is on its way
 * (`data-access-display-settled`, system-access-display.ts). Both fail loudly instead of shooting a moving page.
 */
const openRequests = new WeakMap<Page, Set<Request>>();

function watchApi(page: Page): void {
  if (openRequests.has(page)) return;
  const pending = new Set<Request>();
  openRequests.set(page, pending);
  page.on('request', (r) => {
    if (r.url().includes('/api/v1/')) pending.add(r);
  });
  const done = (r: Request) => void pending.delete(r);
  page.on('requestfinished', done);
  page.on('requestfailed', done);
}

/** No API request open for 250 ms in a row (a screen that gets an answer often asks its next question in the same breath). */
async function apiIdle(page: Page, timeout = 20_000): Promise<void> {
  const pending = openRequests.get(page);
  if (!pending) throw new Error('apiIdle: watchApi(page) was not called before the page opened');
  const deadline = Date.now() + timeout;
  let quietSince = Date.now();
  for (;;) {
    if (pending.size > 0) quietSince = Date.now();
    else if (Date.now() - quietSince >= 250) return;
    if (Date.now() > deadline) {
      throw new Error(`API requests still open after ${timeout} ms: ${[...pending].map((r) => `${r.method()} ${new URL(r.url()).pathname}`).join(', ')}`);
    }
    await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
  }
}

/** Every answer is in, then the page is still (fonts, images, Lit updates, animations, element count and height). */
async function settle(page: Page): Promise<void> {
  await apiIdle(page);
  await settlePage(page);
}

async function open(page: Page, opts: MockOptions, skin: string, ready: string, hash = SETTINGS, mode: ParityMock['mode'] = 'ready') {
  const mock = await installAccessMock(page, opts);
  await installParityMock(page, mock, mode);
  watchApi(page);
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  openRequests.get(page)?.clear(); // a second open() of the same page: what the page before it left open is not this page's
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=light#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector(ready, { timeout: 30_000 });
  await settle(page);
}

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, name: string, target?: string) {
  const phone = info.project.name === 'mobile';
  const file = `${name}-${phone ? '390' : '1440'}.png`;
  // the phone: room for the whole element before the shot (helpers/phone-tall-shot.ts), also where there is no baseline to compare with
  const restore = phone && target ? await phoneRoom(page, target) : null;
  if (restore) await settle(page);
  if (noBaseline(info, file)) {
    test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  } else if (target) await expect(page.locator(target).first()).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
  if (phone) await stillAPhone(page, `after ${file}`);
  if (restore) {
    await restore();
    await settle(page);
  }
}

test.describe('pixel: CR-036 S12', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const skin of SKINS) {
    // GATELANES-297: pixels for the skins in helpers/pixel-skins.ts (classic, domus), the structural smoke for the others
    test(pixelTitle(skin, 'the display card and a parity report'), async ({ page }, info) => {
      const check = skinCheck(page, skin);
      await open(page, {}, skin, `${D} system-access-display sw-card[data-access-display="ready"][data-access-display-settled="true"]`);
      await check(() => compare(page, info, `s12-${skin}-display`, `${D} system-access-display sw-card`), `${D} system-access-display sw-card`);
      await page.locator(`${D} system-access-parity sw-button[data-parity-run]`).click();
      await page.mouse.move(0, 0); // TTS-DEFAULT-ENGINE-2400: no row of the report under the pointer (the taller display card above moved it there)
      await page.waitForSelector(`${D} system-access-parity sw-card[data-parity-state="ready"]`, { timeout: 20_000 });
      await settle(page);
      const parity = `${D} system-access-parity sw-card[data-access-card="parity"]`;
      await check(() => compare(page, info, `s12-${skin}-parity`, parity), parity);
    });
  }

  test('classic is pixel-stable: another user\'s report, the checklist and the action log narrowed to a person', async ({ page }, info) => {
    await open(page, {}, 'classic', `${D} system-access-parity sw-dropdown[data-parity-subject]`);
    const dd = page.locator(`${D} system-access-parity sw-dropdown[data-parity-subject]`);
    await dd.locator('[data-dropdown-chip]').click();
    await dd.locator('[role="option"][data-id="u-operator-a"]').click();
    await page.locator(`${D} system-access-parity sw-button[data-parity-run]`).click();
    await page.mouse.move(0, 0);
    await page.waitForSelector(`${D} system-access-parity sw-card[data-parity-state="ready"]`, { timeout: 20_000 });
    await settle(page);
    await compare(page, info, 's12-classic-parity-operator', `${D} system-access-parity sw-card[data-access-card="parity"]`);
    await compare(page, info, 's12-classic-checklist', `${D} system-access-parity sw-card[data-access-card="parity-checklist"]`);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, {}, 'classic', 'sw-app system-access-audit [data-access-audit-person="u1"]', '/system/access-control/audit');
    await page.locator('sw-app system-access-audit [data-access-audit-person="u1"]').click();
    await page.waitForSelector('sw-app system-access-audit [data-access-audit-person-chip]', { timeout: 20_000 });
    await settle(page);
    await compare(page, info, 's12-classic-audit-person');
  });
});
