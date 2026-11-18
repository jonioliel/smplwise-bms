import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import { installAccessMock, NOW } from './access-control-mocks';
import { settlePage } from './pixel-settle';

// CR-EVENTS-TABLE-2443 (code review 06:EVT-3 / 06:INFILE-1, owner decision O17 = a): the event centre's review-window table
// ("חלונות") against a mocked backend - the columns now carry their own styles (title with the tone dot, the ×N count, the
// spotlight label, the manual-group note, the time) and the window drawer's severity badge is the list's red for "critical".
// No pixel spec covered this mode before. The access-control mock answers the session, the settings and the push sockets; the
// event centre's own reads are answered here. Baselines are taken on the runner (docs/changes/CR-EVENTS-TABLE-2443.md):
//   npx playwright test tests/pixel-events-windows-2443.spec.ts --project=desktop --project=mobile --update-snapshots
const SCREEN = 'sw-app investigate-events';
const DAY = '2026-09-27';
const at = (hm: string) => `${DAY}T${hm}:00Z`;

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

const CAMERAS = [
  { id: 'cam-1', name: 'כניסה ראשית', channel: 1, recorder_id: 'rec-1' },
  { id: 'cam-2', name: 'חניה מקורה', channel: 2, recorder_id: 'rec-1' },
  { id: 'cam-3', name: 'לובי', channel: 3, recorder_id: 'rec-1' },
];
const INGEST = { connected: true, last_heartbeat_at: at('10:29'), last_event_at: at('10:12'), last_error: null, reconnects: 0, events_stored: 6, started_at: at('06:00') };
const DERIVE = { last_run: at('10:20'), last_ok: at('10:20'), last_error: null, derived: 2 };

function ev(id: string, cam: number, type: string, hm: string, severity: 'info' | 'alert' | 'critical', acked = false) {
  const c = CAMERAS[cam];
  return {
    id, source: 'alertstream', raw_type: type.toUpperCase(), type, camera_id: c.id, camera_name: c.name, recorder_id: 'rec-1', channel: c.channel,
    occurred_at: at(hm), ended_at: null, received_at: at(hm), state: 'inactive', count: 1, severity, confidence: 'measured', details: {},
    acked_at: acked ? at('10:25') : null, acked_by_username: acked ? 'operator' : null, thumbnail: 'unavailable',
  };
}
const EVENTS = [
  ev('e1', 0, 'line', '10:12', 'critical'),
  ev('e2', 0, 'person', '10:11', 'critical'),
  ev('e3', 0, 'person', '10:10', 'alert'),
  ev('e4', 1, 'vehicle', '09:40', 'alert', true),
  ev('e5', 1, 'vehicle', '09:38', 'alert'),
  ev('e6', 2, 'motion', '08:05', 'info', true),
];
const RULE = { code: 'night_person', score: 3, label: 'אדם בשעת לילה', why: 'אדם זוהה מחוץ לשעות הפעילות' };
function win(id: string, cam: number, ids: string[], o: Record<string, unknown>) {
  const evs = EVENTS.filter((e) => ids.includes(e.id));
  const c = CAMERAS[cam];
  const types: Record<string, number> = {};
  for (const e of evs) types[e.type] = (types[e.type] ?? 0) + 1;
  return {
    id, camera_id: c.id, camera_name: c.name, group: 'camera', group_label: null, channel: c.channel,
    start: evs[evs.length - 1].occurred_at, end: evs[0].occurred_at, count: evs.length, types, dominant_type: evs[0].type,
    severity: 'info', acked_count: evs.filter((e) => e.acked_at).length, acked: evs.every((e) => e.acked_at),
    first_event_id: evs[evs.length - 1].id, last_event_id: evs[0].id, event_ids: ids, thumbnail: 'unavailable', thumbnail_event_id: evs[0].id,
    confidence: 'measured', spotlight: { on: false, score: 0, rules: [], confidence: 'measured', sources: ['alertstream'] }, manual_group_id: null,
    ...o,
  };
}
const WINDOWS = [
  // critical, lit by a spotlight rule, three events (×3)
  win('w1', 0, ['e1', 'e2', 'e3'], { severity: 'critical', spotlight: { on: true, score: 3, rules: [RULE], confidence: 'measured', sources: ['alertstream'] } }),
  // alert, regrouped by hand, one of two handled
  win('w2', 1, ['e4', 'e5'], { severity: 'alert', group: 'manual', manual_group_id: 'g1' }),
  // information, a floor group naming its cameras, handled
  win('w3', 2, ['e6'], { severity: 'info', group: 'floor', group_label: 'קומת קרקע', camera_names: ['לובי', 'מסדרון מזרחי'] }),
];

