import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { url } from './generator-mocks';
import { installMaintenanceMock } from './maintenance-mocks';

// CR-MAINT215 slice 2 evidence: the section "תחזוקה ובקרה" of the service-management area (ledger + task sheet + supplier card, preventive plans,
// rounds with the digital checklist, QR / NFC tags, the scan route, Settings) from the REAL build against a mocked backend (fake data only):
// the three roles, the module off, the tickets module off (no request element anywhere), empty / loading / error, phone layout.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-maintenance.spec.ts
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/maintenance');
const M = 'sw-app tickets-maintenance';
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}.png`), fullPage: true });
const phone = () => test.info().project.name === 'mobile';

async function open(page: Page, hash: string, scheme: 'light' | 'dark' = 'light') {
  await page.goto('about:blank');
  await page.goto(url(hash, 'classic', scheme));
}

test.describe('maintenance evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

  for (const scheme of ['light', 'dark'] as const) {
    test(`ledger: KPI row, places tree, table / phone cards (${scheme})`, async ({ page }) => {
      await installMaintenanceMock(page);
      await open(page, '/tickets/maintenance/ledger', scheme);
      await expect(page.locator(`${M} [data-maint-pages]`)).toBeVisible();
      await expect(page.locator(`${M} h1`)).toHaveText('פנקס אישורים ובדיקות');
      await expect(page.locator(`${M} [data-maint-kpi="all"] b`)).toHaveText('6');
      await expect(page.locator(`${M} [data-maint-kpi="alarm"] b`)).toHaveText('1');
      await expect(page.locator(`${M} [data-maint-kpi="unk"] b`)).toHaveText('1');
      if (phone()) {
        await expect(page.locator(`${M} [data-maint-cards] [data-maint-card]`)).toHaveCount(6);
        await expect(page.locator(`${M} [data-maint-place-select]`)).toBeVisible();
        await expect(page.locator(`${M} [data-maint-table]`)).toBeHidden();
      } else {
        await expect(page.locator(`${M} [data-maint-row]`)).toHaveCount(6);
        await expect(page.locator(`${M} [data-maint-tree]`)).toBeVisible();
        await expect(page.locator(`${M} [data-maint-row="d1"] [data-maint-badge]`)).toHaveText('פג');
        await expect(page.locator(`${M} [data-maint-row="c1"] [data-maint-badge]`)).toHaveText('עוד 30 ימים');
      }
      await expect(page.locator(`${M} [data-maint-new="certificate"]`)).toBeVisible();
      await noOverflow(page);
      await shot(page, `ledger-${scheme}`);
    });
  }

  test('ledger filters: KPI, kind segment, search', async ({ page }) => {
    await installMaintenanceMock(page);
    await open(page, '/tickets/maintenance/ledger');
    const rows = phone() ? `${M} [data-maint-card]` : `${M} [data-maint-row]`;
    await page.locator(`${M} [data-maint-kpi="alarm"]`).click();
    await expect(page.locator(rows)).toHaveCount(1);
    await page.locator(`${M} [data-maint-kpi="alarm"]`).click();
    await page.locator(`${M} [data-maint-segs] [data-seg="vendor"]`).click();
    await expect(page.locator(rows)).toHaveCount(2);
    await page.locator(`${M} [data-maint-search]`).fill('קלין');
    await expect(page.locator(rows)).toHaveCount(1);
    await page.locator(`${M} [data-maint-search]`).fill('אין כזה');
    await expect(page.locator(`${M} [data-maint-nomatch]`)).toBeVisible();
  });

  test('task sheet: the date, the history and the renewal (manager)', async ({ page }) => {
    const mock = await installMaintenanceMock(page);
    await open(page, '/tickets/maintenance/ledger');
    await page.locator(phone() ? `${M} [data-maint-card="c1"]` : `${M} [data-maint-row="c1"]`).click();
    const sheet = page.locator(`${M} maint-task-sheet`);
    await expect(sheet.locator('[data-maint-due] .bigdate')).toHaveText('14.02.2027');
    await expect(sheet.locator('[data-maint-history] li')).toHaveCount(2);
    await expect(sheet.locator('[data-maint-complete]')).toBeVisible();
    await expect(sheet.locator('[data-maint-edit]')).toBeVisible();
    await shot(page, 'sheet');
    await sheet.locator('[data-maint-valid-until]').fill('2028-02-12');
    await sheet.locator('[data-maint-save-complete]').click();
    await expect(sheet).toHaveCount(0);
    const call = mock.calls.find((c) => c.method === 'POST' && c.path === 'tasks/c1/complete');
    expect(call?.body).toMatchObject({ valid_until: '2028-02-12', revision: 3 });
    await expect(page.locator(`${M} .toast`)).toHaveText('החידוש נשמר');
  });

  test('supplier card: documents and the expired-insurance mark of the request picker', async ({ page }) => {
    await installMaintenanceMock(page);
    await open(page, '/tickets/maintenance/ledger');
    await page.locator(phone() ? `${M} [data-maint-card="d1"]` : `${M} [data-maint-row="d1"]`).click();
    const card = page.locator(`${M} maint-vendor-card`);
    await expect(card.locator('[data-maint-doc="d1"] .badge')).toHaveText('פג');
    await expect(card.locator('[data-maint-picker]')).toContainText('ביטוח פג 10.01');
    await expect(card.locator('[data-maint-expired-note]')).toContainText('לחשמל השרון אין ביטוח בתוקף');
    await shot(page, 'vendor');
    await card.locator('[data-maint-doc-renew="d1"]').click();
    await expect(page.locator(`${M} maint-task-sheet [data-maint-complete]`)).toBeVisible();
  });

  test('new certificate: the form posts only what was filled; lead left to Settings', async ({ page }) => {
    const mock = await installMaintenanceMock(page);
    await open(page, '/tickets/maintenance/ledger');
    await page.locator(`${M} [data-maint-new="certificate"]`).click();
    const form = page.locator(`${M} maint-task-form`);
    await form.locator('[data-maint-save]').click();
    await expect(form.locator('#e-title')).toBeVisible();
    await form.locator('[data-maint-field="title"]').fill('בדיקת לוח חשמל');
    await form.locator('[data-maint-field="due_date"]').fill('2027-06-30');
    await expect(form.locator('#f-lead-h')).toHaveText('ברירת המחדל נקבעת בהגדרות: 30 ימים');
    await form.locator('[data-maint-save]').click();
    await expect(form).toHaveCount(0);
    const call = mock.calls.find((c) => c.method === 'POST' && c.path === 'tasks');
    expect(call?.body).toMatchObject({ kind: 'certificate', title: 'בדיקת לוח חשמל', due_date: '2027-06-30', place: null });
    expect((call?.body as Record<string, unknown>).lead_days).toBeUndefined();
  });

  test('preventive plans: mark done, the request column and chip', async ({ page }) => {
    const mock = await installMaintenanceMock(page);
    await open(page, '/tickets/maintenance/plans');
    await expect(page.locator(`${M} h1`)).toHaveText('תחזוקה מונעת');
    await expect(page.locator(`${M} [data-maint-segs] [data-seg="auto"]`)).toBeVisible();
    if (!phone()) await expect(page.locator(`${M} [data-maint-row="p1"] [data-maint-ticket="t-1042"]`)).toHaveCount(1);
    await shot(page, 'plans');
    await page.locator(`${M} [data-maint-act="markDone"][data-task="p3"]:visible`).first().click();
    await expect(page.locator(`${M} .toast`)).toHaveText('סומן כבוצע');
    expect(mock.calls.some((c) => c.method === 'POST' && c.path === 'tasks/p3/complete')).toBe(true);
  });

  test('tickets module off: no request element anywhere (owner rule 2026-10-20)', async ({ page }) => {
    await installMaintenanceMock(page, { tickets: false });
    await open(page, '/tickets/maintenance/plans');
    await expect(page.locator(`${M} h1`)).toHaveText('תחזוקה מונעת');
    await expect(page.locator(`${M} [data-maint-segs]`)).toHaveCount(0);
    await expect(page.locator(`${M} [data-maint-ticket]`)).toHaveCount(0);
    await expect(page.locator(M)).not.toContainText('בקשת שירות');
    await open(page, '/tickets/maintenance/rounds');
    await page.locator(`${M} [data-maint-act="continue"]:visible`).first().click();
    await page.locator(`${M} maint-round-run [data-maint-number]`).fill('7.5'); // a problem: out of range
    await expect(page.locator(`${M} maint-round-run [data-maint-out]`)).toBeVisible();
    await expect(page.locator(`${M} maint-round-run [data-maint-request]`)).toHaveCount(0);
    await shot(page, 'tickets-off-run');
  });

  test('rounds: continue the open run, one checkpoint per screen, a request from a problem, finish', async ({ page }) => {
    const mock = await installMaintenanceMock(page);
    await open(page, '/tickets/maintenance/rounds');
    await expect(page.locator(`${M} [data-maint-kpi="acc"] b`)).toHaveText('1');
    await shot(page, 'rounds');
    await page.locator(`${M} [data-maint-act="continue"]:visible`).first().click();
    const run = page.locator(`${M} maint-round-run`);
    await expect(run.locator('[data-maint-step]')).toHaveText('2 / 3'); // resumes at the first unmarked checkpoint
    await run.locator('[data-maint-number]').fill('7.5');
    await expect(run.locator('[data-maint-out]')).toContainText('2–6');
    await expect(run.locator('[data-maint-request]')).toBeVisible();
    await shot(page, 'run-number');
    await run.locator('[data-maint-request-open]').click();
    await expect(run.locator('[data-maint-request] a')).toHaveText('נפתחה');
    expect(mock.calls.find((c) => c.path === 'runs/run-1/answers')?.body).toEqual({ answers: { pressure: { value: 7.5 } } });
    await run.locator('[data-maint-next]').click();
    await run.locator('[data-maint-next]').click();
    await expect(run.locator('[data-maint-issues]')).toBeVisible();
    await shot(page, 'run-finish');
    await run.locator('[data-maint-finish]').click();
    await expect(page.locator(`${M} .toast`)).toHaveText('הסבב הסתיים');
    expect(mock.calls.some((c) => c.method === 'POST' && c.path === 'runs/run-1/finish')).toBe(true);
    await noOverflow(page);
  });

  test('tags (manager): stickers with a QR code, the list, revoke', async ({ page }) => {
    const mock = await installMaintenanceMock(page);
    await open(page, '/tickets/maintenance/tags');
    await expect(page.locator(`${M} [data-maint-sticker]`)).toHaveCount(2);
    await expect(page.locator(`${M} [data-maint-sticker="g1"] svg path`)).toHaveCount(1);
    await expect(page.locator(`${M} [data-maint-tag-url]`)).toContainText('https://arx.example.test');
    await noOverflow(page);
    await shot(page, 'tags');
    if (!phone()) {
      await expect(page.locator(`${M} [data-maint-tag="g2"]`)).toContainText('NFC');
      await expect(page.locator(`${M} [data-maint-tag="g2"]`)).toContainText('טרם נסרק');
      await page.locator(`${M} [data-maint-revoke="g2"]`).click();
      await page.locator(`${M} [data-maint-revoke-yes]`).click();
      await expect(page.locator(`${M} [data-maint-sticker]`)).toHaveCount(1);
      expect(mock.calls.some((c) => c.method === 'DELETE' && c.path === 'tags/g2')).toBe(true);
    }
  });

  test('operator: no manage affordance, no tags page; a direct address is "not available"', async ({ page }) => {
    await installMaintenanceMock(page, { role: 'op' });
    await open(page, '/tickets/maintenance/ledger');
    await expect(page.locator(`${M} h1`)).toHaveText('פנקס אישורים ובדיקות');
    await expect(page.locator(`${M} [data-maint-new]`)).toHaveCount(0);
    await expect(page.locator(`${M} [data-maint-act="renew"]`)).toHaveCount(0);
    await expect(page.locator(`${M} [data-maint-pages]`)).not.toContainText('תגי QR/NFC');
    await open(page, '/tickets/maintenance/plans');
    await expect(page.locator(`${M} [data-maint-act="markDone"]:visible`).first()).toBeVisible(); // perform
    await open(page, '/tickets/maintenance/tags');
    await expect(page.locator(`${M} [data-state="forbidden"]`)).toBeVisible();
    await shot(page, 'operator-tags-forbidden');
  });

  test('without maintenance.view: the section is "not available"', async ({ page }) => {
    await installMaintenanceMock(page, { role: 'view' });
    await open(page, '/tickets/maintenance/ledger');
    await expect(page.locator(`${M} [data-state="forbidden"]`)).toBeVisible();
  });

  test('module off: the panel says so, with the way to Settings for a system administrator', async ({ page }) => {
    await installMaintenanceMock(page, { enabled: false });
    await open(page, '/tickets/maintenance/ledger');
    await expect(page.locator(`${M} [data-state="off"]`)).toBeVisible();
    await expect(page.locator(`${M} [data-maint-to-settings]`)).toHaveAttribute('href', '#/system/infra/maintenance');
    await shot(page, 'off');
  });

  test('empty and error states', async ({ page }) => {
    await installMaintenanceMock(page, { empty: true });
    await open(page, '/tickets/maintenance/rounds');
    await expect(page.locator(`${M} maint-list-page [data-state="empty"]`)).toBeVisible();
    await expect(page.locator(`${M} [data-maint-first]`)).toBeVisible();
    await shot(page, 'empty');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installMaintenanceMock(page, { failList: true });
    await open(page, '/tickets/maintenance/ledger');
    await expect(page.locator(`${M} maint-list-page [data-state="error"]`)).toBeVisible();
    await shot(page, 'error');
  });

  test('a scanned sticker opens the round', async ({ page }) => {
    await installMaintenanceMock(page);
    await open(page, '/m/TokRoundPumps000000001');
    await expect(page).toHaveURL(/#\/tickets\/maintenance\/scan\/TokRoundPumps000000001/);
    await expect(page.locator(`${M} [data-maint-scan-task="r1"]`)).toBeVisible();
    await page.locator(`${M} [data-maint-scan-start]`).click();
    await expect(page.locator(`${M} maint-round-run`)).toBeVisible();
    await open(page, '/m/TokUnknownUnknown00000');
    await expect(page.locator(`${M} [data-state="not-found"]`)).toBeVisible();
  });

  test('Settings › תשתיות › תחזוקה ובקרה: the lead per kind and the sticker address', async ({ page }) => {
    await installMaintenanceMock(page);
    const patches: unknown[] = [];
    await page.route('**/api/v1/settings', async (route) => {
      if (route.request().method() === 'PATCH') patches.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: { 'ui.design': 'a', 'tickets.enabled': 'true', 'maintenance.enabled': 'true', 'maintenance.lead_days.certificate': '30',
        'maintenance.lead_days.preventive': '7', 'maintenance.lead_days.round': '0', 'maintenance.lead_days.vendor_document': '30', 'maintenance.tag_base_url': '' }, can_edit: true }) });
    });
    await open(page, '/system/infra/maintenance');
    const s = page.locator('sw-app maint-settings');
    await expect(s.locator('[data-maint-settings]')).toBeVisible();
    await s.locator('[data-maint-lead="certificate"]').fill('60');
    await s.locator('[data-maint-tag-url-setting]').fill('javascript:x');
    await expect(s.locator('[data-maint-settings-save]')).toBeDisabled();
    await s.locator('[data-maint-tag-url-setting]').fill('https://arx.example.test');
    await s.locator('[data-maint-settings-save]').click();
    await expect.poll(() => patches.length).toBe(1);
    expect(patches[0]).toEqual({ 'maintenance.lead_days.certificate': '60', 'maintenance.tag_base_url': 'https://arx.example.test' });
    await shot(page, 'settings');
  });
});
