import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { NOW as SETTINGS_NOW, SKINS, url } from './access-control-mocks';
import { installMessagingSettings, type MessagingSettingsMock } from './wiskey-messaging-settings';
import { settlePage } from './pixel-settle';
import { isPixelSkin, pixelTitle, skinCheck } from './helpers/pixel-skins';
import { install, newMock, type PeopleMock } from './wiskey-people-mock';

// CR-036 WA pixel baselines: the messaging UI - the person's page "הודעות" tab (history list, the opt-out switch, its empty / failed states),
// the message dialog (the form, sent, an uncertain outcome, a person who asked not to be messaged, a text that looks like a code; the bulk
// form, its ONE confirmation, the run in progress and the per-recipient result table) and the Settings page "הודעות" (every skin, light; the
// dark scheme, the page with errors and the service-down note in the classic skin) - against the mocked backends (deterministic data, fixed
// clock, performance:full). Desktop 1440 and phone 390 (the tablet is covered by the layout guard).
// Baselines are per OS (fonts and text shaping differ): the Linux ones are generated on the runner with `--update-snapshots`; on an OS
// without a baseline the check is skipped instead of failing on a missing file (the design-foundation rule). THIS FILE CARRIES NO BASELINES
// YET - the first runner pass generates them (and refreshes the four `msg-*` ones of pixel-wiskey-people.spec.ts, whose drawer behind the
// dialog now has the fourth tab):
//   run_smart.py linux-pixel <branch> tests/pixel-wiskey-messaging.spec.ts --project=desktop --project=mobile --update-snapshots
const SCREEN = 'wiskey-people';
const NOW = '2026-10-12T10:00:00Z';
const wide = (info: { project: { name: string } }) => (info.project.name === 'mobile' ? '390' : '1440');

