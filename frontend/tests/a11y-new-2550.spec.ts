import { test, expect, type Page, type Route } from '@playwright/test';
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { appReady, gotoApp } from './helpers/app-ready';
import { installMulti } from './multi-nvr-mock';
import { CHANGE_ID, NOTIFY, installUndo, openSetup } from './nvr-undo-mock';
import { installGeneratorMock, PERMS as GEN_PERMS, url as genUrl } from './generator-mocks';
import { LEGACY_FILE, installLegacyMock } from './legacy-import-mock';
import { mockHonestArea, openBuilding } from './area-honest-count-2540-mocks';
import { mockHonestHome } from './honest-states-2540-mocks';
import { P as ROOMS, localIso, mockRooms, open as openRooms } from './dst-timeline-2540-mocks';

// A11Y-NEW-2550: the accessibility check of the screens and dialogs added or changed in 2.53-2.55, against MOCKED backends (invented
// data; nothing is sent anywhere, no device is touched). For each one:
//   - axe-core (devDependency, pinned 4.14.0; WCAG 2.0-2.2 A/AA + best practice) in the light and the dark scheme - only critical /
//     serious findings inside the element under test count (the shell around it has its own sweep, a11y-sweep-2490);
//   - the keyboard: the focus on open, Escape, and where the focus goes when the dialog closes or the control that had it goes away
//     after an outcome (it must never fall back to the page body);
//   - names and descriptions: the step-up dialog's field is described by the refused action and its expiry; the area row's link names
//     the locks whose state is unknown; the live regions of the remote reconnect screen are not nested.
// The controlled switches report the confirmed state (aria-checked) - evidence-controlled-toggles-2540.spec.ts pins that per family.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/a11y-new-2550.spec.ts --project=desktop --project=mobile --workers=2

const require_ = createRequire(import.meta.url);
const AXE = (() => {
  try {
    return fs.readFileSync(process.env.SW_AXE_PATH || require_.resolve('axe-core/axe.min.js'), 'utf8');
  } catch {
    return '';
  }
})();
const SCHEMES = ['light', 'dark'] as const;
type Scheme = (typeof SCHEMES)[number];

test.beforeEach(({}, info) => {
  test.skip(info.project.name === 'tablet', 'desktop and phone');
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.skip(!AXE, 'axe-core is not installed');
});

/** axe-core over the whole document (open shadow roots included); the critical / serious findings whose target path names one of
 * `within` (a custom element tag, or an attribute / class of the element under test). */
async function axe(page: Page, within: string[]): Promise<string[]> {
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ content: AXE });
  const found = await page.evaluate(async () => {
    type V = { id: string; impact: string | null; nodes: { target: unknown; failureSummary?: string }[] };
    const w = window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: V[] }> } };
    const r = await w.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      resultTypes: ['violations'],
    });
    return r.violations
      .filter((v) => v.impact === 'critical' || v.impact === 'serious')
      .flatMap((v) => v.nodes.map((n) => `${v.id}: ${JSON.stringify(n.target)} ${(n.failureSummary ?? '').split('\n').slice(1, 2).join(' ').trim()}`));
  });
  return found.filter((line) => within.some((w) => line.includes(w)));
}

/** Whether the focus (through the shadow roots) is inside an element matching `sel`. */
async function focusIn(page: Page, sel: string): Promise<boolean> {
  return page.evaluate((sel) => {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    for (let n: Node | null = a; n; n = (n as Element).parentNode ?? ((n as ShadowRoot).host ?? null)) {
      if (n instanceof Element && n.matches(sel)) return true;
    }
    return false;
  }, sel);
}

/** The focus fell back to the page: nothing (or the body) holds it. */
async function focusLost(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return !a || a === document.body || a === document.documentElement || !a.isConnected;
  });
}

/** Focus the first visible button / link of the screen (outside the prompt cards) and mark it `data-a11y-before`. */
async function focusPageControl(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const seen: Element[] = [];
    const walk = (root: ParentNode) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.matches('button:not([disabled]), a[href]') && el.getClientRects().length) seen.push(el);
        if (el.shadowRoot && el.tagName !== 'ARX-PWA-PROMPTS') walk(el.shadowRoot);
      }
    };
    walk(document.querySelector('sw-app') ?? document);
    const el = seen[0] as HTMLElement | undefined;
    if (!el) return false;
    el.setAttribute('data-a11y-before', '');
    el.focus();
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    return a === el;
  });
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const apiErr = (code: string, msg: string, details: Record<string, unknown> = {}) => ({ code, user_message: msg, retryable: false, correlation_id: 'mock', details });

