import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, NOW, url, type MockOptions } from './access-control-mocks';
import { installStationsMock, newMock, openStations, type StationsMock } from './wiskey-stations-mocks';
import { settlePage } from './pixel-settle';

// TTS-DEFAULT-ENGINE-2400 (owner 04.11, answer 1א): the fixed announcement engine, against MOCKED backends (no WisKey, no station):
//   - Settings › מתגי מסכי כניסה › תצוגת מסך התחנות: the two rows, the system default named, a save sends only the changed keys, a fixed
//     engine WisKey does not list is named "לא זמין כרגע"; the settings side column keeps fitting 1440x900 with no scroll of its own;
//   - the station drawer / multi-station composer and the intercom overview dialog: the fixed engine + language preselected, a per-send
//     override that changes nothing in the setting, and a missing fixed engine that selects NOTHING (never another engine) until picked.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tts-default-2400.spec.ts --project=desktop --workers=1

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'TTS-DEFAULT-ENGINE-2400');
const SETTINGS = '/system/diagnostics?tab=access-control';
const DISPLAY = 'sw-app system-diagnostics system-access-display';
const SCREEN = 'wiskey-stations';

async function shot(page: Page, info: TestInfo, name: string, target?: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  const file = path.join(EVIDENCE, `${name}-${info.project.name}.png`);
  if (target) await page.locator(target).first().screenshot({ path: file });
  else await page.screenshot({ path: file });
}

