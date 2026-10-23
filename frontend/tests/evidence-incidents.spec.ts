import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock, url } from './generator-mocks';

// CR-LIVEEVENT100 F-02 / F-05 / F-06 evidence: the REAL build against the wire contract of routers/incidents.py (fake data only). The
// generator mock layer serves the session (me, prefs, settings); the incident routes are layered on top (a later page.route wins).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-incidents.spec.ts --project=desktop
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/liveevent-100');
const NOW = new Date(Date.now() - 250_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const err = (route: Route, status: number, code: string) => json(route, { code, user_message: code, retryable: false, correlation_id: 'mock', details: {} }, status);

const SETTINGS = {
  'incident.enabled': true, 'incident.auto_open.alarm': false, 'incident.merge_window_s': 300, 'incident.max_live': 4, 'incident.max_live_phone': 1,
  'incident.snapshot_refresh_s': 10, 'incident.refresh_s': 60, 'incident.hidden_stop_s': 30, 'incident.door_window_s': 600, 'incident.near_radius_pct': 20,
  'incident.red_dot': 'active', 'incident.header_clock': true, 'incidents.retention_days': 365,
};
const detail = (over: Record<string, unknown> = {}) => ({
  id: 'i1', status: 'open', source: 'event', source_ref: 'ev1', source_label: 'מרכז האירועים', title: 'חדירה לאזור · חניון מזרח', building_id: 'b1', building_name: 'בניין א',
  floor_id: 'f1', floor_name: 'קומה -1', anchor_id: null, x: 0.3, y: 0.3, zone: 'חניון', opened_at: NOW, opened_by: 'dana', opened_by_name: 'דנה', acked_at: null,
  acked_by: null, closed_at: null, closed_by: null, close_note: null, event_label: 'חדירה לאזור',
  steps: [
    { at: NOW, kind: 'opened', actor: 'דנה', actor_kind: 'user', ref_type: 'event', ref_id: 'ev1', text: 'חדירה לאזור · חניון מזרח' },
    { at: NOW, kind: 'notified', actor: null, actor_kind: 'system', ref_type: 'notification', ref_id: 'n1', text: '2', recipients: ['דנה', 'יוסי'] },
    { at: NOW, kind: 'door_open', actor: null, actor_kind: 'user', ref_type: 'door', ref_id: 'lock.p', text: 'דלת חניון' },
  ],
  pending: ['דנה', 'יוסי'], can_ack: true, can_case: true, can_audit: false, can_configure: false, settings: SETTINGS, policy: 'x', ...over,
});

interface Opts { perms: string[]; module?: boolean; open?: number; cams?: 'ok' | 'forbidden'; infra?: boolean; detailOver?: Record<string, unknown> }

async function install(page: Page, o: Opts) {
  const calls: string[] = [];
  await installGeneratorMock(page, { perms: o.perms, count: o.infra ? 1 : 0, modules: { tickets: false, incidents: o.module !== false } as unknown as { tickets: boolean } });
  await page.route('**/api/v1/infra/elevators**', (route) => (o.infra ? json(route, { elevators: [{ id: 'e1', name: 'מעלית צפונית', area_id: null, area_name: 'לובי', state: 'fault', reason: '', partial: false, stale: false, since: null, roles: [], extras: [] }], summary: {}, stale: false, at: NOW }) : err(route, 403, 'forbidden')));
  await page.route('**/api/v1/incidents**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    calls.push(`${req.method()} ${p}`);
    if (o.module === false) {
      if (p === 'incidents/summary') return json(route, { enabled: false, open: 0, latest_id: null, red_dot: 'off' });
      if (p === 'incidents/settings') return json(route, { settings: { ...SETTINGS, 'incident.enabled': false }, bounds: {}, can_edit: o.perms.includes('system.configure') });
      return err(route, 404, 'feature_disabled');
    }
    if (p === 'incidents/summary') return json(route, { enabled: true, open: o.open ?? 1, latest_id: 'i1', latest_title: 'חדירה לאזור', red_dot: 'active' });
    if (p === 'incidents/settings') return json(route, { settings: SETTINGS, bounds: {}, can_edit: o.perms.includes('system.configure') });
    if (p === 'incidents') return json(route, { incidents: [detail()], retention_days: 365, can_open: o.perms.includes('events.ack'), can_configure: false, settings: SETTINGS });
    if (p === 'incidents/i1') return json(route, detail(o.detailOver));
    if (p === 'incidents/i1/cameras') {
      return o.cams === 'forbidden' ? err(route, 403, 'forbidden') : json(route, { cameras: [{ camera_id: 'c1', name: 'חניון מזרח', relation: 'same_zone', relation_label: 'אותו חדר', distance: 0 }], withheld: false, max_live: 4, max_live_phone: 1, snapshot_refresh_s: 10 });
    }
    if (p === 'incidents/i1/doors') return json(route, { doors: [{ entity_id: 'lock.p', name: 'דלת חניון', area_name: 'חניון', domain: 'lock', state: 'unlocked', open: true, since: NOW, available: true }], state_visible: true, window: { from: NOW, to: NOW }, window_s: 600 });
    if (p === 'incidents/i1/ack' && req.method() === 'POST') return json(route, detail({ acked_at: NOW, acked_by: 'דנה' }));
    return err(route, 404, 'incident_not_found');
  });
  return calls;
}

