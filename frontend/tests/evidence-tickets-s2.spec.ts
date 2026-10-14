import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installTicketsMock, url, type TicketsMock, type TicketsMockOptions } from './tickets-mocks';

// CR-038 slice 2 evidence: Settings › the module from the REAL build against the mock layer (fake data) - the department editor (details,
// rules and overrides, the SLA grid, priorities, templates), the installation values on the general tab and the permissions tab (the
// "who may" matrix, holders by person / by permission, a personal grant with a scope and an end date). Desktop 1440 and phone 390, light
// and dark, classic and domus (the five-skin sweep is layout-tickets.spec.ts). Also asserts what the screens send to the server.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-tickets-s2.spec.ts --project=desktop --project=mobile --workers=1
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/tickets-s2');
const S = 'sw-app system-tickets';
const E = `${S} tickets-dept-editor`;

async function go(page: Page, hash: string, o: TicketsMockOptions = {}, scheme: 'light' | 'dark' = 'light', skin = 'classic'): Promise<TicketsMock> {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  const mock = await installTicketsMock(page, { persona: 'admin', ...o });
  await page.goto('about:blank');
  await page.goto(url(hash, skin, scheme));
  return mock;
}

async function shot(page: Page, name: string, scheme: 'light' | 'dark' = 'light', skin = 'classic', full = true): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${name}: horizontal overflow`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: path.join(OUT, `${name}-${test.info().project.name}-${scheme}-${skin}.png`), fullPage: full });
}

const last = (mock: TicketsMock, method: string, re: RegExp) => [...mock.calls].reverse().find((c) => c.method === method && re.test(c.path));

test.describe('tickets settings evidence (slice 2)', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));
  test.beforeEach(async ({ page }, info) => {
    test.setTimeout(240_000);
    test.skip(info.project.name === 'tablet', 'desktop 1440 and phone 390');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  test('departments: the list and the editor - light / dark x classic / domus', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, '/system/tickets?tab=departments', {}, scheme, skin);
        await page.waitForSelector(`${E} [data-sla-grid]`, { state: 'attached' });
        await shot(page, 'departments', scheme, skin);
        if (test.info().project.name === 'desktop') for (const card of ['dept-policy', 'dept-sla', 'dept-priorities', 'dept-templates']) {
          await page.locator(`${E} [data-card="${card}"]`).screenshot({ path: path.join(OUT, `${card}-${test.info().project.name}-${scheme}-${skin}.png`) });
        }
      }
    // the overrides show next to the installation values; the department's sliding window is its own (30)
    await expect(page.locator(`${E} [data-dept-links-own]`)).toHaveJSProperty('checked', true);
    await expect(page.locator(`${E} [data-dept-link="sliding"]`)).toHaveValue('30');
    await expect(page.locator(`${E} [data-dept-hours="from"]`)).toHaveValue('08:00');
    // another department: no overrides, the automatic close is on (3 days)
    await page.locator(`${S} [data-dept-item="dept-cleaning"]`).click();
    await expect(page.locator(`${E} [data-dept-links-own]`)).toHaveJSProperty('checked', false);
    await expect(page.locator(`${E} [data-dept-autoclose-days]`)).toHaveValue('3');
  });

  test('the SLA grid: units, empty = off, only the changed fields are sent; a bad value blocks the save', async ({ page }) => {
    const mock = await go(page, '/system/tickets?tab=departments');
    const isPhone = (page.viewportSize()?.width ?? 1440) < 768;
    const scope = isPhone ? `${E} [data-sla-cards]` : `${E} [data-sla-grid]`;
    await page.waitForSelector(`${scope} [data-sla="urgent:ack_within_min"]`);
    await expect(page.locator(`${scope} [data-sla="normal:stuck_after_min"]`)).toHaveValue('3');
    await expect(page.locator(`${scope} [data-sla-unit="normal:stuck_after_min"]`)).toHaveValue('d');
    await page.locator(`${scope} [data-sla="urgent:ack_within_min"]`).fill('20');
    await page.locator(`${scope} [data-sla="urgent:link_unopened_min"]`).fill('');
    await page.locator(`${scope} [data-sla="high:resolve_within_min"]`).fill('0');
    await expect(page.locator(`${E} [data-sla-save] button`)).toBeEnabled();
    await page.locator(`${E} [data-sla-save]`).click();
    await expect(page.locator(`${E} [data-sla-error]`)).toBeVisible();
    expect(last(mock, 'PUT', /\/sla$/)).toBeUndefined();
    await page.locator(`${scope} [data-sla="high:resolve_within_min"]`).fill('3');
    await page.locator(`${scope} [data-sla-unit="high:resolve_within_min"]`).selectOption('d');
    if (!isPhone) await shot(page, 'sla-edit', 'light', 'classic', false);
    await page.locator(`${E} [data-sla-save]`).click();
    await expect.poll(() => last(mock, 'PUT', /tickets\/admin\/departments\/dept-maintenance\/sla$/)?.body).toEqual({
      rows: [
        { priority_id: 'dept-maintenance-urgent', revision: 1, ack_within_min: 20, link_unopened_min: null },
        { priority_id: 'dept-maintenance-high', revision: 1, resolve_within_min: 4320 },
      ],
    });
  });

  test('department rules: overrides are saved with nulls to clear them', async ({ page }) => {
    const mock = await go(page, '/system/tickets?tab=departments');
    await page.waitForSelector(`${E} [data-dept-hours="from"]`);
    await page.locator(`${E} [data-dept-hours="to"]`).fill('07:00');
    await expect(page.locator(`${E} [data-dept-hours-row] .field-error`)).toBeVisible();
    await page.locator(`${E} [data-dept-hours="to"]`).fill('19:30');
    await page.locator(`${E} [data-dept-hours-save]`).click();
    await expect.poll(() => last(mock, 'PATCH', /departments\/dept-maintenance$/)?.body).toEqual({ send_hours: { from: '08:00', to: '19:30' }, revision: 2 });
    await page.locator(`${E} [data-dept-links-own] button`).click(); // the switch itself (its visible label does not flip it)
    await expect.poll(() => last(mock, 'PATCH', /departments\/dept-maintenance$/)?.body).toEqual({ link_sliding_days: null, link_cap_days: null, link_grace_hours: null, revision: 2 });
    await page.locator(`${E} [data-dept-urgent="false"]`).click();
    await expect.poll(() => last(mock, 'PATCH', /departments\/dept-maintenance$/)?.body).toEqual({ urgent_is_critical: false, revision: 2 });
    await page.locator(`${E} [data-dept-autoclose] button`).click();
    await expect.poll(() => last(mock, 'PATCH', /departments\/dept-maintenance$/)?.body).toEqual({ auto_close_after_days: 3, revision: 2 });
  });

  test('templates and category details', async ({ page }) => {
    const mock = await go(page, '/system/tickets?tab=departments');
    await page.waitForSelector(`${E} [data-tpl="tpl-ac"]`);
    await page.locator(`${E} [data-tpl-new]`).click();
    await page.locator(`${E} [data-tpl-form="new"] [data-tpl-name]`).fill('נזילה');
    await page.locator(`${E} [data-tpl-form="new"] [data-tpl-title]`).fill('נזילה מהתקרה');
    await page.locator(`${E} [data-tpl-form="new"] [data-tpl-priority]`).selectOption('urgent');
    await shot(page, 'template-new', 'light', 'classic', false);
    await page.locator(`${E} [data-tpl="new"] [data-tpl-save]`).click();
    await expect.poll(() => last(mock, 'POST', /departments\/dept-maintenance\/templates$/)?.body).toEqual({ name: 'נזילה', title: 'נזילה מהתקרה', body: '', category_id: null, priority_key: 'urgent' });
    await page.locator(`${E} [data-cat="cat-hvac"]`).click();
    await expect(page.locator(`${E} [data-cat-domains]`)).toHaveValue('climate, fan');
    await page.locator(`${E} [data-cat-domains]`).fill('climate, fan, water_heater');
    await page.locator(`${E} [data-cat-save]`).click();
    await expect.poll(() => last(mock, 'PATCH', /admin\/categories\/cat-hvac$/)?.body).toEqual({ parent_id: null, default_priority_id: null, domains: ['climate', 'fan', 'water_heater'] });
  });

  test('general: link lifetime, send hours, urgent - light / dark x classic / domus', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, '/system/tickets', {}, scheme, skin);
        await page.waitForSelector(`${S} [data-card="links"]`);
        await shot(page, 'general', scheme, skin);
        if (test.info().project.name === 'desktop') for (const card of ['links', 'hours']) {
          await page.locator(`${S} [data-card="${card}"]`).screenshot({ path: path.join(OUT, `general-${card}-${test.info().project.name}-${scheme}-${skin}.png`) });
        }
      }
    const mock = await go(page, '/system/tickets');
    await page.waitForSelector(`${S} [data-inst-link="cap"]`);
    await page.locator(`${S} [data-inst-link="cap"]`).fill('10');
    await expect(page.locator(`${S} [data-card="links"] .field-error`)).toBeVisible();
    await page.locator(`${S} [data-inst-link="cap"]`).fill('120');
    await page.locator(`${S} [data-inst-links-save]`).click();
    await expect.poll(() => last(mock, 'PUT', /tickets\/settings$/)?.body).toEqual({ revision: 1, links: { sliding_days: 14, cap_days: 120, grace_hours: 24 } });
  });

  test('permissions: the matrix, holders by permission, a personal grant with a scope and an end date', async ({ page }) => {
    for (const skin of ['classic', 'domus'])
      for (const scheme of ['light', 'dark'] as const) {
        await go(page, '/system/tickets?tab=permissions', {}, scheme, skin);
        await page.waitForSelector(`${S} [data-card="matrix"]`);
        await shot(page, 'permissions', scheme, skin);
        if (test.info().project.name === 'desktop') for (const card of ['holders', 'grant']) {
          await page.locator(`${S} [data-card="${card}"]`).screenshot({ path: path.join(OUT, `permissions-${card}-${test.info().project.name}-${scheme}-${skin}.png`) });
        }
      }
    const mock = await go(page, '/system/tickets?tab=permissions');
    await page.waitForSelector(`${S} [data-holders-by="perm"]`);
    await page.locator(`${S} [data-holders-by="perm"]`).click();
    await expect(page.locator(`${S} [data-holder-perm="manage"]`)).toContainText('דנה פרץ');
    await page.locator(`${S} [data-grant-user]`).selectOption('u-yossi');
    await page.locator(`${S} [data-grant-until]`).fill('2026-12-31');
    await page.locator(`${S} [data-grant="external"]`).click();
    await expect.poll(() => last(mock, 'POST', /access\/bindings$/)?.body).toMatchObject({
      subject_kind: 'user', subject_id: 'u-yossi', role_id: 'tickets_external', scope_type: 'installation', scope_id: '*',
    });
    expect(String((last(mock, 'POST', /access\/bindings$/)?.body as { expires_at?: string }).expires_at)).toMatch(/^2026-12-31T/);
  });
});