// ------------------------------------------------------------------------------------------- the step-up dialog and the update card

const SU_PERMS = ['video.live', 'map.read', 'entity.state.read', 'access.read', 'devices.read', 'alarm.view', 'events.read', 'system.configure', 'rbac.assign'];

/** A signed-in administrator; step-up ON (it ships OFF); the settings save is refused once with `step_up_required` for `action`;
 * `build` = the version the server names in the /me/ws hello (another one than the bundle's raises the update card). */
async function suSetup(page: Page, opts: { build?: string; action?: string } = {}) {
  const st = { patches: 0 };
  let until: string | null = null;
  const settings: Record<string, unknown> = { 'ui.design': 'a', 'security.second_factor_policy': 'optional', 'remote.policy': 'flag', 'security.step_up': 'on', 'security.step_up_minutes': 5, 'security.step_up_local': 'off' };
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, (ws) => {
    const payload: Record<string, unknown> = { permissions_fingerprint: 'fp', permission_revision: 1, active: true };
    if (opts.build) payload.build = opts.build;
    ws.send(JSON.stringify({ version: 1, type: 'hello', sequence: 1, subscription_id: 'u-admin', occurred_at: '2026-11-26T08:00:00Z', payload }));
  });
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me') return json(route, { user: { id: 'u-admin', username: 'admin', display_name: 'מנהל', source: 'ingress' }, channel: 'local', remote: null, active: true, bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל מערכת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }], permissions_installation: SU_PERMS, permissions_any: SU_PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'settings' && method === 'PATCH') {
      if (!until) return json(route, apiErr('step_up_required', 'לפני נטרול אזעקה, עקיפת חיישן או פתיחת דלת צריך לאשר שוב את הזהות.', { action: opts.action ?? 'door.open', methods: ['totp'], minutes: 5, verify_path: 'auth/step-up/verify' }), 403);
      st.patches += 1;
      Object.assign(settings, req.postDataJSON() as Record<string, unknown>);
      return json(route, { settings, can_edit: true });
    }
    if (p === 'settings') return json(route, { settings, can_edit: true });
    if (p === 'auth/step-up' && method === 'GET') return json(route, { enabled: true, minutes: 5, local_channel: false, applies: true, reason: null, methods: ['totp'], valid_until: until });
    if (p === 'auth/step-up/verify' && method === 'POST') {
      until = '2026-11-26T08:05:00+00:00';
      return json(route, { method: 'totp', minutes: 5, valid_until: until });
    }
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-11-26T08:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });
    if (p === 'auth/sessions') return json(route, { scope: 'all', can_manage: true, channel: 'local', sessions: [] });
    return json(route, apiErr('not_found', 'לא נמצא (בדיקה)'), 404);
  });
  return st;
}

const OWN_BUILD = /^version:\s*"?([^"\s]+)"?/m.exec(fs.readFileSync(new URL('../../smplwise_vms/config.yaml', import.meta.url), 'utf8'))?.[1] ?? '';
const stepUp = (page: Page) => page.locator('sw-step-up-dialog');

