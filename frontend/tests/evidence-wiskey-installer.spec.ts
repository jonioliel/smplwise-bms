import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { NOW } from './access-control-mocks';
import { settlePage } from './pixel-settle';
import { installInstallerMock, newInstallerMock, type InstallerMock } from './wiskey-installer-mocks';

// WISKEY-INSTALLER-NATIVE-2400: הגדרות › התקנה ותחזוקת מערכת האינטרקום against the mocked backend (tests/wiskey-installer-mocks.ts), desktop
// and phone. What a person sees and what is sent: every write goes through the confirmation dialog, ONCE; a dangerous one needs the typed
// phrase; a refusal says nothing changed; an unknown outcome blocks a blind repeat; the forbidden and unavailable states. Pixel baselines
// ("pixel-stable" in the title: the gate's pixel group) are Linux ones generated on the runner with --update-snapshots; on an OS without a
// baseline the comparison is skipped, not failed.
//   ~/run_remote.sh spec <branch> tests/evidence-wiskey-installer.spec.ts --project=desktop --project=mobile [--update-snapshots]

const ROOT = 'sw-app system-intercom-installer';
const CLOCK = `${ROOT} installer-clock`;
const DIALOG = `${CLOCK} wk-installer-confirm sw-dialog[open]`;

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, name: string) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

async function open(page: Page, m: InstallerMock, hash = '/system/intercom-installer/clock', ready = `${CLOCK} [data-clock="ready"]`) {
  await installInstallerMock(page, m);
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=classic&scheme=light#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector(ready, { timeout: 30_000 });
}

