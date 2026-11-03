import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, NOW, url } from './access-control-mocks';
import { installSchedWritesMock, newSchedMock, type SchedMock } from './schedule-writes-mocks';
import { settlePage } from './pixel-settle';

// WISKEY-SCHED-WRITE-2390 - the device schedule LIBRARY editor (owner decision 03.11 Q4 "a") inside "לוחות זמנים", behind the real shell,
// against a MOCKED backend (tests/access-control-mocks.ts + tests/schedule-writes-mocks.ts: invented data, no station, no integration).
// Desktop and phone. What it pins:
//   - the management view opens from the screen's header (schedules administrator) and is part of the address (?manage=1);
//   - a new schedule: save stays disabled until the integration's own check ran on exactly this draft; the confirmation; ONE create whose
//     check_id is the check's; the new row appears;
//   - a draft the integration would refuse is marked at the field, and cannot be checked or saved;
//   - a refusal is said as "WisKey סירב: <reason>" and nothing is reported saved;
//   - import: the file's preview first, then the confirmation, then ONE apply with the preview id;
//   - deploy to stations: offline stations cannot be picked; the preview shows the IMPACT (station, doors, people); the confirmation; one
//     deploy request; the progress follows the job ids to their final state - one station blocked by the integration (no write), one
//     failing at the station - honestly per station;
//   - no platform name (Home Assistant / Hikvision / add-on) anywhere.
// Evidence images: docs/design/evidence/wiskey-schedule-writes/.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'wiskey-schedule-writes');
const SCREEN = 'sw-app wiskey-schedules';
const LIB = `${SCREEN} wk-schedule-library`;
const ON = { 'access.ui.schedules': 'smplwise' };
const BANNED = /home\s*assistant|hikvision|ingress|supervisor|add-on|\bHA\b/i;

async function boot(page: Page, over: Partial<SchedMock> = {}, hash = '/wiskey/schedules?manage=1'): Promise<SchedMock> {
  await installAccessMock(page, { settings: ON });
  const m = newSchedMock(over);
  await installSchedWritesMock(page, m);
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(url(hash));
  await page.waitForSelector('sw-app');
  if (hash.includes('manage=1')) await expect(page.locator(`${LIB} [data-se-row="sch-contractors"]`)).toBeVisible({ timeout: 30_000 });
  return m;
}