for (const scheme of SCHEMES) {
  test(`step-up dialog (${scheme}): the field names the refused action and the expiry; focus in, Escape, focus back; axe`, async ({ page }) => {
    await suSetup(page, { build: OWN_BUILD, action: 'door.open' });
    await gotoApp(page, `/?design=a&scheme=${scheme}#/system/diagnostics?tab=remote`);
    await page.locator('system-diagnostics select[data-set-remote="remote.policy"]').selectOption('any_role');
    const save = page.locator('system-diagnostics [data-save-remote]');
    await save.locator('button').focus();
    await page.keyboard.press('Enter');
    const code = stepUp(page).locator('[data-step-up-code]');
    await expect(code).toBeVisible();
    await expect.poll(() => focusIn(page, '[data-step-up-code]'), { timeout: 5_000 }).toBe(true);
    // a screen reader hears the field and its description: WHICH action waits for the code, and that it is cancelled by itself
    await expect(code).toHaveAccessibleDescription(/פתיחת דלת/);
    await expect(code).toHaveAccessibleDescription(/90/);
    expect(await axe(page, ['sw-step-up-dialog'])).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(stepUp(page)).toHaveCount(0);
    await expect.poll(() => focusIn(page, '[data-save-remote]'), { timeout: 5_000 }).toBe(true);
  });

  test(`update card (${scheme}): axe; "later" by keyboard puts the focus back where it was, never on the page body`, async ({ page }) => {
    await suSetup(page, { build: '9.99.0' });
    await gotoApp(page, `/?design=a&scheme=${scheme}#/system/diagnostics`);
    const card = page.locator('arx-pwa-prompts [data-pwa-update]');
    await expect(card).toBeVisible();
    expect(await axe(page, ['arx-pwa-prompts'])).toEqual([]);
    // the person was on a control of the page, then went to the card (a Tab, a screen reader's jump)
    expect(await focusPageControl(page)).toBe(true);
    await card.locator('[data-pwa-update-later] button').focus();
    await page.keyboard.press('Enter');
    await expect(card).toHaveCount(0);
    expect(await focusLost(page), 'the focus fell back to the page body').toBe(false);
    expect(await focusIn(page, '[data-a11y-before]')).toBe(true);
  });
}

// ------------------------------------------------------------------------------------------------ the generator alert drawer (mute)

const GEN = 'sw-app infra-generator';
for (const scheme of SCHEMES) {
  test(`generator alert drawer (${scheme}): axe; the un-mute question by keyboard; the outcome keeps the focus in the drawer`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const mock = await installGeneratorMock(page, { perms: GEN_PERMS.manage, muteRules: true });
    await page.goto('about:blank');
    await page.goto(genUrl('/infra/generator/alerts/al5', 'classic', scheme));
    const detail = page.locator(`${GEN} [data-detail]`);
    await detail.locator('[data-mute]').waitFor({ timeout: 30_000 });
    expect(await axe(page, ['gen-alerts-page', 'data-detail'])).toEqual([]);
    // mute by keyboard: the result line is said, the focus stays in the drawer
    await detail.locator('[data-mute] button').focus();
    await page.keyboard.press('Enter');
    await expect(detail.locator('[data-mute-info]')).toContainText('הושתקה רק עד');
    await expect(detail.locator('[data-mute-info]')).toHaveAttribute('role', 'status');
    expect(await focusLost(page), 'after the mute').toBe(false);
    expect(await axe(page, ['gen-alerts-page', 'data-detail'])).toEqual([]);
    // the un-mute question: the focus on cancel; Escape cancels and gives the focus back to its button; nothing is sent
    await detail.locator('[data-unmute] button').focus();
    await page.keyboard.press('Enter');
    const dlg = page.locator('sw-confirm-dialog');
    await expect(dlg.locator('[data-confirm-ok]')).toBeVisible();
    await expect.poll(() => focusIn(page, '[data-confirm-cancel]'), { timeout: 5_000 }).toBe(true);
    expect(await axe(page, ['sw-confirm-dialog'])).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect.poll(() => focusIn(page, '[data-unmute]'), { timeout: 5_000 }).toBe(true);
    expect(mock.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    // confirmed: the un-mute button is gone with the mute - the focus goes to the outcome line, not to the page body
    await page.keyboard.press('Enter');
    await expect(dlg.locator('[data-confirm-ok]')).toBeVisible();
    await dlg.locator('[data-confirm-ok]').click();
    await expect(detail.locator('[data-mute-info]')).toContainText('ההשתקה בוטלה');
    await expect(detail.locator('[data-unmute]')).toHaveCount(0);
    await expect.poll(() => focusIn(page, '[data-mute-info]'), { timeout: 5_000 }).toBe(true);
  });
}

// ------------------------------------------------------------------------------------- the NVR card: output pulse, revert anyway