test.describe('the intercom installer: clock', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  test('the clock tab shows the preference, the host and every station with its skew', async ({ page }) => {
    await open(page, newInstallerMock());
    await expect(page.locator(`${ROOT} [data-installer-tab="clock"]`)).toHaveAttribute('aria-current', 'page');
    await expect(page.locator(`${CLOCK} [data-ntp="server"]`)).toHaveValue('time.windows.com');
    await expect(page.locator(`${CLOCK} [data-clock-host="ready"]`)).toBeVisible();
    await expect(page.locator(`${CLOCK} [data-station]`)).toHaveCount(3);
    await expect(page.locator(`${CLOCK} [data-station="entry-a"]`)).toHaveAttribute('data-tone', 'ok');
    await expect(page.locator(`${CLOCK} [data-station="entry-c"]`)).toHaveAttribute('data-tone', 'err');
    await expect(page.locator(`${CLOCK} [data-station="entry-b"] [data-clock-sync]`)).toHaveAttribute('disabled', '');
    // nothing was written by looking
    await expect(page.locator(`${CLOCK} [data-clock-save]`)).toHaveAttribute('disabled', '');
  });

  test('saving the preference shows the change, sends once and reloads', async ({ page }) => {
    const m = await (async () => {
      const mock = newInstallerMock();
      await open(page, mock);
      return mock;
    })();
    await page.locator(`${CLOCK} [data-ntp="interval"]`).fill('0');
    await expect(page.locator(`${CLOCK} [data-clock-save]`)).toHaveAttribute('disabled', '');
    await page.locator(`${CLOCK} [data-ntp="interval"]`).fill('30');
    await page.locator(`${CLOCK} [data-clock-save]`).click();
    await expect(page.locator(`${DIALOG} [data-diff] tr[data-key="interval"][data-changed]`)).toBeVisible();
    await expect(page.locator(`${DIALOG} [data-diff] tr[data-key="server"]:not([data-changed])`)).toBeVisible();
    expect(m.writes).toHaveLength(0);
    await page.locator(`${CLOCK} [data-confirm-send]`).click();
    await expect(page.locator(`${CLOCK} [data-flash]`)).toBeVisible();
    expect(m.writes).toHaveLength(1);
    expect(m.writes[0].body).toMatchObject({ confirmed: true, revision: 3, values: { server: 'time.windows.com', port: 123, interval: 30 } });
    await expect(page.locator(`${CLOCK} [data-clock-settings="ready"]`)).toHaveAttribute('subheading', 'גרסה 4');
  });

  test('a station clock write needs the station name typed, then reports the measured result', async ({ page }) => {
    const m = newInstallerMock();
    await open(page, m);
    await page.locator(`${CLOCK} [data-station="entry-a"] [data-clock-sync]`).click();
    await expect(page.locator(`${CLOCK} [data-phrase]`)).toHaveText('שער ראשי');
    await expect(page.locator(`${CLOCK} [data-confirm-send]`)).toHaveAttribute('disabled', '');
    await page.locator(`${CLOCK} [data-typed]`).fill('שער');
    await expect(page.locator(`${CLOCK} [data-confirm-send]`)).toHaveAttribute('disabled', '');
    await page.locator(`${CLOCK} [data-typed]`).fill('שער ראשי');
    await page.locator(`${CLOCK} [data-copy-system]`).check();
    await page.locator(`${CLOCK} [data-confirm-send]`).click();
    await expect(page.locator(`${CLOCK} [data-flash]`)).toContainText('מאומת');
    expect(m.writes).toHaveLength(1);
    expect(m.writes[0]).toMatchObject({ path: 'access-control/installer/clock/stations/entry-a/sync', body: { typed_confirmation: 'שער ראשי', copy_system: true, revision: 3 } });
  });

  test('a long write shows an honest wait and cannot be closed while it is out', async ({ page }) => {
    const m = newInstallerMock({ result: { station_sync: 'slow' } });
    await open(page, m);
    await page.locator(`${CLOCK} [data-station="entry-c"] [data-clock-sync]`).click();
    await page.locator(`${CLOCK} [data-typed]`).fill('רציף פריקה');
    await page.locator(`${CLOCK} [data-confirm-send]`).click();
    await expect(page.locator(`${CLOCK} [data-waiting]`)).toContainText('עד כ־55');
    await expect(page.locator(`${CLOCK} [data-confirm-cancel]`)).toHaveAttribute('disabled', '');
    await expect(page.locator(`${CLOCK} [data-flash]`)).toBeVisible({ timeout: 10_000 });
    expect(m.writes).toHaveLength(1);
  });

  test('a refusal says nothing changed; an unknown outcome blocks a blind repeat', async ({ page }) => {
    const m = newInstallerMock({ result: { host_apply: 'refused', station_sync: 'unknown' } });
    await open(page, m);
    await page.locator(`${CLOCK} [data-clock-host-apply]`).click();
    await page.locator(`${CLOCK} [data-typed]`).fill('שעון השרת');
    await page.locator(`${CLOCK} [data-confirm-send]`).click();
    await expect(page.locator(`${CLOCK} [data-outcome="refused"]`)).toContainText('לא השתנה דבר');
    await page.locator(`${CLOCK} [data-confirm-cancel]`).click();
    await page.locator(`${CLOCK} [data-station="entry-a"] [data-clock-sync]`).click();
    await page.locator(`${CLOCK} [data-typed]`).fill('שער ראשי');
    await page.locator(`${CLOCK} [data-confirm-send]`).click();
    await expect(page.locator(`${CLOCK} [data-outcome="unknown"]`)).toContainText('ייתכן שבוצע');
    await expect(page.locator(`${CLOCK} [data-confirm-send]`)).toHaveAttribute('disabled', '');
    expect(m.writes.map((w) => w.path)).toEqual(['access-control/installer/clock/host-apply', 'access-control/installer/clock/stations/entry-a/sync']);
  });

  test('a part that failed to load says so; the others still work', async ({ page }) => {
    await open(page, newInstallerMock({ failParts: new Set(['host']) }));
    await expect(page.locator(`${CLOCK} [data-clock-host="error"]`)).toContainText('operations_unavailable');
    await expect(page.locator(`${CLOCK} [data-clock-settings="ready"]`)).toBeVisible();
  });

  test('without system.configure the area is forbidden; a tool WisKey does not offer is unavailable', async ({ page }) => {
    await open(page, newInstallerMock({ persona: 'siteAdmin' }), '/system/intercom-installer/clock', `${ROOT} sw-page[data-state="forbidden"]`);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await open(page, newInstallerMock({ unavailable: new Set(['clock']) }), '/system/intercom-installer/clock', `${ROOT} [data-tool-unavailable]`);
  });

  test('classic is pixel-stable: the clock tab', async ({ page }, info) => {
    await open(page, newInstallerMock());
    await settlePage(page);
    await compare(page, info, 'installer-clock');
  });

  test('classic is pixel-stable: the station clock confirmation with the typed phrase', async ({ page }, info) => {
    await open(page, newInstallerMock());
    await page.locator(`${CLOCK} [data-station="entry-a"] [data-clock-sync]`).click();
    await page.waitForSelector(`${CLOCK} [data-typed]`);
    await page.locator(`${CLOCK} [data-typed]`).fill('שער');
    await settlePage(page);
    await compare(page, info, 'installer-clock-confirm');
  });
});

