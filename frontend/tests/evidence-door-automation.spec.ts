import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-AUTODOORS-295: the "open a door" block of the automation editor, mounted the way the builder mounts it (`<door-automation-block
// .automationId>`), against a MOCKED backend (page.route on api/v1/door-automations - the shapes of routers/door_automations.py). What is
// checked is what the block shows and what it sends: nothing without the permission, a draft first, "confirmed: true" only from the
// confirmation, an edit of an active block turning it off on the server, the test result, the error state. Screenshots:
// docs/design/evidence/AUTODOORS-295/ at 1440 and 390, Hebrew (RTL) and English (LTR).
//   SW_BASE_URL=http://127.0.0.1:5297/ npx playwright test tests/evidence-door-automation.spec.ts --project=desktop --workers=1

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/AUTODOORS-295');
const SIZES = { '1440': { width: 1440, height: 900 }, '390': { width: 390, height: 844 } } as const;
type Size = keyof typeof SIZES;

interface Call { method: string; path: string; body: unknown }
interface St { visible: boolean; available: boolean; killed: boolean; block: Record<string, unknown> | null; calls: Call[]; failStatus: boolean; rev: number }

const DOORS = [
  { station_id: 'st-entry', relay: 1, name: 'כניסה ראשית', online: true, can_arm: true },
  { station_id: 'st-dock', relay: 2, name: 'רציף · שער', online: true, can_arm: true },
  { station_id: 'st-roof', relay: 1, name: 'יציאה לגג', online: false, can_arm: false },
];

const fresh = (o: Partial<St> = {}): St => ({ visible: true, available: false, killed: false, block: null, calls: [], failStatus: false, rev: 0, ...o });

function view(st: St) {
  const b = st.block!;
  const policy = b.policy as { doors: { station_id: string; relay: number }[] };
  return { ...b, doors: policy.doors.map((d) => ({ ...d, name: DOORS.find((x) => x.station_id === d.station_id && x.relay === d.relay)?.name ?? null })) };
}

async function install(page: Page, st: St) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body = req.postData() ? (req.postDataJSON() as Record<string, unknown>) : null;
    const json = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    if (!p.startsWith('door-automations')) return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
    st.calls.push({ method, path: p + url.search, body });
    const now = '2026-10-20T10:00:00Z';
    if (p === 'door-automations/status') {
      if (st.failStatus) return json({ code: 'ha_unavailable', user_message: 'x', retryable: true, correlation_id: '', details: {} }, 503);
      return json(st.visible ? { visible: true, feature: st.available ? 'on' : 'off', go_live_permitted: st.available, available: st.available, killed: st.killed, can_manage: true, can_lift_kill: true, can_configure: true, limits: { cooldown_s: 10, max_per_hour: 30, max_per_day: 300, arm_days: 180, storm_refusals: 5, storm_window_s: 600 } } : { visible: false });
    }
    if (p === 'door-automations/doors') return json({ doors: DOORS });
    if (p === 'door-automations' && method === 'GET') return json({ items: st.block ? [view(st)] : [] });
    if (p === 'door-automations' && method === 'POST') {
      st.block = { id: 'da_' + '0'.repeat(31) + '1', automation_id: body!.automation_id, automation_name: 'פתיחת שער בבוקר', name: body!.name, state: 'draft', policy: body!.policy,
        policy_revision: 1, bound_item_revision: null, armed_by: null, armed_by_name: null, armed_at: null, armed_until: null, disarm_reason: null, disarmed_at: null, created_at: now, updated_at: now };
      return json(view(st), 201);
    }
    const seg = p.split('/');
    if (seg.length === 2 && method === 'PUT') {
      const b = st.block!;
      Object.assign(b, { name: body!.name, policy: body!.policy, policy_revision: (b.policy_revision as number) + 1 });
      if (b.state === 'armed') Object.assign(b, { state: 'disarmed', disarm_reason: 'edited', disarmed_at: now });
      return json(view(st));
    }
    if (seg.length === 2 && method === 'DELETE') { st.block = null; return json({ deleted: true }); }
    if (seg[2] === 'arm') {
      if (body?.confirmed !== true) return json({ code: 'confirmation_required', user_message: 'נדרש אישור', retryable: false, correlation_id: '', details: {} }, 409);
      Object.assign(st.block!, { state: 'armed', armed_by: 'u1', armed_by_name: 'יוני', armed_at: now, armed_until: '2026-11-19T10:00:00Z', disarm_reason: null });
      return json(view(st));
    }
    if (seg[2] === 'disarm') { Object.assign(st.block!, { state: 'disarmed', disarm_reason: 'manual', disarmed_at: now }); return json(view(st)); }
    if (seg[2] === 'simulate') {
      return json({ at: now, would_send: false, gates: [
        { gate: 'armed', ok: st.block!.state === 'armed', reason: st.block!.state === 'armed' ? null : 'not_armed' },
        { gate: 'feature', ok: st.available, reason: st.available ? null : 'feature_off' },
        { gate: 'kill', ok: true, reason: null }, { gate: 'expiry', ok: true, reason: null }, { gate: 'trigger', ok: true, reason: null },
        { gate: 'revision', ok: true, reason: null }, { gate: 'window', ok: false, reason: 'outside_window' }],
        doors: [{ door: 'כניסה ראשית', decision: 'would_open', reason: null }] });
    }
    if (seg[2] === 'fires') return json({ fires: [] });
    return json({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} }, 404);
  });
}