async function settings(page: Page, opts: MockOptions = {}) {
  const mock = await installAccessMock(page, opts);
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(url(SETTINGS));
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${DISPLAY} sw-card[data-access-display="ready"]`)).toBeVisible({ timeout: 30_000 });
  return mock;
}

async function stations(page: Page, over: Partial<StationsMock> = {}): Promise<StationsMock> {
  const mock = newMock(over);
  await installStationsMock(page, mock);
  await openStations(page);
  await expect(page.locator(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible({ timeout: 30_000 });
  return mock;
}

const composer = (page: Page) => page.locator(`${SCREEN} wk-announce-dialog`);

test.describe('the setting', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('two rows under the announcement rows: the system default named, the engine list, the language of the chosen engine; save sends the keys', async ({ page }, info) => {
    const mock = await settings(page);
    const engine = page.locator(`${DISPLAY} select[data-set-access-display="access.tts_engine"]`);
    await expect(engine).toBeVisible();
    await expect(engine.locator('option')).toHaveText(['ברירת המחדל של המערכת (מנוע מקומי)', 'מנוע מקומי', 'שירות ענן']);
    await expect(engine).toHaveValue('');
    const language = page.locator(`${DISPLAY} select[data-set-access-display="access.tts_language"]`);
    await expect(language.locator('option')).toHaveText(['אוטומטית (עברית כשיש)', 'עברית · he', 'English · en']);
    await expect(page.locator(`${DISPLAY} [data-access-display-tts-engine] .muted`)).toContainText('נבחר מראש בכל הכרזה');
    await shot(page, info, 'setting-default', `${DISPLAY} sw-card`);
    await engine.selectOption('tts.cloud');
    await expect(language.locator('option')).toHaveText(['אוטומטית (עברית כשיש)', 'English · en']);
    await language.selectOption('en');
    await page.locator(`${DISPLAY} [data-save-access-display]`).click();
    await expect.poll(() => mock.patches.length).toBe(1);
    expect(mock.patches[0]).toEqual({ 'access.tts_engine': 'tts.cloud', 'access.tts_language': 'en' });
    // a language the next engine does not have returns to automatic in the same draft
    await engine.selectOption('tts.local');
    await expect(language).toHaveValue('en'); // tts.local has English too: kept
  });

  test('a fixed engine WisKey does not list stays selected and is named as not available (never replaced)', async ({ page }, info) => {
    await settings(page, { settings: { 'access.tts_engine': 'tts.gone', 'access.tts_language': 'he' } });
    const engine = page.locator(`${DISPLAY} select[data-set-access-display="access.tts_engine"]`);
    await expect(engine).toHaveValue('tts.gone');
    await expect(page.locator(`${DISPLAY} [data-tts-fixed-missing]`)).toHaveText('המנוע הקבוע tts.gone לא זמין כרגע');
    await expect(engine.locator('option[value="tts.gone"]')).toHaveText('tts.gone · לא זמין כרגע');
    await shot(page, info, 'setting-missing', `${DISPLAY} sw-card`);
  });

  test('a site administrator without system.configure sees the rows read-only and asks for no engine list', async ({ page }) => {
    const mock = await settings(page, { persona: 'siteAdmin' });
    await expect(page.locator(`${DISPLAY} select[data-set-access-display="access.tts_engine"]`)).toBeDisabled();
    expect(mock.calls.filter((c) => c.path === 'intercom/tts/engines')).toHaveLength(0);
  });

  test('1440x900: the settings side column still fits with no scroll of its own; the page height is recorded', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'a desktop-width rule');
    await page.setViewportSize({ width: 1440, height: 900 });
    await settings(page);
    await settlePage(page);
    const m = await page.evaluate(() => {
      const app = document.querySelector('sw-app')!.shadowRoot!;
      const nav = app.querySelector('system-nav') as HTMLElement | null;
      const diag = app.querySelector('system-diagnostics') as HTMLElement | null;
      const card = diag?.shadowRoot?.querySelector('system-access-display') as HTMLElement | null;
      const rows = card?.shadowRoot?.querySelectorAll('[data-access-display-tts-engine], [data-access-display-tts-language]') ?? [];
      const rowsH = [...rows].reduce((h, r) => h + (r as HTMLElement).getBoundingClientRect().height, 0);
      return { navScroll: nav?.scrollHeight ?? -1, navClient: nav?.clientHeight ?? -1, docScroll: document.scrollingElement!.scrollHeight, inner: innerHeight, cardH: card?.getBoundingClientRect().height ?? 0, rowsH };
    });
    info.annotations.push({ type: 'measure', description: JSON.stringify(m) });
    console.log(`TTS-DEFAULT-ENGINE-2400 settings @1440x900: ${JSON.stringify(m)}`);
    expect(m.navScroll).toBeGreaterThan(0);
    expect(m.navScroll).toBeLessThanOrEqual(m.navClient);
    await shot(page, info, 'settings-page-1440x900');
  });
});

test.describe('the announcement dialogs', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('drawer / multi-station composer: the fixed engine and language are preselected and sent', async ({ page }) => {
    const mock = await stations(page, { settings: { 'access.tts_engine': 'tts.cloud', 'access.tts_language': 'en' } });
    await page.locator(`${SCREEN} [data-wk-announce]`).click();
    const dlg = composer(page);
    await dlg.locator('[data-wk-announce-more]').click();
    await expect(dlg.locator('[data-wk-engine]')).toHaveValue('tts.cloud');
    await expect(dlg.locator('[data-wk-engine] option[value="tts.cloud"]')).toHaveText('שירות ענן · קבוע');
    await expect(dlg.locator('[data-wk-language]')).toHaveValue('en');
    await expect(dlg.locator('[data-wk-announce-override]')).toHaveCount(0);
    await dlg.locator('[data-wk-announce-message]').fill('test');
    await dlg.locator('[data-wk-target]').first().click();
    await dlg.locator('[data-wk-announce-send]').click();
    await expect.poll(() => mock.spoken.length).toBeGreaterThan(0);
    expect(mock.spoken.every((s) => s.body.engine_id === 'tts.cloud' && s.body.language === 'en')).toBe(true);
  });

  test('a per-send override goes with that send only; the next opening starts from the fixed engine again', async ({ page }, info) => {
    const mock = await stations(page, { settings: { 'access.tts_engine': 'tts.cloud', 'access.tts_language': 'en' } });
    await page.locator(`${SCREEN} [data-wk-announce]`).click();
    const dlg = composer(page);
    await dlg.locator('[data-wk-announce-more]').click();
    await dlg.locator('[data-wk-engine]').selectOption('tts.local');
    await expect(dlg.locator('[data-wk-language]')).toHaveValue('en'); // the fixed language, which this engine has too
    await expect(dlg.locator('[data-wk-announce-override]')).toContainText('להכרזה הזו בלבד');
    await shot(page, info, 'composer-override', `${SCREEN} wk-announce-dialog sw-dialog [role="dialog"]`);
    await dlg.locator('[data-wk-announce-message]').fill('test');
    await dlg.locator('[data-wk-target]').first().click();
    await dlg.locator('[data-wk-announce-send]').click();
    await expect.poll(() => mock.spoken.length).toBeGreaterThan(0);
    expect(mock.spoken[0].body).toMatchObject({ engine_id: 'tts.local', language: 'en' });
    await dlg.locator('[data-wk-announce-close]').click();
    await page.locator(`${SCREEN} [data-wk-announce]`).click();
    await dlg.locator('[data-wk-announce-more]').click();
    await expect(dlg.locator('[data-wk-engine]')).toHaveValue('tts.cloud');
  });

  test('a fixed engine WisKey does not list: said plainly, nothing selected, nothing sent until another engine is picked', async ({ page }, info) => {
    const mock = await stations(page, { settings: { 'access.tts_engine': 'tts.gone' } });
    await page.locator(`${SCREEN} [data-wk-announce]`).click();
    const dlg = composer(page);
    await expect(dlg.locator('[data-wk-announce-engine-missing]')).toHaveText('המנוע הקבוע tts.gone לא זמין כרגע. בחרו מנוע אחר להכרזה הזו');
    await expect(dlg.locator('[data-wk-engine]')).toBeVisible(); // the engine choice is open by itself
    await expect(dlg.locator('[data-wk-engine]')).toHaveValue('');
    await dlg.locator('[data-wk-announce-message]').fill('test');
    await dlg.locator('[data-wk-target]').first().click();
    await expect(dlg.locator('[data-wk-announce-send]')).toHaveAttribute('disabled', '');
    await shot(page, info, 'composer-missing', `${SCREEN} wk-announce-dialog sw-dialog [role="dialog"]`);
    expect(mock.spoken).toHaveLength(0);
    await dlg.locator('[data-wk-engine]').selectOption('tts.local');
    await expect(dlg.locator('[data-wk-language]')).toHaveValue('he');
    await dlg.locator('[data-wk-announce-send]').click();
    await expect.poll(() => mock.spoken.length).toBeGreaterThan(0);
    expect(mock.spoken.every((s) => s.body.engine_id === 'tts.local')).toBe(true);
  });

  test('intercom overview "הכרזה בעמדה": the fixed engine preselected; a missing one is said and blocks the send', async ({ page }, info) => {
    await installAccessMock(page, { settings: { 'access.tts_engine': 'tts.cloud', 'access.tts_language': 'en' } });
    await page.clock.setFixedTime(NOW);
    await page.goto('about:blank');
    await page.goto(url('/wiskey/overview'));
    const speak = page.locator('wiskey-overview [data-wiskey-speak]').first();
    await expect(speak).toBeVisible({ timeout: 30_000 });
    await speak.click();
    const dialog = page.locator('wiskey-overview sw-dialog[data-wiskey-tts-dialog]');
    await expect(dialog.locator('select[data-wiskey-tts-engine]')).toHaveValue('tts.cloud', { timeout: 15_000 });
    await expect(dialog.locator('select[data-wiskey-tts-language]')).toHaveValue('en');
    await shot(page, info, 'overview-fixed', 'wiskey-overview sw-dialog[data-wiskey-tts-dialog] [role="dialog"]');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installAccessMock(page, { settings: { 'access.tts_engine': 'tts.gone' } });
    await page.goto('about:blank');
    await page.goto(url('/wiskey/overview'));
    await page.locator('wiskey-overview [data-wiskey-speak]').first().click();
    await expect(dialog.locator('[data-wiskey-tts-engine-missing]')).toHaveText('המנוע הקבוע tts.gone לא זמין כרגע. בחרו מנוע אחר להכרזה הזו', { timeout: 15_000 });
    await expect(dialog.locator('select[data-wiskey-tts-engine]')).toHaveValue('');
    await dialog.locator('textarea[data-wiskey-tts-message]').fill('test');
    await expect(dialog.locator('[data-wiskey-tts-send] button')).toBeDisabled();
    await shot(page, info, 'overview-missing', 'wiskey-overview sw-dialog[data-wiskey-tts-dialog] [role="dialog"]');
  });
});