const TECH = `${ROOT} installer-technical`;
const TDIALOG = `${TECH} wk-installer-confirm sw-dialog[open]`;

async function openTech(page: Page, m: InstallerMock, station = 'entry-a') {
  await open(page, m, '/system/intercom-installer/technical', `${TECH} [data-technical="empty"]`);
  await page.locator(`${TECH} [data-station-pick]`).selectOption(station);
  await page.waitForSelector(`${TECH} [data-technical="ready"]`, { timeout: 30_000 });
}

test.describe('the intercom installer: station technical settings', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  test('the read shows both doors; only the mapped door is editable; passwords are presence only', async ({ page }) => {
    await openTech(page, newInstallerMock());
    await expect(page.locator(`${TECH} sw-card[data-door="1"]`)).toHaveAttribute('data-editable', 'true');
    await expect(page.locator(`${TECH} sw-card[data-door="2"]`)).toHaveAttribute('data-editable', 'false');
    await expect(page.locator(`${TECH} sw-card[data-door="2"] [data-field="openDuration"]`)).toBeDisabled();
    await expect(page.locator(`${TECH} [data-passwords]`)).toContainText('אין קוד ציבורי');
    await expect(page.locator(`${TECH} [data-door-save]`)).toHaveAttribute('disabled', '');
  });

  test('an edit shows before / after and sends expected + only the change, once', async ({ page }) => {
    const m = newInstallerMock();
    await openTech(page, m);
    await page.locator(`${TECH} sw-card[data-door="1"] [data-field="openDuration"]`).fill('300');
    await expect(page.locator(`${TECH} [data-door-save]`)).toHaveAttribute('disabled', '');
    await page.locator(`${TECH} sw-card[data-door="1"] [data-field="openDuration"]`).fill('8');
    await page.locator(`${TECH} [data-door-save]`).click();
    await expect(page.locator(`${TDIALOG} tr[data-key="openDuration"][data-changed]`)).toContainText('8');
    await expect(page.locator(`${TECH} [data-typed]`)).toHaveCount(0);
    await page.locator(`${TECH} [data-confirm-send]`).click();
    await expect(page.locator(`${TECH} [data-flash]`)).toBeVisible();
    expect(m.writes).toHaveLength(1);
    expect(m.writes[0]).toMatchObject({ path: 'access-control/installer/technical/stations/entry-a/doors/1', body: { expected: { doorName: 'כניסה', openDuration: 5, relayReverseEnabled: false }, changes: { openDuration: 8 } } });
  });

  test('a relay inversion warns and needs the typed station name', async ({ page }) => {
    const m = newInstallerMock();
    await openTech(page, m);
    await page.locator(`${TECH} sw-card[data-door="1"] [data-field="relayReverseEnabled"]`).check();
    await expect(page.locator(`${TECH} sw-card[data-door="1"] .msg.warn`)).toBeVisible();
    await page.locator(`${TECH} [data-door-save]`).click();
    await expect(page.locator(`${TECH} [data-confirm-send]`)).toHaveAttribute('disabled', '');
    await page.locator(`${TECH} [data-typed]`).fill('שער ראשי');
    await page.locator(`${TECH} [data-confirm-send]`).click();
    await expect(page.locator(`${TECH} [data-flash]`)).toBeVisible();
    expect(m.writes[0].body).toMatchObject({ typed_confirmation: 'שער ראשי', changes: { relayReverseEnabled: true } });
  });

  test('a failed read says why; an unknown save is not shown as done', async ({ page }) => {
    await open(page, newInstallerMock({ result: { technical_read: 'refused' } }), '/system/intercom-installer/technical', `${TECH} [data-technical="empty"]`);
    await page.locator(`${TECH} [data-station-pick]`).selectOption('entry-a');
    await expect(page.locator(`${TECH} [data-technical="error"]`)).toBeVisible();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const m = newInstallerMock({ result: { update: 'unknown' } });
    await openTech(page, m);
    await page.locator(`${TECH} sw-card[data-door="1"] [data-field="doorName"]`).fill('לובי');
    await page.locator(`${TECH} [data-door-save]`).click();
    await page.locator(`${TECH} [data-confirm-send]`).click();
    await expect(page.locator(`${TECH} [data-outcome="unknown"]`)).toBeVisible();
    await expect(page.locator(`${TECH} [data-flash]`)).toHaveCount(0);
  });

  test('classic is pixel-stable: a station\'s technical settings', async ({ page }, info) => {
    await openTech(page, newInstallerMock());
    await settlePage(page);
    await compare(page, info, 'installer-technical');
  });

  test('classic is pixel-stable: the relay-inversion confirmation', async ({ page }, info) => {
    await openTech(page, newInstallerMock());
    await page.locator(`${TECH} sw-card[data-door="1"] [data-field="relayReverseEnabled"]`).check();
    await page.locator(`${TECH} [data-door-save]`).click();
    await page.waitForSelector(`${TECH} [data-typed]`);
    await settlePage(page);
    await compare(page, info, 'installer-technical-confirm');
  });
});

