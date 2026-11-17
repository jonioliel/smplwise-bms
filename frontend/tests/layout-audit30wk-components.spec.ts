import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ddValue, pickOption } from './helpers/wk-choose';
import { installStationsMock, newMock, openStations } from './wiskey-stations-mocks';
import { installTriageMock, openTriage, PANEL } from './wiskey-triage-mocks';

// AUDIT30-WK-COMPONENTS (design audit round 30, #16, follow-up of AUDIT30-H2-WISKEY): no native <select> left in the WisKey
// components (components/wk-*.ts: announce dialog, door tech, schedule library, triage panel); every choice list is the shared
// <sw-dropdown>. A locked pick (the triage notification setting without the edit right) is inert + aria-disabled, faded with
// --sw-disabled-opacity, because sw-dropdown has no disabled state of its own (branch B's file).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-audit30wk-components.spec.ts --project=desktop --project=mobile

const COMPONENTS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'components');
const wkSources = () => fs.readdirSync(COMPONENTS).filter((f) => /^wk-.*\.ts$/.test(f));
/** The source without comments, so a comment that names "<select>" does not count. */
const code = (f: string) => fs.readFileSync(path.join(COMPONENTS, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');

test.describe('AUDIT30-WK: WisKey components on sw-dropdown', () => {
  test('source guard: no native <select> and no HTMLSelectElement in any wk-* component', async ({}, info) => {
    test.skip(info.project.name !== 'desktop', 'source check once');
    const files = wkSources();
    expect(files.length).toBeGreaterThan(10);
    const offenders = files.filter((f) => /<select\b|HTMLSelectElement/.test(code(f)));
    expect(offenders).toEqual([]);
    for (const f of ['wk-announce-dialog.ts', 'wk-door-tech.ts', 'wk-schedule-library.ts', 'wk-triage-panel.ts']) expect(code(f)).toContain('<sw-dropdown');
  });

  test.describe('rendered', () => {
    test.beforeEach(({}, info) => {
      test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
      test.skip(!['desktop', 'mobile'].includes(info.project.name), 'desktop + mobile');
    });

    test('the announce dialog: engine and language are dropdowns, the pick goes with the send', async ({ page }) => {
      const mock = newMock();
      await installStationsMock(page, mock);
      await openStations(page);
      await expect(page.locator('wiskey-stations [data-wk-stations][data-wk-state="ready"]')).toBeVisible({ timeout: 30_000 });
      await page.locator('wiskey-stations [data-wk-announce]').click();
      const dlg = page.locator('wiskey-stations wk-announce-dialog');
      await dlg.locator('[data-wk-announce-more]').click();
      const engine = dlg.locator('[data-wk-engine]');
      await expect(engine).toBeVisible();
      expect(await engine.evaluate((n) => n.localName)).toBe('sw-dropdown');
      await expect(dlg.locator('select')).toHaveCount(0);
      await pickOption(engine, 'tts.cloud');
      await expect.poll(() => ddValue(engine)).toBe('tts.cloud');
      await dlg.locator('[data-wk-announce-message]').fill('test');
      await dlg.locator('[data-wk-target]').first().click();
      await dlg.locator('[data-wk-announce-send]').click();
      await expect.poll(() => mock.spoken.length).toBe(1);
      expect(mock.spoken[0].body).toMatchObject({ engine_id: 'tts.cloud' });
    });

    async function triage(page: Page, persona?: 'siteAdmin') {
      const mock = await installTriageMock(page, persona ? { persona } : {});
      await openTriage(page, '/wiskey/alerts');
      await expect(page.locator(`${PANEL} [data-wkt-panel="full"]`)).toBeVisible({ timeout: 30_000 });
      return mock;
    }

    test('the triage snooze dialog and notification setting: dropdowns, operable, no native select', async ({ page }) => {
      const mock = await triage(page);
      await expect(page.locator(`${PANEL} select`)).toHaveCount(0);
      await page.locator(`${PANEL} [data-wkt-alert="entry-c/offline"] [data-wkt-snooze]`).click();
      const dlg = page.locator(`${PANEL} sw-dialog[data-wkt-alert-dialog]`);
      await expect(dlg).toHaveAttribute('open', '');
      await expect(dlg.locator('select')).toHaveCount(0);
      await pickOption(dlg.locator('[data-wkt-duration]'), '240');
      await pickOption(dlg.locator('[data-wkt-reason]'), 'network_work');
      await expect.poll(() => ddValue(dlg.locator('[data-wkt-duration]'))).toBe('240');
      await dlg.locator('[data-wkt-alert-ok]').click();
      await expect.poll(() => mock.calls.filter((c) => c.method === 'POST').length).toBe(1);
      expect(mock.calls.find((c) => c.method === 'POST')?.body).toMatchObject({ duration_minutes: 240, reason: 'network_work' });
      await pickOption(page.locator(`${PANEL} [data-wkt-notify-select]`), 'on');
      await expect(page.locator(`${PANEL} [data-wkt-notify]`)).toHaveAttribute('data-wkt-notify', 'on');
    });

    test('a locked pick is inert, aria-disabled and faded with the disabled token', async ({ page }) => {
      const mock = await triage(page, 'siteAdmin');
      const pick = page.locator(`${PANEL} [data-wkt-notify-select]`);
      await expect(pick).toHaveAttribute('aria-disabled', 'true');
      await expect(pick).toHaveAttribute('inert', '');
      const [opacity, token] = await pick.evaluate((n) => [getComputedStyle(n).opacity, getComputedStyle(n).getPropertyValue('--sw-disabled-opacity').trim()]);
      expect(token).not.toBe('');
      expect(Number(opacity)).toBeCloseTo(Number(token), 2);
      expect(mock.calls.filter((c) => c.method !== 'GET')).toEqual([]);
    });
  });
});