test.describe('live event evidence', () => {
  test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

  test('module OFF: no tab, no pill, no dot; the address shows "the module is off"', async ({ page }) => {
    await install(page, { perms: ['events.read', 'events.ack', 'video.live', 'system.configure'], module: false });
    await page.goto('about:blank');
    await page.goto(url('/investigate/incidents/i1'));
    await expect(page.locator('sw-app investigate-incidents [data-incidents-off]')).toBeVisible();
    await expect(page.locator('sw-app [data-incident-pill]')).toHaveCount(0);
    await expect(page.locator('sw-app [data-nav-dot]')).toHaveCount(0);
    await expect(page.locator('sw-app sw-tabs').getByText('אירוע חי')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, `off-${test.info().project.name}.png`) });
  });

  test('module ON, full operator: the four panels, the pill, the red dots and the actions; deep link from a notification', async ({ page }) => {
    const calls = await install(page, { perms: ['events.read', 'events.ack', 'video.live', 'cases.manage', 'devices.read'], infra: true });
    await page.goto('about:blank');
    await page.goto(url('/investigate/incidents/i1')); // the notification's link (Notification.link = #/investigate/incidents/<id>)
    const scr = page.locator('sw-app investigate-incidents');
    await expect(scr.locator('[data-incident="i1"]')).toBeVisible();
    for (const pane of ['map', 'cams', 'doors', 'chain']) await expect(scr.locator(`[data-pane="${pane}"]`).first()).toBeVisible();
    await expect(scr.locator('[data-incident-tile="c1"]')).toBeAttached();
    await expect(scr.locator('[data-incident-infra]')).toBeVisible();
    await expect(scr.locator('[data-step="waiting"]')).toBeVisible();
    await expect(scr.locator('[data-step="door_open"]')).toContainText('פתיחת דלת');
    await expect(page.locator('sw-app [data-incident-pill]')).toBeVisible();
    await expect(page.locator('sw-app [data-nav-dot="security"]')).toBeAttached();
    await expect(page.locator('sw-app [data-tab-dot="incidents"]')).toBeAttached();
    await expect(scr.locator('[data-incident-ack]')).toBeVisible();
    await expect(scr.locator('[data-incident-close]')).toBeVisible();
    await expect(scr.locator('[data-incident-settings-open]')).toHaveCount(0); // not an administrator
    // nothing on the page can operate a door: the only door affordance is the link to the device's own screen
    await expect(scr.locator('[data-door] a')).toHaveAttribute('href', /#\/devices\?entity=lock\.p/);
    await scr.locator('[data-incident-ack]').click();
    await expect.poll(() => calls.includes('POST incidents/i1/ack')).toBe(true);
    await page.screenshot({ path: path.join(OUT, `full-${test.info().project.name}.png`) });
  });

  test('viewer without live video and without infrastructure: forbidden camera panel, no infrastructure, no actions', async ({ page }) => {
    await install(page, { perms: ['events.read'], cams: 'forbidden', infra: false, detailOver: { can_ack: false, can_case: false } });
    await page.goto('about:blank');
    await page.goto(url('/investigate/incidents/i1'));
    const scr = page.locator('sw-app investigate-incidents');
    await expect(scr.locator('[data-incident-cams-forbidden]')).toBeVisible();
    await expect(scr.locator('[data-incident-infra]')).toHaveCount(0);
    await expect(scr.locator('[data-incident-ack]')).toHaveCount(0);
    await expect(scr.locator('[data-incident-close]')).toHaveCount(0);
    await expect(scr.locator('[data-incident-case]')).toHaveCount(0);
    await expect(scr.locator('[data-pane="chain"]')).toBeVisible();
    await page.screenshot({ path: path.join(OUT, `limited-${test.info().project.name}.png`) });
  });

  test('states: loading, error and not found', async ({ page }) => {
    await install(page, { perms: ['events.read'] });
    await page.route('**/api/v1/incidents/i9', async (route) => { await new Promise((r) => setTimeout(r, 800)); return err(route, 500, 'boom'); });
    await page.goto('about:blank');
    await page.goto(url('/investigate/incidents/i9'));
    await expect(page.locator('sw-app investigate-incidents [data-incidents-loading]')).toBeVisible();
    await expect(page.locator('sw-app investigate-incidents [data-incidents-error]')).toBeVisible();
    await page.goto(url('/investigate/incidents/nope'));
    await expect(page.locator('sw-app investigate-incidents').getByText('האירוע לא נמצא')).toBeVisible();
  });
});