const LIFE = `${ROOT} installer-lifecycle`;
const openLife = (page: Page, m: InstallerMock) => open(page, m, '/system/intercom-installer/lifecycle', `${LIFE} [data-jobs]`);

test.describe('the intercom installer: add, reconnect, remove', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  test('the wizard adds a station; the password leaves the form once sent; the saving step is confirmed', async ({ page }) => {
    const m = newInstallerMock();
    await openLife(page, m);
    await page.locator(`${LIFE} [data-add-start]`).click();
    await expect(page.locator(`${LIFE} [data-wizard="user"]`)).toBeVisible();
    await expect(page.locator(`${LIFE} [data-flow-next]`)).toHaveAttribute('disabled', '');
    await page.locator(`${LIFE} [data-flow-field="name"]`).fill('לובי');
    await page.locator(`${LIFE} [data-flow-field="host"]`).fill('lobby.local');
    await page.locator(`${LIFE} [data-flow-field="password"]`).fill('wrong');
    await page.locator(`${LIFE} [data-flow-next]`).click();
    await expect(page.locator(`${LIFE} [data-flow-error]`)).toContainText('שגויים');
    await expect(page.locator(`${LIFE} [data-flow-field="password"]`)).toHaveValue('');
    await page.locator(`${LIFE} [data-flow-field="password"]`).fill('correct-horse');
    await page.locator(`${LIFE} [data-flow-next]`).click();
    await expect(page.locator(`${LIFE} [data-wizard="confirm_device"]`)).toContainText('DS-KV6113-WPE1');
    await page.locator(`${LIFE} [data-flow-next]`).click();
    await expect(page.locator(`${LIFE} [data-wizard="locks"]`)).toBeVisible();
    await page.locator(`${LIFE} [data-flow-next]`).click(); // camera only: this step saves - the confirmation dialog
    await page.locator(`${LIFE} [data-confirm-send]`).click();
    await expect(page.locator(`${LIFE} [data-flash]`)).toContainText('לובי');
    expect(m.flowInputs.map((x) => x.step)).toEqual(['user', 'user', 'confirm_device', 'locks']);
    expect(m.flowInputs[1].input).toMatchObject({ name: 'לובי', host: 'lobby.local', username: 'admin', password: 'correct-horse', port: 80 });
  });

  test('the relay test pulses the door only with the typed phrase', async ({ page }) => {
    const m = newInstallerMock();
    await openLife(page, m);
    await page.locator(`${LIFE} [data-add-start]`).click();
    await page.locator(`${LIFE} [data-flow-field="host"]`).fill('lobby.local');
    await page.locator(`${LIFE} [data-flow-field="password"]`).fill('pw');
    await page.locator(`${LIFE} [data-flow-next]`).click();
    await page.locator(`${LIFE} [data-flow-next]`).click();
    await page.locator(`${LIFE} [data-flow-mode="map_active_relay"]`).check();
    await page.locator(`${LIFE} [data-flow-next]`).click();
    await page.locator(`${LIFE} [data-confirm-send]`).click();
    await expect(page.locator(`${LIFE} [data-wizard="mapping"]`)).toBeVisible();
    await page.locator(`${LIFE} [data-flow-next]`).click();
    await expect(page.locator(`${LIFE} [data-phrase]`)).toHaveText('פתיחת דלת לבדיקה');
    await expect(page.locator(`${LIFE} [data-confirm-send]`)).toHaveAttribute('disabled', '');
    await page.locator(`${LIFE} [data-typed]`).fill('פתיחת דלת לבדיקה');
    await page.locator(`${LIFE} [data-confirm-send]`).click();
    await expect(page.locator(`${LIFE} [data-wizard="confirm_mapping"]`)).toBeVisible();
    const pulse = m.writes.find((w) => w.path.endsWith('/steps/mapping'))!;
    expect(pulse.body).toMatchObject({ typed_confirmation: 'פתיחת דלת לבדיקה', input: { api_id: 1, test_unlock: true } });
  });

  test('a removal: impact, prepare, then each step with the typed station name; a blocker stops it', async ({ page }) => {
    const m = newInstallerMock();
    await openLife(page, m);
    await page.locator(`${LIFE} [data-source-pick]`).selectOption('entry-a');
    await page.locator(`${LIFE} [data-target-pick]`).selectOption('entry-c');
    await page.locator(`${LIFE} [data-review]`).click();
    await expect(page.locator(`${LIFE} [data-blockers]`)).toContainText('בעמדת היעד יש משתמשים');
    await expect(page.locator(`${LIFE} [data-prepare]`)).toHaveAttribute('disabled', '');
    await page.locator(`${LIFE} [data-target-pick]`).selectOption('');
    await page.locator(`${LIFE} [data-review]`).click();
    await page.locator(`${LIFE} [data-prepare]`).click();
    await page.locator(`${LIFE} [data-confirm-send]`).click();
    await expect(page.locator(`${LIFE} [data-job="job-1"]`)).toHaveAttribute('data-state', 'prepared');
    await page.locator(`${LIFE} [data-job-action="apply"]`).click();
    await page.locator(`${LIFE} [data-typed]`).fill('שער ראשי');
    await page.locator(`${LIFE} [data-confirm-send]`).click();
    await expect(page.locator(`${LIFE} [data-job="job-1"]`)).toHaveAttribute('data-state', 'applied');
    await page.locator(`${LIFE} [data-job-action="verify"]`).click();
    await expect(page.locator(`${LIFE} [data-typed]`)).toHaveCount(0);
    await page.locator(`${LIFE} [data-confirm-send]`).click();
    await page.locator(`${LIFE} [data-job-action="remove"]`).click();
    await page.locator(`${LIFE} [data-typed]`).fill('שער ראשי');
    await page.locator(`${LIFE} [data-confirm-send]`).click();
    await expect(page.locator(`${LIFE} [data-job="job-1"]`)).toHaveAttribute('data-state', 'removed');
    expect(m.writes.map((w) => w.path.split('/').pop())).toEqual(['prepare', 'apply', 'verify', 'remove']);
  });

  test('classic is pixel-stable: add, reconnect, remove', async ({ page }, info) => {
    await openLife(page, newInstallerMock());
    await settlePage(page);
    await compare(page, info, 'installer-lifecycle');
  });

  test('classic is pixel-stable: the connection step of the wizard', async ({ page }, info) => {
    await openLife(page, newInstallerMock());
    await page.locator(`${LIFE} [data-add-start]`).click();
    await page.waitForSelector(`${LIFE} [data-wizard="user"]`);
    await page.locator(`${LIFE} [data-flow-field="host"]`).fill('lobby.local');
    await settlePage(page);
    await compare(page, info, 'installer-lifecycle-wizard');
  });
});