/** `--update-snapshots` is "changed" by default in this Playwright ("all" when spelled out): both write the baseline. */
const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, name: string) {
  await settlePage(page);
  const file = `${name}-${wide(info)}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

// ---------------------------------------------------------------------------------------------- the people screen

const mock = (patch: (st: PeopleMock) => void = () => {}): PeopleMock => {
  const st = newMock('admin');
  st.messaging = true;
  st.msg.quota = { limit: 40, used: 3 };
  st.msg.bulkMax = 12;
  st.msg.history.p1 = [
    { id: 'a', at: '2026-10-12T08:21:00Z', by: 'מנהל האתר', kind: 'template', template_id: 'closure', template_label: 'הכניסה סגורה זמנית', outcome: 'sent', reason: null, bulk: true },
    { id: 'b', at: '2026-10-11T16:02:00Z', by: 'בודק', kind: 'free', template_id: null, template_label: null, outcome: 'refused', reason: 'not_registered', bulk: false },
    { id: 'c', at: '2026-10-10T09:00:00Z', by: 'בודק', kind: 'template', template_id: 'card_ready', template_label: 'הכרטיס מוכן לאיסוף', outcome: 'unknown', reason: 'uncertain', bulk: false },
  ];
  patch(st);
  return st;
};

async function open(page: Page, st: PeopleMock, o: { skin?: string; scheme?: string } = {}) {
  await page.clock.setFixedTime(new Date(NOW));
  await install(page, st);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${o.skin ?? 'classic'}&scheme=${o.scheme ?? 'light'}#/wiskey/people`);
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${SCREEN} sw-page`)).toHaveAttribute('data-people-phase', 'ready', { timeout: 20_000 });
  await expect(page.locator(`${SCREEN} [data-person-row]`).first()).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

const dlg = (page: Page) => page.locator('wiskey-message-dialog');
const drw = (page: Page) => page.locator('wiskey-person-drawer');

async function openTab(page: Page, id = 'p1') {
  await page.locator(`${SCREEN} [data-person-row="${id}"]`).click();
  await drw(page).locator('[data-person-tab="messages"]').click();
}

async function openSingle(page: Page, id = 'p1') {
  await page.locator(`${SCREEN} [data-person-row="${id}"] [data-person-message-row]`).first().click();
  await expect(dlg(page).locator('[data-msg-recipient]')).toBeVisible();
}

async function openBulk(page: Page, ids: string[]) {
  await page.locator(`${SCREEN} [data-people-select-mode]`).click();
  for (const id of ids) await page.locator(`${SCREEN} [data-person-select="${id}"]`).click();
  await page.locator(`${SCREEN} [data-people-bulk-message]`).click();
  await expect(dlg(page).locator('[data-msg-preview]')).toBeVisible();
}

test.describe('pixel: the messaging UI on the people screen', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  // "pixel-stable" in the title: the release gate runs its pixel group with --grep pixel-stable (a title without it ran zero tests)
  for (const [skin, scheme] of [['classic', 'light'], ['classic', 'dark'], ['crystal', 'light']] as const) {
    // GATELANES-297: crystal has no pixel baseline any more (helpers/pixel-skins.ts): its case is the structural smoke
    const what = `the person's messages tab (history and the opt-out switch), ${skin} ${scheme}`;
    test(isPixelSkin(skin) ? `${what}, is pixel-stable` : `${what} (structural smoke, no pixel baseline)`, async ({ page }, info) => {
      const check = skinCheck(page, skin);
      await open(page, mock(), { skin, scheme });
      await openTab(page);
      await expect(drw(page).locator('[data-msg-history-item]')).toHaveCount(3);
      await check(() => compare(page, info, `tab-${skin}-${scheme}`), drw(page).locator('[data-msg-history-item]'));
    });
  }

  test('the person\'s messages tab: opted out, an empty history and a history that fails, is pixel-stable', async ({ page }, info) => {
    await open(page, mock((st) => (st.msg.optOut.p1 = { at: '2026-10-11T12:00:00Z', by: 'בודק' })));
    await openTab(page);
    await expect(drw(page).locator('[data-msg-optout]')).toHaveAttribute('aria-checked', 'true');
    await compare(page, info, 'tab-optout');
    const p2 = await page.context().newPage();
    await open(p2, mock());
    await openTab(p2, 'p2'); // nobody wrote to this person yet
    await expect(drw(p2).locator('[data-msg-history-empty]')).toBeVisible();
    await expect(drw(p2).locator('[data-msg-history-item]')).toHaveCount(0);
    await compare(p2, info, 'tab-empty');
    const p3 = await page.context().newPage();
    await open(p3, mock((st) => (st.msg.historyFails = 503)));
    await openTab(p3);
    await expect(drw(p3).locator('[data-msg-history-state="error"]')).toBeVisible();
    await compare(p3, info, 'tab-error');
  });

  test('the message dialog: the form with a template, sent, an uncertain outcome, is pixel-stable', async ({ page }, info) => {
    const st = mock();
    await open(page, st);
    await openSingle(page);
    await dlg(page).locator('[data-msg-template="card_ready"]').click();
    await compare(page, info, 'msg-form');
    await dlg(page).locator('[data-msg-send]').click();
    await expect(dlg(page).locator('[data-msg-line="sent"]')).toBeVisible();
    await compare(page, info, 'msg-sent');
    const p2 = await page.context().newPage();
    await open(p2, mock((s) => (s.msg.mode = 'uncertain')));
    await openSingle(p2);
    await dlg(p2).locator('[data-msg-template="closure"]').click();
    await dlg(p2).locator('[data-msg-send]').click();
    await expect(dlg(p2).locator('[data-msg-line="failed"]')).toBeVisible();
    await compare(p2, info, 'msg-uncertain');
  });

  test('the message dialog: a person who asked not to be messaged, a text that looks like a code, the hourly limit, is pixel-stable', async ({ page }, info) => {
    await open(page, mock((st) => (st.msg.optOut.p1 = { at: '2026-10-11T12:00:00Z', by: 'בודק' })));
    await openSingle(page);
    await expect(dlg(page).locator('[data-msg-line="cant"]')).toBeVisible();
    await compare(page, info, 'msg-declined');
    const p2 = await page.context().newPage();
    await open(p2, mock());
    await openSingle(p2, 'p2');
    await dlg(p2).locator('[data-msg-free]').click();
    await dlg(p2).locator('[data-msg-text]').fill('שלום, הקוד שלך 4821');
    await expect(dlg(p2).locator('[data-msg-line="cant"]')).toBeVisible();
    await compare(p2, info, 'msg-credential');
    const p3 = await page.context().newPage();
    await open(p3, mock((st) => (st.msg.quota = { limit: 3, used: 3 })));
    await openSingle(p3, 'p2');
    await expect(dlg(p3).locator('[data-msg-line="rate"]')).toBeVisible();
    await compare(p3, info, 'msg-quota');
  });

  test('the bulk dialog: the form, the one confirmation, the run in progress, the result table, is pixel-stable', async ({ page }, info) => {
    const st = mock((s) => (s.msg.failFor = { p2: 'not_registered', p4: 'uncertain' }));
    await open(page, st);
    await openBulk(page, ['p1', 'p2', 'p4', 'p5']);
    await dlg(page).locator('[data-msg-template="closure"]').click();
    await compare(page, info, 'msg-bulk-form');
    await dlg(page).locator('[data-msg-send]').click();
    await expect(dlg(page).locator('[data-msg-line="confirm"]')).toBeVisible();
    await compare(page, info, 'msg-bulk-confirm');
    await dlg(page).locator('[data-msg-confirm]').click();
    await expect(dlg(page).locator('[data-msg-results]')).toBeVisible({ timeout: 15_000 });
    await expect(dlg(page).locator('[data-msg-result]')).toHaveCount(4);
    await compare(page, info, 'msg-bulk-results');
    // a run held in flight: the progress line and the stop button
    const held = mock((s) => (s.msg.delayMs = 120_000));
    const p2 = await page.context().newPage();
    await open(p2, held);
    await openBulk(p2, ['p1', 'p3', 'p5']);
    await dlg(p2).locator('[data-msg-template="closure"]').click();
    await dlg(p2).locator('[data-msg-send]').click();
    await dlg(p2).locator('[data-msg-confirm]').click();
    await expect(dlg(p2).locator('[data-msg-stop]')).toBeVisible();
    await compare(p2, info, 'msg-bulk-running');
    held.msg.delayMs = 0; // lets the held send go, so the run ends before the page closes
    await expect(dlg(p2).locator('[data-msg-results]')).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------------------------- the Settings page

const PAGE = 'sw-app system-access-control';
const MSG = `${PAGE} system-access-messaging`;
const HASH = '/system/access-control/messaging';

async function openSettings(page: Page, skin: string, scheme: 'light' | 'dark', init: Partial<MessagingSettingsMock> = {}) {
  await installMessagingSettings(page, { persona: 'admin' }, init);
  await page.clock.setFixedTime(SETTINGS_NOW);
  await page.goto('about:blank');
  await page.goto(url(HASH, skin, scheme).replace('/?', '/?look=performance:full&'));
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${MSG} [data-access-status="ready"]`)).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
}

test.describe('pixel: the Settings page "הודעות"', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  for (const skin of SKINS) {
    // GATELANES-297: pixels for the skins in helpers/pixel-skins.ts (classic, domus), the structural smoke for the others
    test(pixelTitle(skin, 'the page as the administrator first finds it'), async ({ page }, info) => {
      const check = skinCheck(page, skin);
      await openSettings(page, skin, 'light');
      await check(() => compare(page, info, `settings-${skin}`), `${MSG} [data-access-status="ready"]`);
    });
  }

  test('classic is pixel-stable: dark, switched on and edited, with the problems said under the fields, the service down', async ({ page }, info) => {
    await openSettings(page, 'classic', 'dark');
    await compare(page, info, 'settings-classic-dark');
    const p2 = await page.context().newPage();
    await openSettings(p2, 'classic', 'light');
    await p2.locator(`${MSG} [data-msg-setting="enabled"]`).click();
    await p2.locator(`${MSG} [data-msg-template-row] [data-msg-template-body]`).first().fill('שלום {name}, הקוד שלך {pin}');
    await p2.locator(`${MSG} [data-msg-setting="bulk_max"]`).fill('0');
    await p2.locator(`${MSG} [data-msg-save]`).click();
    await expect(p2.locator(`${MSG} [data-msg-notice="invalid"]`)).toBeVisible();
    await compare(p2, info, 'settings-classic-errors');
    const p3 = await page.context().newPage();
    await openSettings(p3, 'classic', 'light', { service: { state: 'ready', connected: false, accounts: [], problem: null, last_error: null } });
    await expect(p3.locator(`${MSG} [data-msg-service="not_connected"]`)).toBeVisible();
    await compare(p3, info, 'settings-classic-service-down');
  });
});