const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

async function open(page: Page) {
  await installAccessMock(page, { settings: { 'time.zone': 'UTC' } });
  // registered after the access mock, so these answer first (Playwright runs matching routes newest first).
  // The access mock's personas hold only access-control permissions; the event centre needs events.read (shell/nav.ts).
  const perms = ['events.read', 'video.read', 'map.read', 'recordings.read', 'system.configure'];
  await page.route('**/api/v1/me', (route) => json(route, {
    user: { id: 'u-admin', username: 'admin', display_name: 'מנהל מערכת', source: 'ingress' },
    channel: 'local', remote: null, bindings: [], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done',
  }));
  await page.route('**/api/v1/cameras**', (route) => json(route, { cameras: CAMERAS, recorders: [{ id: 'rec-1', name: 'מקליט' }], recorder: null, can_sync: false }));
  await page.route('**/api/v1/events**', (route) => {
    const p = new URL(route.request().url()).pathname;
    if (p.endsWith('/events/windows')) return json(route, { windows: WINDOWS, from: at('00:00'), to: `${DAY}T23:59:59Z`, timezone: 'UTC', gap_seconds: 180, events_total: EVENTS.length, spotlights: 1 });
    if (p.endsWith('/events/facets')) return json(route, { places: [], severities: [], types: [], sources: [] });
    if (p.endsWith('/events')) return json(route, { events: EVENTS, from: at('00:00'), to: `${DAY}T23:59:59Z`, timezone: 'UTC', ingest: INGEST, derive: DERIVE, types: ['line', 'person', 'vehicle', 'motion'] });
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }) });
  });
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.events.mode', 'windows');
    } catch {
      /* about:blank */
    }
  });
  await page.clock.setFixedTime(NOW);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=classic&scheme=light#/investigate/events?date=${DAY}`);
  await page.waitForSelector('sw-app');
  await page.locator(`${SCREEN} sw-table [data-window-spotlight]`).waitFor({ timeout: 30_000 });
  await settlePage(page);
}

async function compare(page: Page, info: Parameters<typeof noBaseline>[0] & { project: { name: string } }, name: string) {
  const file = `${name}-${info.project.name === 'mobile' ? '390' : '1440'}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled', timeout: 15_000 });
}

test.describe('pixel: the event centre review windows', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
  });

  test('classic is pixel-stable: the review-window table and the critical window drawer', async ({ page }, info) => {
    await open(page);
    const table = page.locator(`${SCREEN} sw-table`);
    // structural: the cells carry their own styles (they render in sw-table's shadow root)
    const spot = table.locator('[data-window-spotlight]').first();
    await expect(spot).toHaveCSS('display', 'inline-flex');
    await expect(spot).toHaveCSS('font-weight', /^(600|700)$/);
    await compare(page, info, 'events-windows-classic-table');

    await table.locator('tbody tr', { hasText: '×3' }).first().click();
    const drawer = page.locator(`${SCREEN} sw-drawer[open]`);
    await expect(drawer.locator('[data-window-summary] sw-badge').first()).toHaveAttribute('kind', 'error');
    await expect(drawer.locator('[data-window-summary] sw-badge').first()).toHaveAttribute('filled', '');
    await settlePage(page);
    await compare(page, info, 'events-windows-classic-drawer');
  });
});
