import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installStationsMock, newMock, openStations, type StationsMock } from './wiskey-stations-mocks';
import { installDtMock, newDtMock, type DtMock } from './wiskey-door-tech-mocks';
import { tallDesktop } from './helpers/tall-desktop';

// WISKEY-DOOR-TECH-2390 - door technical writes in the stations drawer ("הגדרות דלת" -> "ניהול טכני של הדלתות"), behind the real
// shell, against a MOCKED backend (tests/wiskey-stations-mocks.ts + tests/wiskey-door-tech-mocks.ts: invented stations, no station, no
// intercom). Desktop and phone. What it pins:
//   - nothing is read or sent before the administrator opens the dialog; a caller without the permission gets no block at all;
//   - hold-open schedules: add / edit / delete, each behind its confirmation (cancel sends nothing), sent ONCE with the envelope;
//   - public codes: the typed phrase "קוד <n>" is required, the code is sent once and never shown (the fields are cleared, the slot says
//     only "מוגדר"), a station's code presence is read only when the codes tab opens;
//   - programs: apply from the draft, pause, remove - honest results: done, partly done, "WisKey סירב: <reason>", sent with no clear answer;
//   - a station the caller may not write says so; an offline station keeps the device writes disabled.
// Evidence images: docs/design/evidence/wiskey-door-tech/.
//   run_smart.py spec <branch> tests/evidence-wiskey-door-tech.spec.ts --machine runner --project=desktop --project=mobile

const SCREEN = 'wiskey-stations';
const CODE = '48151623';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/wiskey-door-tech');

async function boot(page: Page, over: Partial<DtMock> = {}, base: Partial<StationsMock> = {}) {
  const mock = newMock(base);
  await installStationsMock(page, mock);
  const dt = newDtMock(over);
  await installDtMock(page, mock, dt);
  await openStations(page);
  await expect(page.locator(`${SCREEN} [data-wk-stations][data-wk-state="ready"]`)).toBeVisible({ timeout: 30_000 });
  return { mock, dt };
}

/** The dialog's own reads (the drawer itself reads the programs and the code presence when its door settings open). */
const own = (dt: DtMock) => dt.reads.filter((r) => r.startsWith('door-tech:') || r.startsWith('hold:'));
const inDrawer = (page: Page, sel: string) => page.locator(`${SCREEN} sw-drawer[data-wk-drawer] ${sel}`);
const inDt = (page: Page, sel: string) => inDrawer(page, `wk-door-tech ${sel}`);

async function openSettings(page: Page, id: string) {
  await page.locator(`${SCREEN} [data-wk-grid] [data-wk-station="${id}"] button.open`).click();
  await expect(page.locator(`${SCREEN} sw-drawer[data-wk-drawer]`)).toHaveAttribute('open', '');
  await inDrawer(page, '[data-wk-settings-toggle]').click();
}

async function openDialog(page: Page, id: string) {
  await openSettings(page, id);
  await inDt(page, '[data-wk-dt-open]').click();
  await expect(inDt(page, 'sw-dialog[data-wk-dt-dialog]')).toHaveAttribute('open', '');
  await expect(inDt(page, 'sw-dialog[data-wk-dt-dialog][data-wk-dt-state="ready"]')).toHaveCount(1, { timeout: 15_000 });
}

async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: path.join(OUT, `${name}-${info.project.name}.png`), animations: 'disabled' });
}

const dialogText = (page: Page) => inDt(page, 'sw-dialog[data-wk-dt-dialog]').evaluate((el) => {
  const walk = (n: Node): string => (n instanceof Element && n.shadowRoot ? walk(n.shadowRoot) : '') + [...n.childNodes].map((c) => (c.nodeType === 3 ? c.textContent : walk(c))).join(' ');
  const host = el.getRootNode() as ShadowRoot;
  return walk(host);
});

