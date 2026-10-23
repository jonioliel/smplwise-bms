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

  // ================================================================ MAINT215B (owner review 24.10)

  /** A control screen never scrolls as a page: neither the document nor the shell's main area has anything to scroll. */
  const noPageScroll = async (page: Page) => {
    const over = await page.evaluate(() => {
      const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
      return { doc: document.documentElement.scrollHeight - document.documentElement.clientHeight, main: main ? main.scrollHeight - main.clientHeight : 0 };
    });
    expect(over.doc).toBeLessThanOrEqual(1);
    expect(over.main).toBeLessThanOrEqual(1);
  };

  test('no page scrolling: the list, the log and the tags scroll inside their own panel', async ({ page }) => {
    await installMaintenanceMock(page);
    for (const pg of ['ledger', 'plans', 'rounds', 'log', 'tags']) {
      await open(page, `/tickets/maintenance/${pg}`);
      await expect(page.locator(`${M} [data-maint-page="${pg}"]`)).toBeVisible();
      await expect(page.locator(`${M} h1`)).toBeVisible();
      await noPageScroll(page);
    }
  });

  test('reminder log: lines by type, the filter, the "reminders are off" note', async ({ page }) => {
    await installMaintenanceMock(page);
    await open(page, '/tickets/maintenance/log');
    await expect(page.locator(`${M} h1`)).toHaveText('יומן תזכורות');
    await expect(page.locator(`${M} [data-maint-log-off]`)).toBeVisible(); // reminders are off by default
    await expect(page.locator(`${M} [data-maint-log-off] [data-maint-to-settings]`)).toHaveAttribute('href', '#/system/infra/maintenance');
    const rows = phone() ? `${M} [data-maint-log-card]` : `${M} [data-maint-log-row]`;
    await expect(page.locator(rows)).toHaveCount(4);
    if (!phone()) {
      await expect(page.locator(`${M} [data-maint-log-row="l2"] a.chip`)).toHaveAttribute('href', '#/tickets/t-1042');
      await expect(page.locator(`${M} [data-maint-log-row="l4"]`)).toContainText('בקשת שירות לא נפתחה');
    }
    await page.locator(`${M} [data-maint-log-filter] [data-ev="overdue"]`).click();
    await expect(page.locator(rows)).toHaveCount(1);
    await noOverflow(page);
    await noPageScroll(page);
    await shot(page, 'log');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installMaintenanceMock(page, { remindersOn: true, emptyLog: true });
    await open(page, '/tickets/maintenance/log');
    await expect(page.locator(`${M} [data-maint-log-off]`)).toHaveCount(0);
    await expect(page.locator(`${M} [data-state="empty"]`)).toBeVisible();
  });

  test('certificate file: listed, downloaded, attached by a manager, removed after a question, the limit is the servers', async ({ page }) => {
    const mock = await installMaintenanceMock(page);
    await open(page, '/tickets/maintenance/ledger');
    await page.locator(phone() ? `${M} [data-maint-card="c1"]` : `${M} [data-maint-row="c1"]`).click();
    const files = page.locator(`${M} maint-task-sheet [data-maint-files]`);
    await expect(files.locator('[data-maint-file="f1"]')).toContainText('תסקיר-מעלית-2026.pdf');
    await shot(page, 'files');
    const dl = page.waitForEvent('download');
    await files.locator('[data-maint-file-download]').click();
    expect((await dl).suggestedFilename()).toBe('תסקיר-מעלית-2026.pdf'); // the name the server gave the file
    const pdf = { name: 'scan.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') };
    await files.locator('[data-maint-file-input]').setInputFiles(pdf);
    await expect(files.locator('[data-maint-file]')).toHaveCount(2);
    expect(mock.calls.some((c) => c.method === 'POST' && c.path === 'tasks/c1/files')).toBe(true);
    await files.locator('[data-maint-file-input]').setInputFiles(pdf);
    await expect(files.locator('[data-maint-file]')).toHaveCount(3);
    await files.locator('[data-maint-file-input]').setInputFiles(pdf);
    await expect(files.locator('[data-maint-file-error]')).toContainText('מספר הקבצים המרבי');
    await files.locator('[data-maint-file-remove]').first().click();
    await expect(files.locator('[data-maint-file-confirm]')).toBeVisible();
    await files.locator('[data-maint-file-remove-yes]').click();
    await expect(files.locator('[data-maint-file]')).toHaveCount(2);
    expect(mock.calls.some((c) => c.method === 'DELETE' && c.path === 'tasks/c1/files/f1')).toBe(true);
  });

  test('certificate file: an operator sees and downloads it but cannot attach or remove', async ({ page }) => {
    await installMaintenanceMock(page, { role: 'op' });
    await open(page, '/tickets/maintenance/ledger');
    await page.locator(phone() ? `${M} [data-maint-card="c1"]` : `${M} [data-maint-row="c1"]`).click();
    const files = page.locator(`${M} maint-task-sheet [data-maint-files]`);
    await expect(files.locator('[data-maint-file-download]')).toBeVisible();
    await expect(files.locator('[data-maint-file-input]')).toHaveCount(0);
    await expect(files.locator('[data-maint-file-remove]')).toHaveCount(0);
  });

  test('phone round: one list, the quick switch on the screen, remembered in this browser', async ({ page }) => {
    const mock = await installMaintenanceMock(page);
    await open(page, '/tickets/maintenance/rounds');
    await page.locator(`${M} [data-maint-act="continue"]:visible`).first().click();
    const run = page.locator(`${M} maint-round-run`);
    await expect(run.locator('[data-maint-step]')).toBeVisible();
    await run.locator('[data-maint-view-switch] [data-view="list"]').click();
    await expect(run.locator('[data-maint-list] [data-maint-point]')).toHaveCount(3);
    await expect(run.locator('[data-maint-step]')).toHaveCount(0);
    await expect(run.locator('[data-maint-list-progress]')).toContainText('1 מתוך 3');
    await run.locator('[data-maint-point="pressure"] [data-maint-number]').fill('4');
    await expect(run.locator('[data-maint-list-progress]')).toContainText('2 מתוך 3');
    await noPageScroll(page);
    await shot(page, 'run-list');
    await run.locator('[data-maint-finish]').click();
    await expect(page.locator(`${M} .toast`)).toHaveText('הסבב הסתיים');
    expect(mock.calls.find((c) => c.path === 'runs/run-1/answers')?.body).toEqual({ answers: { pressure: { value: 4 } } });
    // the choice is remembered in this browser: the next round opens as a list
    await open(page, '/tickets/maintenance/rounds');
    await page.locator(`${M} [data-maint-act="continue"]:visible`).first().click();
    await expect(page.locator(`${M} maint-round-run [data-maint-list]`)).toBeVisible();
    await page.locator(`${M} maint-round-run [data-maint-view-switch] [data-view="step"]`).click();
    await expect(page.locator(`${M} maint-round-run [data-maint-step]`)).toBeVisible();
  });

  test('phone round: the installation default (Settings) is the list until the person chooses', async ({ page }) => {
    await installMaintenanceMock(page, { roundView: 'list' });
    await open(page, '/tickets/maintenance/rounds');
    await page.evaluate(() => localStorage.removeItem('sw.maintenance.round_view'));
    await page.locator(`${M} [data-maint-act="continue"]:visible`).first().click();
    await expect(page.locator(`${M} maint-round-run [data-maint-list]`)).toBeVisible();
  });

  test('closing the request of a plan asks the closer: no leaves the plan, yes marks it done', async ({ page }) => {
    const mock = await installMaintenanceMock(page);
    await open(page, '/tickets/maintenance/plans');
    await expect(page.locator(`${M} [data-maint-page="plans"]`)).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('sw:ticket-closed', { detail: { id: 't-1042' } })));
    const dlg = page.locator('sw-app maint-close-prompt [data-maint-close-prompt]');
    await expect(dlg.locator('[data-maint-close-yes]')).toBeVisible(); // the dialog element itself has no box (its content is fixed)
    await expect(dlg).toContainText('ניקוי מנדף המטבח');
    await dlg.locator('[data-maint-close-no]').click();
    await expect(dlg).toHaveCount(0);
    expect(mock.calls.some((c) => c.path === 'close-proposal/t-1042/confirm')).toBe(false);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('sw:ticket-closed', { detail: { id: 't-1042' } })));
    await expect(dlg.locator('[data-maint-close-yes]')).toBeVisible();
    await shot(page, 'close-question');
    await dlg.locator('[data-maint-close-yes]').click();
    await expect(page.locator('sw-app maint-close-prompt .toast')).toHaveText('התוכנית סומנה כבוצעה');
    expect(mock.calls.some((c) => c.method === 'POST' && c.path === 'close-proposal/t-1042/confirm')).toBe(true);
  });

  test('closing a request that belongs to no plan shows nothing', async ({ page }) => {
    await installMaintenanceMock(page, { closeAsks: false });
    await open(page, '/tickets/maintenance/plans');
    await expect(page.locator(`${M} [data-maint-page="plans"]`)).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('sw:ticket-closed', { detail: { id: 't-9' } })));
    await page.waitForTimeout(300);
    await expect(page.locator('sw-app maint-close-prompt [data-maint-close-prompt]')).toHaveCount(0);
  });

  test('task form: attach to an elevator or a generator', async ({ page }) => {
    const mock = await installMaintenanceMock(page);
    await open(page, '/tickets/maintenance/ledger');
    await page.locator(`${M} [data-maint-new="certificate"]`).click();
    const form = page.locator(`${M} maint-task-form`);
    await form.locator('[data-maint-field="title"]').fill('תסקיר מעלית');
    await form.locator('[data-maint-field="due_date"]').fill('2027-06-30');
    await form.locator('[data-maint-field="asset"]').selectOption('elevator:e1');
    await form.locator('[data-maint-save]').click();
    await expect(form).toHaveCount(0);
    expect(mock.calls.find((c) => c.method === 'POST' && c.path === 'tasks')?.body).toMatchObject({ elevator_id: 'e1', title: 'תסקיר מעלית' });
  });

  test('Settings: reminders switch, round default, close mode, thresholds - all editable', async ({ page }) => {
    await installMaintenanceMock(page);
    const patches: Record<string, string>[] = [];
    await page.route('**/api/v1/settings', async (route) => {
      if (route.request().method() === 'PATCH') patches.push(route.request().postDataJSON());
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ settings: { 'ui.design': 'a', 'tickets.enabled': 'true', 'maintenance.enabled': 'true' }, can_edit: true }) });
    });
    await open(page, '/system/infra/maintenance');
    const s = page.locator('sw-app maint-settings');
    await expect(s.locator('[data-maint-behaviour]')).toBeVisible();
    await expect(s.locator('[data-maint-tag-effective]')).toContainText('https://arx.example.test'); // the sticker address = the remote address
    await s.locator('[data-maint-reminders]').click();
    await expect.poll(() => patches.length).toBe(1);
    expect(patches[0]).toEqual({ 'maintenance.reminders_enabled': 'true' });
    await s.locator('[data-maint-setting="maintenance.reminder_check_minutes"]').fill('0');
    await expect(s.locator('[data-maint-behaviour-save]')).toBeDisabled();
    await s.locator('[data-maint-setting="maintenance.reminder_check_minutes"]').fill('5');
    await s.locator('[data-maint-setting="maintenance.round_phone_view"]').selectOption('list');
    await s.locator('[data-maint-setting="maintenance.close_request_mode"]').selectOption('auto');
    await s.locator('[data-maint-setting="maintenance.vendor_insurance_warn_days"]').fill('14');
    await s.locator('[data-maint-behaviour-save]').click();
    await expect.poll(() => patches.length).toBe(2);
    expect(patches[1]).toEqual({ 'maintenance.reminder_check_minutes': '5', 'maintenance.round_phone_view': 'list', 'maintenance.close_request_mode': 'auto', 'maintenance.vendor_insurance_warn_days': '14' });
    await shot(page, 'settings-behaviour');
  });

  test('the elevator card and the generator page carry the "certificates and inspections" row', async ({ page }) => {
    await installMaintenanceMock(page, { extraPerms: ['devices.read', 'infra.elevators.manage'] });
    const NOW = '2027-01-15T09:00:00Z';
    const live = { state: 'waiting', reason: 'waiting', partial: false, stale: false, since: NOW, roles: ['fault', 'waiting'], extras: [], flags: { fault: false, fire_service: false, out_of_service: false, waiting: true },
      history: [{ state: 'waiting', from: '2027-01-14T09:00:00Z', to: NOW }] };
    await page.route('**/api/v1/infra/elevators**', (route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ elevators: [{ id: 'e1', name: 'מעלית צפונית', area_id: null, area_name: 'לובי', ...live }, { id: 'e2', name: 'מעלית דרומית', area_id: null, area_name: 'לובי', ...live }], summary: {}, stale: false, at: NOW }) }));
    await open(page, '/infra/elevators');
    await expect(page.locator('sw-app infra-elevators [data-elevator]')).toHaveCount(2);
    const row = page.locator('sw-app infra-elevators [data-elevator="e1"] maint-cert-row [data-maint-cert-row="elevator"]');
    await expect(row.locator('[data-maint-cert-text]')).toHaveText('עוד 30 ימים · 14.02.2027');
    await expect(row.locator('[data-maint-cert-link]')).toHaveAttribute('href', '#/tickets/maintenance/ledger?task=c1');
    await expect(page.locator('sw-app infra-elevators [data-elevator="e2"] [data-maint-cert-none]')).toBeVisible(); // no certificate recorded for this one
    await shot(page, 'elevator-cert-row');
    await noOverflow(page);
  });

  test('without the maintenance module the elevator card has no certificates row', async ({ page }) => {
    await installMaintenanceMock(page, { enabled: false, extraPerms: ['devices.read', 'infra.elevators.manage'] });
    const NOW = '2027-01-15T09:00:00Z';
    await page.route('**/api/v1/infra/elevators**', (route) => route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ elevators: [{ id: 'e1', name: 'מעלית צפונית', area_id: null, area_name: null, state: 'waiting', reason: 'waiting', partial: false, stale: false, since: NOW, roles: ['waiting'], extras: [], flags: { waiting: true }, history: [] }], summary: {}, stale: false, at: NOW }) }));
    await open(page, '/infra/elevators');
    await expect(page.locator('sw-app infra-elevators [data-elevator="e1"]')).toBeVisible();
    await expect(page.locator('sw-app infra-elevators maint-cert-row [data-maint-cert-row]')).toHaveCount(0);
  });
});