async function installPulse(page: Page, mode: { v: 'ok' | 'unknown' }) {
  const pulses: string[] = [];
  await page.route('**/api/v1/nvr/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'nvr/system') {
      return json(route, { time: { local_time: '2026-10-04T10:00:00', mode: 'NTP', drift_s: 0, ntp: null }, disks: [],
        outputs: [{ id: 1, name: 'צופר חניון', use_type: 'normal', enabled: true, io_type: 'local', pulse_ms: 5000, default_state: 'low', pulse_supported: true }],
        errors: {}, can: { time: false, storage: false, alarm: true, reboot: false, osd: false, connection: true }, writes_enabled: true, recorder_id: url.searchParams.get('recorder_id') ?? 'nvr-1' });
    }
    const m = /^nvr\/outputs\/(\d+)\/pulse$/.exec(p);
    if (m && req.method() === 'POST') {
      pulses.push(m[1]);
      if (mode.v === 'unknown') return json(route, { code: 'http_504', user_message: 'השרת לא ענה בזמן.', retryable: true, correlation_id: '', details: {} }, 504);
      return json(route, { id: 'ch-1', kind: 'alarm_output', permission: 'nvr.alarm_output', target: 'output-1', path: 'x', status: 'applied', error: null, rollback_of: null, note: 'הפעלת יציאה (pulse)', actor_username: 'joni', created_at: '2026-10-04T10:00:00Z', has_before: false, has_after: true }, 201);
    }
    return route.fallback();
  });
  return pulses;
}

for (const scheme of SCHEMES) {
  test(`NVR output pulse (${scheme}): the question opens on cancel, Escape gives the focus back; the outcome is said and keeps the focus`, async ({ page }) => {
    await installMulti(page);
    const mode = { v: 'ok' as 'ok' | 'unknown' };
    const pulses = await installPulse(page, mode);
    await page.goto('about:blank');
    await gotoApp(page, `/?design=a&scheme=${scheme}#/system/setup`);
    const card = page.locator('sw-app system-setup [data-nvr-system]');
    const pulse = card.locator('[data-nvr-pulse="1"]');
    await expect(pulse).toBeVisible({ timeout: 30_000 });
    await pulse.locator('button').focus();
    await page.keyboard.press('Enter');
    const dlg = page.locator('sw-confirm-dialog');
    await expect(dlg.locator('[data-confirm-text]')).toContainText('ממסר פיזי');
    await expect.poll(() => focusIn(page, '[data-confirm-cancel]'), { timeout: 5_000 }).toBe(true);
    expect(await axe(page, ['sw-confirm-dialog'])).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect.poll(() => focusIn(page, '[data-nvr-pulse="1"]'), { timeout: 5_000 }).toBe(true);
    expect(pulses).toEqual([]);
    // confirmed, no answer from the recorder: amber "unknown", an alert; the focus is not lost while the button waited
    mode.v = 'unknown';
    await page.keyboard.press('Enter');
    await dlg.locator('[data-confirm-ok]').click();
    const warn = card.locator('[data-nvr-system-msg="warn"]');
    await expect(warn).toContainText('לא ידוע אם הפעולה בוצעה');
    await expect(warn).toHaveAttribute('role', 'alert');
    expect(await focusLost(page), 'after the pulse').toBe(false);
    expect(await axe(page, ['data-nvr-system'])).toEqual([]);
  });

  test(`NVR revert anyway (${scheme}): cancel gives the focus back to "revert"; after the forced revert the focus is on the outcome`, async ({ page }) => {
    const st = await installUndo(page, { mode: 'changed_since' });
    await openSetup(page, `&scheme=${scheme}`);
    await appReady(page);
    const card = page.locator(NOTIFY);
    const revert = card.locator(`[data-nvr-rollback="${CHANGE_ID}"]`);
    await expect(revert).toBeVisible({ timeout: 30_000 });
    await revert.locator('button').focus();
    await page.keyboard.press('Enter');
    const dlg = page.locator('sw-confirm-dialog');
    await expect(dlg.locator('[data-confirm-ok]')).toContainText('החזר בכל זאת');
    await expect.poll(() => focusIn(page, '[data-confirm-cancel]'), { timeout: 5_000 }).toBe(true);
    expect(await axe(page, ['sw-confirm-dialog'])).toEqual([]);
    expect(await axe(page, ['data-nvr-notify'])).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dlg).toHaveCount(0);
    await expect.poll(() => focusIn(page, `[data-nvr-rollback="${CHANGE_ID}"]`), { timeout: 5_000 }).toBe(true);
    await page.keyboard.press('Enter');
    await expect(dlg.locator('[data-confirm-ok]')).toBeVisible();
    await dlg.locator('[data-confirm-ok]').click();
    await expect(card.locator('[data-nvr-result="ok"]')).toContainText('בכל זאת');
    expect(st.bodies).toEqual([null, null, { force: true }]);
    await expect(revert).toHaveCount(0);
    await expect.poll(() => focusIn(page, '[data-nvr-result]'), { timeout: 5_000 }).toBe(true);
  });
}