const PLAT = `${ROOT} installer-platform`;
const openPlat = (page: Page, m: InstallerMock) => open(page, m, '/system/intercom-installer/platform', `${PLAT} [data-platform="ready"]`);

test.describe('the intercom installer: platform', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  test('health, capacity and the queue are shown; nothing is written by looking', async ({ page }) => {
    const m = newInstallerMock();
    await openPlat(page, m);
    await expect(page.locator(`${PLAT} [data-part="health"]`)).toHaveAttribute('data-state', 'ready');
    await expect(page.locator(`${PLAT} [data-capacity="entry-c"]`)).toContainText('בגבול');
    await expect(page.locator(`${PLAT} [data-part="queue"]`)).toContainText('התור ריק');
    expect(m.writes).toHaveLength(0);
  });

  test('a change to several stations: preview, typed apply, a result per station with the partial failure', async ({ page }) => {
    const m = newInstallerMock();
    await openPlat(page, m);
    await page.locator(`${PLAT} [data-change-station="entry-a"]`).check();
    await page.locator(`${PLAT} [data-change-station="entry-c"]`).check();
    await page.locator(`${PLAT} [data-change-field="openDuration"]`).fill('7');
    await page.locator(`${PLAT} [data-change-preview]`).click();
    await expect(page.locator(`${PLAT} [data-change-rows] tr[data-row="entry-a"]`)).toContainText('7');
    await page.locator(`${PLAT} [data-change-apply]`).click();
    await expect(page.locator(`${PLAT} [data-confirm-send]`)).toHaveAttribute('disabled', '');
    await page.locator(`${PLAT} [data-typed]`).fill('החלה על העמדות');
    await page.locator(`${PLAT} [data-confirm-send]`).click();
    await expect(page.locator(`${PLAT} [data-receipt="entry-c"]`)).toHaveAttribute('data-state', 'failed');
    await expect(page.locator(`${PLAT} [data-receipt="entry-a"]`)).toHaveAttribute('data-state', 'verified');
    await expect(page.locator(`${PLAT} [data-flash]`)).toContainText('חלק מהעמדות נכשלו');
    expect(m.writes.map((w) => w.path)).toEqual(['access-control/installer/platform/config/apply']);
  });

  test('the maintenance queue: enqueue with the typed phrase, then cancel', async ({ page }) => {
    const m = newInstallerMock();
    await openPlat(page, m);
    await page.locator(`${PLAT} [data-change-station="entry-a"]`).check();
    await page.locator(`${PLAT} [data-change-mode]`).selectOption('maintenance');
    await page.locator(`${PLAT} [data-change-field="openDuration"]`).fill('9');
    await page.locator(`${PLAT} [data-change-preview]`).click();
    await page.locator(`${PLAT} [data-change-apply]`).click();
    await page.locator(`${PLAT} [data-typed]`).fill('תזמון תחזוקה');
    await page.locator(`${PLAT} [data-confirm-send]`).click();
    await expect(page.locator(`${PLAT} [data-maint-job="job-m1"]`)).toHaveAttribute('data-state', 'queued');
    await page.locator(`${PLAT} [data-maint-cancel]`).click();
    await page.locator(`${PLAT} [data-confirm-send]`).click();
    await expect(page.locator(`${PLAT} [data-maint-job="job-m1"]`)).toHaveAttribute('data-state', 'cancelled');
  });

  test('retention shows what is deleted first; the webhook key is shown once after the typed phrase', async ({ page }) => {
    const m = newInstallerMock();
    await openPlat(page, m);
    await page.locator(`${PLAT} [data-ret="count"]`).fill('1000');
    await page.locator(`${PLAT} [data-ret-check]`).click();
    await expect(page.locator(`${PLAT} [data-ret-preview]`)).toContainText('200');
    expect(m.writes).toHaveLength(0);
    await page.locator(`${PLAT} [data-ret-apply]`).click();
    await page.locator(`${PLAT} [data-typed]`).fill('מחיקת אירועים');
    await page.locator(`${PLAT} [data-confirm-send]`).click();
    await expect(page.locator(`${PLAT} [data-flash]`)).toBeVisible();
    await page.locator(`${PLAT} [data-hook-url]`).fill('http://insecure.example/x');
    await expect(page.locator(`${PLAT} [data-hook-save]`)).toHaveAttribute('disabled', '');
    await page.locator(`${PLAT} [data-hook-key-show]`).click();
    await page.locator(`${PLAT} [data-typed]`).fill('הצגת המפתח');
    await page.locator(`${PLAT} [data-confirm-send]`).click();
    await expect(page.locator(`${PLAT} [data-hook-key]`)).toHaveText('ab'.repeat(32));
    await page.locator(`${PLAT} [data-hook-hide]`).click();
    await expect(page.locator(`${PLAT} [data-hook-key]`)).toHaveCount(0);
    expect(m.writes.map((w) => w.path.split('/').slice(-2).join('/'))).toEqual(['retention/apply', 'webhook/key']);
  });

  test('a station window is saved with confirmation', async ({ page }) => {
    const m = newInstallerMock();
    await openPlat(page, m);
    await page.locator(`${PLAT} [data-meta-pick]`).selectOption('entry-a');
    await page.locator(`${PLAT} [data-meta-field="zone"]`).fill('לובי צפוני');
    await page.locator(`${PLAT} [data-meta-save]`).click();
    await page.locator(`${PLAT} [data-confirm-send]`).click();
    await expect(page.locator(`${PLAT} [data-flash]`)).toBeVisible();
    expect(m.writes[0]).toMatchObject({ path: 'access-control/installer/platform/stations/entry-a', body: { revision: 4, values: { zone: 'לובי צפוני' } } });
  });

  test('classic is pixel-stable: the platform tab', async ({ page }, info) => {
    await openPlat(page, newInstallerMock());
    await settlePage(page);
    await compare(page, info, 'installer-platform');
  });
});
