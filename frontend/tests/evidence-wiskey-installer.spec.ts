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
    await expect(page.locator(`${DIALOG}`)).toBeVisible();
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
    await page.waitForSelector(DIALOG);
    await page.locator(`${CLOCK} [data-typed]`).fill('שער');
    await settlePage(page);
    await compare(page, info, 'installer-clock-confirm');
  });
});