// --------------------------------------------------------------------------------------------------------------- the legacy import

const LEGACY = 'sw-legacy-import';
async function legacyOpen(page: Page, scheme: Scheme) {
  await gotoApp(page, `/?design=a&scheme=${scheme}#/system/diagnostics?tab=backup`);
  await expect(page.locator(`${LEGACY} [data-legacy-pick]`)).toBeVisible({ timeout: 30_000 });
  const chooser = page.waitForEvent('filechooser');
  await page.locator(`${LEGACY} [data-legacy-choose]`).click();
  await (await chooser).setFiles(LEGACY_FILE);
  await expect(page.locator(`${LEGACY} [data-legacy-summary]`)).toBeVisible();
  return page.locator(LEGACY);
}

for (const scheme of SCHEMES) {
  test(`legacy import (${scheme}): axe on the report and the dialog; focus in, Escape, back; the outcome takes the focus`, async ({ page }) => {
    await installLegacyMock(page);
    const card = await legacyOpen(page, scheme);
    expect(await axe(page, [LEGACY])).toEqual([]);
    await card.locator('[data-legacy-apply-open] button').focus();
    await page.keyboard.press('Enter');
    const dialog = card.locator('sw-dialog[data-legacy-dialog]');
    await expect(dialog.locator('[data-legacy-confirm]')).toBeVisible();
    await expect.poll(() => focusIn(page, '[data-legacy-confirm]'), { timeout: 5_000 }).toBe(true);
    expect(await axe(page, [LEGACY])).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => focusIn(page, '[data-legacy-apply-open]'), { timeout: 5_000 }).toBe(true);
    // the import: the dialog and its button go away - the result (a status line) takes the focus
    await page.keyboard.press('Enter');
    await dialog.locator('[data-legacy-confirm]').fill('ייבוא מהמערכת הישנה');
    await page.keyboard.press('Enter');
    const result = card.locator('[data-legacy-result]');
    await expect(result).toContainText('הועתקו 2 כינויים');
    await expect(result).toHaveAttribute('role', 'status');
    await expect.poll(() => focusIn(page, '[data-legacy-result]'), { timeout: 5_000 }).toBe(true);
    expect(await axe(page, [LEGACY])).toEqual([]);
  });
}

test('legacy import: 409 "changed since the dry run" - the refusal (an alert) takes the focus; the apply button is disabled', async ({ page }) => {
  const m = await installLegacyMock(page);
  m.apply = 'changed';
  const card = await legacyOpen(page, 'light');
  await card.locator('[data-legacy-apply-open] button').focus();
  await page.keyboard.press('Enter');
  await card.locator('[data-legacy-confirm]').fill('ייבוא מהמערכת הישנה');
  await page.keyboard.press('Enter');
  const errLine = card.locator('[data-legacy-error]');
  await expect(errLine).toBeVisible();
  await expect(errLine).toHaveAttribute('role', 'alert');
  await expect.poll(() => focusIn(page, '[data-legacy-error]'), { timeout: 5_000 }).toBe(true);
});

test('legacy import, English (LTR): axe on the report and the dialog', async ({ page }) => {
  await installLegacyMock(page, { lang: 'en' });
  const card = await legacyOpen(page, 'light');
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('ltr');
  await card.locator('[data-legacy-apply-open]').click();
  await expect(card.locator('[data-legacy-confirm]')).toBeVisible();
  expect(await axe(page, [LEGACY])).toEqual([]);
});

// ----------------------------------------------------------------------------------------- unknown states: the area row, the home

