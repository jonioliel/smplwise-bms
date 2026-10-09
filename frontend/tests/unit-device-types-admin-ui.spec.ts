import { test, expect, type Page, type Route } from '@playwright/test';

// DEVTYPE (owner 2026-10-09): הגדרות › חשמל והתקנים › סוגי התקנים against a MOCKED wire contract of smplwise/routers/devices.py
// (GET devices/device-types, PUT devices/entities/{id}/device-type, POST devices/device-types). Invented devices, no secrets.
//   npm run build && SW_BASE_URL=http://127.0.0.1:4391/ npx playwright test tests/unit-device-types-admin-ui.spec.ts

const PERMS = ['video.live', 'map.read', 'entity.state.read', 'devices.read', 'events.read', 'system.configure'];
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const notFound = (route: Route) => json(route, { code: 'not_found', user_message: 'לא נמצא (בדיקה)', retryable: false, correlation_id: 'mock', details: {} }, 404);

type Kind = 'switch' | 'outlet' | 'light' | 'fan' | 'heater' | 'water_heater' | 'valve';
const ALL: Kind[] = ['switch', 'outlet', 'light', 'fan', 'heater', 'water_heater', 'valve'];
interface Dev { entity_id: string; name: string; auto: Kind; set: Kind | null; area: string }

async function setup(page: Page) {
  const devs: Dev[] = [
    { entity_id: 'switch.boiler', name: 'דוד שמש', auto: 'water_heater', set: null, area: 'גג' },
    { entity_id: 'switch.tap', name: 'ברז גינה', auto: 'valve', set: null, area: 'חצר' },
    { entity_id: 'switch.relay3', name: 'Relay 3', auto: 'switch', set: null, area: 'אמבטיה' },
  ];
  const calls: { method: string; path: string; body: unknown }[] = [];
  const listing = () => ({
    kinds: ALL,
    devices: devs.map((d) => ({
      entity_id: d.entity_id, name: d.name, domain: 'switch', device_class: null, area_id: d.area, area_name: d.area, floor_id: 'g', floor_name: 'קרקע', state: 'off', available: true,
      kind: d.set ?? d.auto, auto: d.auto, set: d.set, options: ALL, set_by: d.set ? 'admin' : null, set_at: d.set ? '2026-10-09T08:00:00Z' : null,
    })),
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.routeWebSocket(/\/me\/ws/, () => undefined);
  await page.routeWebSocket(/\/ha\/ws/, () => undefined);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me') return json(route, { user: { id: 'u-admin', username: 'admin', display_name: 'מנהל', source: 'ingress' }, channel: 'local', remote: null, active: true, bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל מערכת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }], permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, permissions_fingerprint: 'fp', permissions_changed: false, bootstrap_state: 'done', mode: 'full' });
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [], updated_at: null });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a' }, can_edit: true });
    if (p === 'health/summary') return json(route, { status: 'ok', items: [], checked_at: '2026-10-09T00:00:00Z', version: 'test' });
    if (p.startsWith('rules/alerts')) return json(route, { alerts: [], unacked: 0 });
    if (p.startsWith('notifications')) return json(route, { unread: 0, items: [] });
    if (p === 'sites') return json(route, { sites: [], can_create_site: false });
    if (p === 'devices/device-types' && method === 'GET') return json(route, listing());
    if (p === 'devices/device-types' && method === 'POST') {
      const body = req.postDataJSON() as { entity_ids: string[]; kind: Kind | 'auto' };
      calls.push({ method, path: p, body });
      let changed = 0;
      for (const d of devs) if (body.entity_ids.includes(d.entity_id)) { d.set = body.kind === 'auto' ? null : body.kind; changed += 1; }
      return json(route, { results: [], changed, refused: 0 });
    }
    const one = p.match(/^devices\/entities\/(.+)\/device-type$/);
    if (one && method === 'PUT') {
      const body = req.postDataJSON() as { kind: Kind | 'auto' };
      calls.push({ method, path: p, body });
      const d = devs.find((x) => x.entity_id === decodeURIComponent(one[1]))!;
      d.set = body.kind === 'auto' ? null : body.kind;
      return json(route, { entity_id: d.entity_id, changed: true, kind: d.set ?? d.auto, auto: d.auto, set: d.set });
    }
    return notFound(route);
  });
  return { calls };
}

test('settings > devices: the device-type list - per-row choice overrides the name guess, back to automatic, group change, search', async ({ page }) => {
  const { calls } = await setup(page);
  await page.goto('/?design=a#/system/diagnostics?tab=devices');
  const card = page.locator('sw-app system-diagnostics devices-type-admin');
  await expect(card.locator('[data-device-types]')).toBeVisible();
  const visible = (sel: string) => card.locator(sel).locator('visible=true').first();

  // automatic by default: the option names the guessed type
  const boilerSelect = visible('select[data-type-select="switch.boiler"]');
  await expect(boilerSelect).toHaveValue('auto');
  await expect(boilerSelect.locator('option[value="auto"]')).toHaveText('אוטומטי (דוד מים)');

  // one row: the manual choice wins
  await boilerSelect.selectOption('switch');
  await expect.poll(() => calls.length).toBe(1);
  expect(calls[0]).toEqual({ method: 'PUT', path: 'devices/entities/switch.boiler/device-type', body: { kind: 'switch' } });
  await expect(visible('select[data-type-select="switch.boiler"]')).toHaveValue('switch');
  await expect(card.locator('[data-entity="switch.boiler"] [data-type-source="manual"]').locator('visible=true')).toHaveCount(1);

  // back to automatic
  await visible('select[data-type-select="switch.boiler"]').selectOption('auto');
  await expect.poll(() => calls.length).toBe(2);
  expect(calls[1].body).toEqual({ kind: 'auto' });

  // search narrows the list
  await card.locator('input[data-type-search]').fill('ברז');
  await expect(card.locator('[data-type-counts]')).toContainText(/1 מתוך ‎?3/);
  await card.locator('input[data-type-search]').fill('');

  // group change: select all, choose a type, confirm
  await card.locator('sw-button[data-type-all]').click();
  await card.locator('select[data-type-bulk-kind]').selectOption('valve');
  await card.locator('sw-button[data-type-bulk-apply]').click();
  await expect(card.locator('[data-type-question]')).toContainText('ברז / השקיה');
  await card.locator('sw-button[data-type-confirm]').click();
  await expect.poll(() => calls.length).toBe(3);
  expect(calls[2]).toEqual({ method: 'POST', path: 'devices/device-types', body: { entity_ids: ['switch.boiler', 'switch.tap', 'switch.relay3'], kind: 'valve' } });
  await expect(card.locator('[data-type-result]')).toContainText('ברז / השקיה');
  // no infrastructure product name on the screen
  await expect(card).not.toContainText(/Home Assistant|\bHA\b/);
  // SW_SHOTS=1: the review screenshots (docs/design/evidence/devtype), nothing otherwise
  if (process.env.SW_SHOTS) await card.screenshot({ path: `../docs/design/evidence/devtype/device-types-${test.info().project.name}.png` });
});