async function mount(page: Page, st: St, size: Size = '1440', lang: 'he' | 'en' = 'he') {
  await page.setViewportSize(SIZES[size]);
  await install(page, st);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('about:blank');
  await page.goto('/?design=a#/system/styleguide');
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
  await page.evaluate(async ({ lang }) => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    await import('/src/screens/door-automation-block.ts' as string);
    // the HTTP adapter explicitly (the page's session may be in demo mode: the mocked backend answers door-automations only)
    const api = (await import('/src/api/door-automations.ts' as string)) as { httpDoorAutomations: unknown };
    await customElements.whenDefined('door-automation-block');
    document.body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'max-width:760px;margin:24px auto;padding:0 16px;';
    const el = document.createElement('door-automation-block') as unknown as HTMLElement & { automationId: string; adapter: unknown };
    el.adapter = api.httpDoorAutomations;
    el.automationId = '9001';
    wrap.append(el);
    document.body.append(wrap);
  }, { lang });
  return { errors, el: page.locator('door-automation-block') };
}

async function shot(page: Page, name: string) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
}

test('without the permission the block renders nothing, and a failing status read renders nothing either', async ({ page }) => {
  const st = fresh({ visible: false });
  const { el, errors } = await mount(page, st);
  await expect.poll(() => st.calls.length).toBeGreaterThan(0);
  await expect(el.locator('[data-door-automation]')).toHaveCount(0);
  const st2 = fresh({ failStatus: true });
  await mount(page, st2);
  await expect.poll(() => st2.calls.length).toBeGreaterThan(0);
  await expect(page.locator('door-automation-block [data-door-automation]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

for (const size of ['1440', '390'] as Size[]) {
  test(`draft, confirmation, active, test and edit-turns-off (${size}, Hebrew)`, async ({ page }) => {
    const st = fresh();
    const { el, errors } = await mount(page, st, size);
    await expect(el.locator('[data-add]')).toBeVisible();
    await expect(el.locator('[data-state]')).toHaveText('טיוטה · לא פעיל');
    await shot(page, `${size}-he-1-empty`);
    await el.locator('[data-add]').click();
    await el.locator('[data-name]').fill('שער בוקר');
    await el.locator('[data-save]').click();
    await expect(el.locator('.err')).toContainText('יש לבחור לפחות דלת אחת');
    await el.locator('[data-door="st-entry#1"]').check();
    await shot(page, `${size}-he-2-form`);
    await el.locator('[data-save]').click();
    await expect(el.locator('[data-arm]')).toBeEnabled();
    const created = st.calls.find((c) => c.method === 'POST' && c.path === 'door-automations');
    expect(created?.body).toMatchObject({ automation_id: '9001', name: 'שער בוקר', policy: { doors: [{ station_id: 'st-entry', relay: 1 }], windows: [] } });
    expect(Object.keys((created?.body as { policy: object }).policy).sort()).toEqual(['doors', 'windows']);
    await shot(page, `${size}-he-3-draft`);
    await el.locator('[data-arm]').click();
    await expect(el.locator('[data-confirm="arm"]')).toBeVisible();
    expect(st.calls.some((c) => c.path.endsWith('/arm')), 'nothing is armed before the confirmation').toBe(false);
    await shot(page, `${size}-he-4-confirm`);
    await el.locator('[data-confirm-yes]').click();
    await expect(el.locator('[data-disarm]')).toBeVisible();
    const arm = st.calls.find((c) => c.path.endsWith('/arm'));
    expect(arm?.body).toEqual({ confirmed: true, policy_revision: 1 });
    await expect(el.locator('[data-state]')).toHaveText('כבוי בגרסה הזו'); // armed, but the feature is off in this version
    await el.locator('[data-simulate]').click();
    await expect(el.locator('[data-sim]')).toContainText('לא הייתה נשלחת פתיחה');
    await expect(el.locator('[data-sim]')).toContainText('שום דבר לא נשלח');
    await shot(page, `${size}-he-5-armed-test`);
    await el.locator('[data-edit]').click();
    await el.locator('[data-door="st-dock#2"]').check();
    await el.locator('[data-save]').click();
    await expect(el.locator('[data-state]')).toHaveText('כבוי');
    await expect(el.locator('.line')).toContainText('ההגדרה שונתה');
    await shot(page, `${size}-he-6-edited-off`);
    expect(errors).toEqual([]);
  });
}

test('English (LTR) and the stop switch state (1440)', async ({ page }) => {
  const st = fresh({ killed: true });
  const { el, errors } = await mount(page, st, '1440', 'en');
  await el.locator('[data-add]').click();
  await el.locator('[data-name]').fill('Morning gate');
  await el.locator('[data-door="st-entry#1"]').check();
  await el.locator('[data-save]').click();
  await expect(el.locator('[data-state]')).toHaveText('All door openings by automations are stopped');
  await expect(el.locator('[data-arm]')).toBeDisabled();
  await shot(page, '1440-en-killed');
  expect(errors).toEqual([]);
});