for (const scheme of SCHEMES) {
  test(`area row (${scheme}): the row's link names the locks whose state is unknown; axe on the rows`, async ({ page }) => {
    await mockHonestArea(page, { scheme });
    await openBuilding(page, scheme);
    const entry = page.locator('devices-building a.arow[data-area-row="ahc_entry"]');
    await expect(entry.locator('[data-ind="locks"][data-ind-unknown]')).toHaveText('1 לא ידוע');
    // the visible "1 unknown" is in the name a screen reader reads for the row (the link has its own aria-label)
    await expect(entry).toHaveAccessibleName(/לא ידוע: 1 מתוך 2/);
    await expect(page.locator('devices-building a.arow[data-area-row="ahc_back"]')).toHaveAccessibleName(/לא ידוע/);
    expect(await axe(page, ['.arow', 'data-area-row', 'data-ind'])).toEqual([]);
  });

  test(`home doors (${scheme}): an offline / unknown lock and an unavailable panel - axe on the doors screen and the status chips`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto('about:blank');
    await mockHonestHome(page, 'offline');
    await page.goto(`/?scheme=${scheme}#/home/doors`);
    const home = page.locator('sw-home');
    await home.locator('.hs.v2').waitFor();
    await expect(home.locator('[data-door-known="no"]').first()).toBeVisible();
    expect(await axe(page, ['.dst', '.di', 'data-door', '.st-pill'])).toEqual([]);
  });
}

// ------------------------------------------------------------------------------------------------------ the rooms timeline (DST)

for (const scheme of SCHEMES) {
  test(`rooms timeline on the autumn DST day (${scheme}): axe on the axis and the entries`, async ({ page }) => {
    await mockRooms(page, { manage: true, entries: (date) => [
      { id: 'p1', start: localIso(date, 1), end: localIso(date, 1, 30) },
      { id: 'p2', start: localIso(date, 1, 0, 60), end: localIso(date, 1, 30, 60) },
    ] });
    await openRooms(page, '/calendars/rooms?date=2026-10-25', '2026-10-20T00:30:00+03:00', scheme);
    await expect(page.locator(`${ROOMS} [data-cal-entry="p2"]`)).toBeVisible();
    expect(await axe(page, ['cal-view-rooms'])).toEqual([]);
  });
}

// ------------------------------------------------------------------------------- the remote start-up without a connection (arx)

const HERE = path.dirname(fileURLToPath(import.meta.url));
let reconnectBundle = '';
async function reconnectPage(page: Page, scheme: Scheme) {
  if (!reconnectBundle) {
    const out = await build({
      stdin: { contents: "import '../design/boot';\nimport './arx-reconnect';", resolveDir: path.join(HERE, '../src/arx'), loader: 'ts' },
      bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', tsconfig: path.join(HERE, '../tsconfig.json'),
      define: { 'import.meta.env.BASE_URL': '"/arx/"', 'import.meta.env.DEV': 'false', __ARX_BUILD__: '"test"' },
    });
    reconnectBundle = out.outputFiles[0].text;
  }
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.route('http://arx.test/**', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="he" dir="rtl"><head><title>Arx</title></head><body></body></html>' }));
  await page.goto('http://arx.test/arx/');
  await page.addScriptTag({ content: reconnectBundle, type: 'module' });
  await page.evaluate(() => document.body.appendChild(document.createElement('arx-reconnect')));
  await expect(page.locator('arx-reconnect [data-arx-reconnect]')).toBeVisible();
}

for (const scheme of SCHEMES) {
  test(`remote reconnect screen (${scheme}): one live region (not nested), the retry key reachable by Tab; axe`, async ({ page }) => {
    await reconnectPage(page, scheme);
    const regions = await page.evaluate(() => {
      const out: string[] = [];
      const walk = (root: ParentNode) => {
        for (const el of root.querySelectorAll('*')) {
          const role = el.getAttribute('role');
          if (role === 'status' || role === 'alert' || el.hasAttribute('aria-live')) out.push(el.tagName.toLowerCase());
          if (el.shadowRoot) walk(el.shadowRoot);
        }
      };
      walk(document);
      return out;
    });
    expect(regions, 'live regions on the screen').toHaveLength(1);
    await page.keyboard.press('Tab');
    expect(await focusIn(page, 'sw-button')).toBe(true);
    expect(await axe(page, ['arx-reconnect'])).toEqual([]);
  });
}