async function shot(page: Page, info: TestInfo, name: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`), animations: 'disabled' });
}

const posts = (m: SchedMock, action: string) => m.posts.filter((p) => p.action === action);

async function confirm(page: Page, kind: string) {
  await expect(page.locator(`${LIB} sw-dialog[data-se-confirm="${kind}"]`)).toHaveAttribute('open', '');
  await page.locator(`${LIB} sw-dialog[data-se-confirm="${kind}"] [data-se-confirm-send]`).click();
}

test.describe('the schedule library editor', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone');
  });

  test('the management view opens from the header and keeps its address', async ({ page }, info) => {
    await boot(page, {}, '/wiskey/schedules');
    await expect(page.locator(`${SCREEN} [data-sch-program]`).first()).toBeVisible({ timeout: 30_000 });
    await page.locator(`${SCREEN} [data-sch-manage-open]`).click();
    await expect(page.locator(`${LIB} [data-se-row="sch-office"]`)).toBeVisible();
    expect(page.url()).toContain('manage=1');
    await expect(page.locator(`${LIB} [data-se-plan]`).first()).toBeVisible();
    await expect(page.locator(`${LIB} [data-se-job]`).first()).toBeVisible();
    await expect(page.locator(`${LIB} [data-se-writes-off]`)).toBeVisible();
    await shot(page, info, 'manage-view');
    const text = await page.locator(LIB).evaluate((el) => el.shadowRoot?.textContent ?? '');
    expect(text).not.toMatch(BANNED);
    await page.locator(`${SCREEN} [data-sch-manage-close]`).click();
    await expect(page.locator(`${SCREEN} [data-sch-program]`).first()).toBeVisible();
    expect(page.url()).not.toContain('manage=1');
  });

  test('a new schedule: check first, then confirm, then ONE create bound to the check', async ({ page }, info) => {
    const m = await boot(page);
    await page.locator(`${LIB} [data-se-new]`).click();
    const drawer = page.locator(`${LIB} sw-drawer[data-se-editor="new"]`);
    await expect(drawer).toHaveAttribute('open', '');
    const form = `${LIB} wk-schedule-draft-form`;
    await expect(page.locator(`${LIB} [data-se-save]`)).toHaveAttribute('disabled', '');
    await page.locator(`${form} [data-se-name]`).fill('שעות קבלה');
    await page.locator(`${form} [data-se-add-win="Sunday"]`).click();
    await page.locator(`${form} [data-se-copy]`).click();
    await expect(page.locator(`${form} [data-se-day="Thursday"] [data-se-win]`)).toHaveCount(1);
    await expect(page.locator(`${form} [data-se-hours]`)).toContainText('45');
    await page.locator(`${LIB} [data-se-check-run]`).click();
    await expect(page.locator(`${LIB} [data-se-check-result]`)).toContainText('ייפתחו');
    await expect(page.locator(`${LIB} [data-se-save]`)).not.toHaveAttribute('disabled', '');
    await shot(page, info, 'editor-checked');
    // an edit after the check needs a new check
    await page.locator(`${form} [data-se-name]`).fill('שעות קבלה 2');
    await expect(page.locator(`${LIB} [data-se-save]`)).toHaveAttribute('disabled', '');
    await page.locator(`${LIB} [data-se-check-run]`).click();
    await expect(page.locator(`${LIB} [data-se-save]`)).not.toHaveAttribute('disabled', '');
    await page.locator(`${LIB} [data-se-save]`).click();
    await expect(page.locator(`${LIB} [data-se-sentence]`)).toContainText('שעות קבלה 2');
    await shot(page, info, 'editor-confirm');
    expect(posts(m, 'create')).toHaveLength(0);
    await confirm(page, 'save');
    await expect(page.locator(`${LIB} [data-se-note="ok"]`)).toBeVisible();
    expect(posts(m, 'create')).toHaveLength(1);
    const create = posts(m, 'create')[0].body;
    expect(create.confirmed).toBe(true);
    expect(String(create.client_request_id)).toMatch(/^[A-Za-z0-9-]{8,64}$/);
    expect(create.data.name).toBe('שעות קבלה 2');
    expect(create.data.weekly.Thursday).toEqual([{ start: '08:00', end: '17:00' }]);
    expect(posts(m, 'check')).toHaveLength(2);
    await expect(page.locator(`${LIB} [data-se-row]`).filter({ hasText: 'שעות קבלה 2' })).toBeVisible();
    await page.waitForTimeout(400);
    expect(posts(m, 'create')).toHaveLength(1); // nothing repeats by itself
  });

  test('a draft the integration would refuse is marked at its field and cannot be checked', async ({ page }, info) => {
    const m = await boot(page);
    await page.locator(`${LIB} [data-se-edit="sch-contractors"]`).click();
    const form = `${LIB} wk-schedule-draft-form`;
    await page.locator(`${form} [data-se-add-win="Monday"]`).click();
    const second = page.locator(`${form} [data-se-win="Monday.1"]`);
    await second.locator('[data-se-start]').fill('15:00');
    await expect(page.locator(`${form} [data-se-fault="weekly.Monday"]`)).toContainText('חופפים');
    await expect(page.locator(`${LIB} [data-se-check-run]`)).toHaveAttribute('disabled', '');
    await expect(page.locator(`${LIB} [data-se-save]`)).toHaveAttribute('disabled', '');
    await shot(page, info, 'editor-fault');
    expect(posts(m, 'check')).toHaveLength(0);
  });

  test('a refusal is "WisKey סירב" with the reason, and nothing is reported saved', async ({ page }, info) => {
    const m = await boot(page, { refuse: { update: 'revision_conflict' } });
    await page.locator(`${LIB} [data-se-edit="sch-contractors"]`).click();
    await page.locator(`${LIB} wk-schedule-draft-form [data-se-name]`).fill('קבלנים - חורף');
    await page.locator(`${LIB} [data-se-check-run]`).click();
    await expect(page.locator(`${LIB} [data-se-check-result]`)).toBeVisible();
    await page.locator(`${LIB} [data-se-save]`).click();
    await confirm(page, 'save');
    const note = page.locator(`${LIB} sw-drawer [data-se-note="refused"]`);
    await expect(note).toContainText('WisKey סירב');
    await expect(note).toContainText('שינה את הרשומה');
    await expect(page.locator(`${LIB} sw-drawer[data-se-editor="sch-contractors"]`)).toHaveAttribute('open', '');
    expect(posts(m, 'update')).toHaveLength(1);
    await shot(page, info, 'editor-refused');
  });

  test('import: the preview, the confirmation, ONE apply with the preview id', async ({ page }, info) => {
    const m = await boot(page);
    const doc = JSON.stringify({ format: 'hikvision_intercom.schedule_drafts', version: 1, schedules: [{ name: 'שבת', weekly: { Monday: [], Tuesday: [], Wednesday: [], Thursday: [], Friday: [{ start: '08:00', end: '12:00' }], Saturday: [], Sunday: [] }, holidays: [] }] });
    await page.locator(`${LIB} [data-se-file]`).setInputFiles({ name: 'schedules.json', mimeType: 'application/json', buffer: Buffer.from(doc) });
    await expect(page.locator(`${LIB} sw-dialog[data-se-confirm="import"] [data-se-sentence]`)).toContainText('1');
    await shot(page, info, 'import-preview');
    expect(posts(m, 'import_apply')).toHaveLength(0);
    await confirm(page, 'import');
    await expect(page.locator(`${LIB} [data-se-note="ok"]`)).toContainText('יובאו 1');
    expect(posts(m, 'import_preview')).toHaveLength(1);
    expect(posts(m, 'import_apply')).toHaveLength(1);
    expect(String(posts(m, 'import_apply')[0].body.preview_id)).toMatch(/^[0-9a-f]{32}$/);
    expect(posts(m, 'import_apply')[0].body.confirmed).toBe(true);
    await expect(page.locator(`${LIB} [data-se-row]`).filter({ hasText: 'שבת' })).toBeVisible();
  });

  test('deploy: the impact before, one request, the progress honest per station', async ({ page }, info) => {
    const m = await boot(page, { failAt: new Set(['entry-b']) });
    await page.locator(`${LIB} [data-se-deploy="sch-contractors"]`).click();
    const drawer = `${LIB} sw-drawer[data-se-deploy-drawer="sch-contractors"]`;
    await expect(page.locator(drawer)).toHaveAttribute('open', '');
    await expect(page.locator(`${drawer} [data-se-pick="entry-c"] input`)).toBeDisabled(); // offline
    await page.locator(`${drawer} [data-se-pick="entry-a"] input`).check();
    await page.locator(`${drawer} [data-se-pick="entry-b"] input`).check();
    await page.locator(`${drawer} [data-se-read="entry-a"]`).click();
    await expect(page.locator(`${drawer} [data-se-target="entry-a"]`)).toContainText('טווח 1-255');
    await page.locator(`${drawer} [data-se-preview-all]`).click();
    await expect(page.locator(`${drawer} [data-se-target="entry-a"][data-phase="previewed"]`)).toBeVisible();
    await expect(page.locator(`${drawer} [data-se-target="entry-b"][data-phase="previewed"]`)).toBeVisible();
    const impact = page.locator(`${drawer} [data-se-target="entry-b"] [data-se-impact]`);
    await expect(impact.locator('[data-se-impact-doors]')).not.toBeEmpty();
    await expect(impact.locator('[data-se-impact-people]')).toContainText('37');
    await expect(impact.locator('[data-se-blockers] [data-code="schedule_writes_unverified"]')).toBeVisible();
    await expect(impact.locator('[data-se-conflicts]')).toContainText('שונה בעמדה');
    await shot(page, info, 'deploy-impact');
    expect(posts(m, 'deploy')).toHaveLength(0);
    await page.locator(`${drawer} [data-se-deploy-go]`).click();
    await confirm(page, 'deploy');
    await expect(page.locator(`${drawer} [data-se-progress]`)).toBeVisible();
    await expect(page.locator(`${drawer} [data-se-progress][data-done="true"]`)).toBeVisible({ timeout: 20_000 });
    await expect(page.locator(`${drawer} [data-se-result="entry-a"][data-status="blocked"]`)).toContainText('לא אומתה');
    await expect(page.locator(`${drawer} [data-se-result="entry-b"][data-status="failed"]`)).toContainText('דחתה את פרטי ההתחברות');
    await expect(page.locator(`${drawer} [data-se-writes-off]`)).toBeVisible();
    await shot(page, info, 'deploy-progress');
    expect(posts(m, 'plan_save')).toHaveLength(2);
    expect(posts(m, 'deploy')).toHaveLength(1);
    expect(posts(m, 'deploy')[0].body.plans).toHaveLength(2);
    expect(posts(m, 'deploy')[0].body.confirmed).toBe(true);
    const polled = m.gets.filter((g) => g.startsWith('schedules/jobs'));
    expect(polled.length).toBeGreaterThanOrEqual(2);
    const before = polled.length;
    await page.waitForTimeout(2600);
    expect(m.gets.filter((g) => g.startsWith('schedules/jobs')).length).toBe(before); // polling stops once every job is final
  });

  test('a claim needs its preview and its confirmation', async ({ page }, info) => {
    const m = await boot(page);
    await page.locator(`${LIB} [data-se-claim="plan-a"]`).click();
    await expect(page.locator(`${LIB} sw-dialog[data-se-confirm="claim"] [data-se-sentence]`)).toContainText('weekly:1');
    expect(posts(m, 'claim_preview')).toHaveLength(1);
    expect(posts(m, 'claim_confirm')).toHaveLength(0);
    await shot(page, info, 'claim-confirm');
    await confirm(page, 'claim');
    await expect(page.locator(`${LIB} [data-se-plan="plan-a"] [data-se-claimed]`)).toBeVisible();
    expect(String(posts(m, 'claim_confirm')[0].body.preview_id)).toMatch(/^[0-9a-f]{32}$/);
  });
});