test.describe('door technical writes', () => {
  tallDesktop(); // NOSCROLL-1366-2437: every station of the mock on one page from 1024 px
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name === 'tablet', 'desktop and phone only'));

  test('nothing is read or sent before the dialog opens', async ({ page }, info) => {
    const { dt } = await boot(page);
    await openSettings(page, 'lobby');
    await expect(inDt(page, '[data-wk-dt-open]')).toBeVisible();
    expect(own(dt)).toEqual([]);
    expect(dt.posts).toEqual([]);
    await inDrawer(page, '[data-wk-dsec="settings"]').scrollIntoViewIfNeeded();
    await shot(page, info, 'drawer-entry');
  });

  test('a caller without system.configure or access.stations.manage gets no block and nothing is read', async ({ page }) => {
    const op = await boot(page, {}, { persona: 'operator' });
    await openSettings(page, 'lobby');
    await expect(inDrawer(page, '[data-wk-dsec="settings"]')).toBeVisible();
    await expect(inDrawer(page, 'wk-door-tech [data-wk-dt-open]')).toHaveCount(0);
    expect(own(op.dt)).toEqual([]);
    expect(op.dt.posts).toEqual([]);
  });

  test('a hold-open schedule: add behind a confirmation (cancel sends nothing), edit, delete - each once', async ({ page }, info) => {
    const { dt } = await boot(page);
    await openDialog(page, 'lobby');
    expect(own(dt)).toEqual(expect.arrayContaining(['door-tech:lobby', 'hold:lobby/1', 'hold:lobby/2']));
    await expect(inDt(page, '[data-wk-dt-hold="1"]')).toContainText('שעות לובי');
    await expect(inDt(page, '[data-wk-dt-hold="2"]')).toContainText('אין לוח החזקה');
    await shot(page, info, 'hold-list');
    await inDt(page, '[data-wk-dt-hold-edit="2"]').click();
    await expect(inDt(page, '[data-wk-dt-editor="2"]')).toBeVisible();
    await expect(inDt(page, '[data-wk-dt-save]')).toHaveAttribute('disabled', '');
    await inDt(page, '[data-wk-dt-name]').fill('מחסום ערב');
    await inDt(page, '[data-wk-dt-add-period="Sunday"]').click();
    await inDt(page, '[data-wk-dt-add-period="Monday"]').click();
    await shot(page, info, 'hold-editor');
    await inDt(page, '[data-wk-dt-save]').click();
    await expect(inDt(page, '[data-wk-dt-confirm="hold_save"]')).toBeVisible();
    await expect(inDt(page, '[data-wk-dt-sentence]')).toContainText('מחסום ערב');
    await inDt(page, '[data-wk-dt-cancel]').click();
    expect(dt.posts).toEqual([]);
    await inDt(page, '[data-wk-dt-save]').click();
    await shot(page, info, 'hold-confirm');
    await inDt(page, '[data-wk-dt-send]').click();
    await expect(inDt(page, '[data-wk-dt-result="hold:2"][data-status="acknowledged"]')).toContainText('בוצע ואושר');
    expect(dt.posts).toHaveLength(1);
    const sent = dt.posts[0];
    expect(sent.path).toBe('lobby/doors/2/hold');
    expect(sent.body).toMatchObject({ confirmed: true, revision: 0, policy: { name: 'מחסום ערב', timezone: 'Asia/Jerusalem' } });
    expect(Object.keys(sent.body).sort()).toEqual(['client_request_id', 'confirmed', 'expires_at', 'policy', 'revision']);
    expect((sent.body.policy as { weekly: Record<string, unknown[]> }).weekly.Sunday).toEqual([{ start: '07:00', end: '19:00' }]);
    await expect(inDt(page, '[data-wk-dt-hold="2"]')).toContainText('מחסום ערב');
    // edit door 1 (revision 2), then delete it
    await inDt(page, '[data-wk-dt-hold-edit="1"]').click();
    await inDt(page, '[data-wk-dt-name]').fill('שעות לובי חדשות');
    await inDt(page, '[data-wk-dt-save]').click();
    await inDt(page, '[data-wk-dt-send]').click();
    await expect(inDt(page, '[data-wk-dt-result="hold:1"][data-status="acknowledged"]')).toBeVisible();
    expect(dt.posts[1].body).toMatchObject({ revision: 2 });
    await inDt(page, '[data-wk-dt-hold-delete="1"]').click();
    await expect(inDt(page, '[data-wk-dt-confirm="hold_delete"]')).toBeVisible();
    await inDt(page, '[data-wk-dt-send]').click();
    await expect(inDt(page, '[data-wk-dt-hold="1"]')).toContainText('אין לוח החזקה');
    expect(dt.posts.map((p) => p.path)).toEqual(['lobby/doors/2/hold', 'lobby/doors/1/hold', 'lobby/doors/1/hold/delete']);
    expect(dt.posts[2].body).toMatchObject({ revision: 3, confirmed: true });
  });

  test('a public code needs the typed phrase, is sent once and never shown; a refusal reads "WisKey סירב"', async ({ page }, info) => {
    const { dt } = await boot(page);
    await openDialog(page, 'lobby');
    const before = dt.reads.filter((r) => r === 'codes:lobby').length;
    await inDt(page, '[data-wk-dt-tab="codes"]').click();
    await expect(inDt(page, '[data-wk-dt-slot="1"][data-configured="true"]')).toContainText('מוגדר');
    await expect(inDt(page, '[data-wk-dt-slot="2"][data-configured="false"]')).toContainText('לא מוגדר');
    expect(dt.reads.filter((r) => r === 'codes:lobby').length).toBe(before + 1); // the device read of the codes waits for the codes tab
    await inDt(page, '[data-wk-dt-code-set="2"]').click();
    await expect(inDt(page, '[data-wk-dt-code-form="2"]')).toBeVisible();
    await expect(inDt(page, '[data-wk-dt-code-field="current"]')).toHaveCount(0); // a slot that is not set has no current code
    await inDt(page, '[data-wk-dt-code-field="new"]').fill(CODE);
    await inDt(page, '[data-wk-dt-code-field="repeat"]').fill(CODE);
    await inDt(page, '[data-wk-dt-code-field="typed"]').fill('קוד 3');
    await inDt(page, '[data-wk-dt-code-send]').click();
    await expect(inDt(page, '[data-wk-dt-code-problem]')).toContainText('אינו תואם');
    expect(dt.posts).toEqual([]);
    await inDt(page, '[data-wk-dt-code-field="typed"]').fill('קוד 2');
    await shot(page, info, 'code-form');
    await inDt(page, '[data-wk-dt-code-send]').click();
    await expect(inDt(page, '[data-wk-dt-result="code:2"][data-status="acknowledged"]')).toBeVisible();
    await expect(inDt(page, '[data-wk-dt-slot="2"][data-configured="true"]')).toContainText('מוגדר');
    await expect(inDt(page, '[data-wk-dt-code-form]')).toHaveCount(0);
    expect(dt.posts).toHaveLength(1);
    expect(dt.posts[0].path).toBe('lobby/codes/2');
    expect(dt.posts[0].body).toMatchObject({ action: 'set', door: 1, expected: false, new_code: CODE, confirm_text: 'קוד 2', confirmed: true });
    expect(dt.posts[0].body).not.toHaveProperty('current_code');
    expect(await dialogText(page)).not.toContain(CODE);
    const values = await page.evaluate(() => {
      const all: string[] = [];
      const walk = (root: Document | ShadowRoot) => root.querySelectorAll('*').forEach((el) => {
        if (el instanceof HTMLInputElement) all.push(el.value);
        if (el.shadowRoot) walk(el.shadowRoot);
      });
      walk(document);
      return all;
    });
    expect(values.join('|')).not.toContain(CODE);
    await shot(page, info, 'code-done');
    // a clear of slot 1 asks for the current code; WisKey refuses it
    dt.result.code_write = 'refused';
    dt.code.code_write = 'reauth_required';
    await inDt(page, '[data-wk-dt-code-clear="1"]').click();
    await expect(inDt(page, '[data-wk-dt-code-field="new"]')).toHaveCount(0);
    await inDt(page, '[data-wk-dt-code-field="current"]').fill('1234');
    await inDt(page, '[data-wk-dt-code-field="typed"]').fill('קוד 1');
    await inDt(page, '[data-wk-dt-code-send]').click();
    await expect(inDt(page, '[data-wk-dt-result="code:1"][data-status="refused"]')).toContainText('WisKey סירב: נדרש אימות מחדש לפעולות רגישות');
    expect(dt.posts[1].body).toMatchObject({ action: 'clear', expected: true, current_code: '1234' });
    expect(dt.posts[1].body).not.toHaveProperty('new_code');
    await shot(page, info, 'code-refused');
  });

  test('programs: apply from the draft, a pause with no clear answer, a partial save, and WisKey refusing', async ({ page }, info) => {
    const { dt } = await boot(page);
    await openDialog(page, 'lobby');
    await inDt(page, '[data-wk-dt-tab="programs"]').click();
    await expect(inDt(page, '[data-wk-dt-program="1"][data-state="none"]')).toBeVisible();
    await expect(inDt(page, '[data-wk-dt-program="2"][data-state="on"]')).toContainText('מחסום בוקר');
    await shot(page, info, 'programs');
    await inDt(page, '[data-wk-dt-program-apply="1"]').click();
    await expect(inDt(page, '[data-wk-dt-confirm="program_save"] [data-wk-dt-sentence]')).toContainText('תוחזק פתוחה אוטומטית');
    await shot(page, info, 'program-confirm');
    await inDt(page, '[data-wk-dt-send]').click();
    await expect(inDt(page, '[data-wk-dt-result="program:1"][data-status="acknowledged"]')).toBeVisible();
    await expect(inDt(page, '[data-wk-dt-program="1"][data-state="on"]')).toContainText('שעות לובי');
    expect(dt.posts[0]).toMatchObject({ path: 'lobby/doors/1/program', body: { revision: 0, enabled: true, confirmed: true, policy: { name: 'שעות לובי' } } });
    dt.result.program_action = 'unknown';
    await inDt(page, '[data-wk-dt-program-pause="2"]').click();
    await inDt(page, '[data-wk-dt-send]').click();
    await expect(inDt(page, '[data-wk-dt-result="program:2"][data-status="unknown"]')).toContainText('ייתכן שבוצע');
    expect(dt.posts[1]).toMatchObject({ path: 'lobby/doors/2/program/pause', body: { revision: 4 } });
    dt.result.program_action = 'refused';
    dt.code.program_action = 'revision_conflict';
    await inDt(page, '[data-wk-dt-program-remove="2"]').click();
    await inDt(page, '[data-wk-dt-send]').click();
    await expect(inDt(page, '[data-wk-dt-result="program:2"][data-status="refused"]')).toContainText('WisKey סירב: הנתונים השתנו מאז שנטענו');
    await shot(page, info, 'program-refused');
    // the log tab lists what was done, with the honest status
    await inDt(page, '[data-wk-dt-tab="history"]').click();
    await expect(inDt(page, '[data-wk-dt-history-row]')).toHaveCount(3);
    await expect(inDt(page, '[data-wk-dt-history-row="program_action"][data-status="refused"]')).toBeVisible();
    expect(dt.posts).toHaveLength(3);
  });

  test('a partial program save says partly done', async ({ page }) => {
    const { dt } = await boot(page, { result: { program_save: 'partial' } });
    await openDialog(page, 'lobby');
    await inDt(page, '[data-wk-dt-tab="programs"]').click();
    await inDt(page, '[data-wk-dt-program-apply="1"]').click();
    await inDt(page, '[data-wk-dt-send]').click();
    await expect(inDt(page, '[data-wk-dt-result="program:1"][data-status="partial"]')).toContainText('בוצע חלקית');
    expect(dt.posts).toHaveLength(1);
  });

  test('a station this caller may not write says so; an offline station keeps device writes off', async ({ page }, info) => {
    const { dt } = await boot(page, { allowed: new Set(['gate']) });
    await openDialog(page, 'lobby');
    await expect(inDt(page, '[data-wk-dt-not-allowed]')).toContainText('למנהלי מערכת בלבד');
    expect(own(dt)).toEqual(['door-tech:lobby']);
    await shot(page, info, 'not-allowed');
    await page.goto('about:blank');
    const off = await boot(page, { allowed: new Set(['store']), drafts: { 'store/1': { door: 1, revision: 1, policy: { timezone: 'Asia/Jerusalem', name: 'מחסן', weekly: {}, holidays: [] } } } });
    await openDialog(page, 'store');
    await expect(inDt(page, '[data-wk-dt-offline]')).toBeVisible();
    await inDt(page, '[data-wk-dt-tab="programs"]').click();
    await expect(inDt(page, '[data-wk-dt-program-apply="1"]')).toHaveAttribute('disabled', '');
    expect(off.dt.posts).toEqual([]);
  });
});
