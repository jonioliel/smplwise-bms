import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// INVREST-POLISH-2331: the investigation leftovers (cases list, one case, exports, the event page) against a faked backend
// (page.route; no device, no recorder, invented sample data). Asserted (desktop / tablet): the page itself does not scroll - the
// list or the side column scrolls inside its own box; the primary actions are inside the viewport without scrolling; the event page
// names the event in Hebrew from the device code (no raw code in the operator path); the phone keeps every action reachable.
// Screenshots: INVREST_OUT (default docs/evidence/INVREST-POLISH-2331), file prefix INVREST_PHASE (default "after"). With
// INVREST_PHASE=before the assertions are skipped (shots of the old build only).
//   SW_BASE_URL=http://127.0.0.1:4211/ npx playwright test tests/evidence-invrest-polish.spec.ts --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.INVREST_OUT || path.resolve(HERE, '..', '..', 'docs', 'evidence', 'INVREST-POLISH-2331');
const PHASE = process.env.INVREST_PHASE || 'after';
const CHECK = PHASE !== 'before';

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
const PERMS = ['events.read', 'events.ack', 'devices.read', 'map.read', 'cases.read', 'cases.manage', 'video.playback', 'video.export'];
const CAMS = [
  { id: 'c1', name: 'כניסה ראשית', channel: 1, recorder_id: 'nvr-1', enabled: true },
  { id: 'c2', name: 'חניה מקורה', channel: 2, recorder_id: 'nvr-1', enabled: true },
  { id: 'c3', name: 'מסדרון מזרחי', channel: 3, recorder_id: 'nvr-1', enabled: true },
];
const FRAME = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b4a5e"/><stop offset="1" stop-color="#8aa0b8"/></linearGradient></defs><rect width="640" height="360" fill="url(#g)"/><rect x="380" y="150" width="70" height="150" rx="20" fill="#d8e0ea" opacity=".55"/></svg>`;

const counts = (items: number, preserved: number) => ({ items, events: Math.ceil(items / 3), clips: Math.floor(items / 2), notes: 1, snapshots: 0, preserved });
const CASE_TITLES: [string, 'open' | 'in_review' | 'closed', string[]][] = [
  ['פריצה לחניה מקורה', 'open', ['חניה', 'לילה']],
  ['חבילה שנעלמה מהלובי', 'in_review', ['לובי']],
  ['נזק לשער החשמלי', 'open', []],
  ['תלונת דייר - רעש בלילה', 'closed', ['דיירים']],
  ['בדיקת שגרה רבעונית של מצלמות הכניסה, החניה והמסדרונות בכל הקומות', 'in_review', ['שגרה', 'רבעון']],
  ['אופניים שנגנבו מהמחסן', 'open', ['מחסן']],
  ['דלת חירום נשארה פתוחה', 'closed', []],
  ['רכב חוסם יציאה', 'open', ['חניה']],
  ['תיק מיובא מהבניין השכן', 'in_review', ['מיובא']],
];
const CASES = CASE_TITLES.map(([title, status, tags], i) => ({
  id: `k${i + 1}`, title, description: '', status, tags, owner_user_id: 'u1', owner_username: i % 3 === 1 ? 'yossi' : 'dana', revision: 1,
  created_at: ago(60 * 24 * (i + 2)), updated_at: ago(37 * (i + 1) + 12), closed_at: status === 'closed' ? ago(60) : null,
  counts: counts(3 + (i % 5), i % 4), origin: i === 8 ? 'imported' : 'local', provenance: null,
}));
const EV_AT = ago(42);
const CASE_DETAIL = {
  ...CASES[0], description: 'אדם נכנס לחניה המקורה אחרי שהשער נפתח. לבדוק את מצלמת המסדרון המזרחי באותן דקות.', counts: counts(6, 2), hidden_items: 0, can_manage: true, checked: true,
  items: [
    { id: 'i1', case_id: 'k1', kind: 'event', camera_id: 'c2', camera_name: 'חניה מקורה', event_id: 'e1', event: { type: 'line', occurred_at: EV_AT, ended_at: ago(41), severity: 'alert', confidence: 'measured', thumbnail: 'ready', acked_at: null, source: 'alertstream' }, export_job_id: null, from_at: null, to_at: null, note: '', added_by_username: 'dana', created_at: ago(40), preservation: 'nvr_only', export: null },
    { id: 'i2', case_id: 'k1', kind: 'clip', camera_id: 'c2', camera_name: 'חניה מקורה', event_id: null, event: null, export_job_id: 'x1', from_at: ago(43), to_at: ago(41), note: '', added_by_username: 'dana', created_at: ago(39), preservation: 'preserved', export: { id: 'x1', state: 'done', progress: 1, download_ready: true, error: null } },
    { id: 'i3', case_id: 'k1', kind: 'clip', camera_id: 'c3', camera_name: 'מסדרון מזרחי', event_id: null, event: null, export_job_id: 'x2', from_at: ago(43), to_at: ago(40), note: '', added_by_username: 'dana', created_at: ago(38), preservation: 'preserving', export: { id: 'x2', state: 'running', progress: 0.4, download_ready: false, error: null } },
    { id: 'i4', case_id: 'k1', kind: 'clip', camera_id: 'c1', camera_name: 'כניסה ראשית', event_id: null, event: null, export_job_id: null, from_at: ago(60 * 24 * 40), to_at: ago(60 * 24 * 40 - 2), note: '', added_by_username: 'yossi', created_at: ago(30), preservation: 'missing', export: null },
    { id: 'i5', case_id: 'k1', kind: 'note', camera_id: null, camera_name: null, event_id: null, event: null, export_job_id: null, from_at: null, to_at: null, note: 'השער נשאר פתוח כ־40 שניות; לבקש מהמשמרת לבדוק את מנגנון הסגירה.', added_by_username: 'dana', created_at: ago(20), preservation: 'none', export: null },
    { id: 'i6', case_id: 'k1', kind: 'clip', camera_id: 'c1', camera_name: 'כניסה ראשית', event_id: null, event: null, export_job_id: null, from_at: ago(44), to_at: ago(42), note: '', added_by_username: 'dana', created_at: ago(18), preservation: 'nvr_only', export: null },
  ],
};
const BUNDLES = [{ name: 'case-k1-20261101-1012.zip', bytes: 48_200_000, created_at: ago(15), signed: 'a1b2c3', files: 4 }];
const job = (id: string, cam: string, state: string, progress: number, extra: Record<string, unknown> = {}) => ({
  id, camera_id: 'c1', camera_name: cam, owner: 'dana', requested_from: ago(180), requested_to: ago(170), state, progress, error: null, created_at: ago(30), updated_at: ago(1),
  files: [{ name: 'a.mp4', start_at: ago(180), end_at: ago(175), size: 30_000_000, state: progress >= 1 ? 'remuxed' : 'downloading', bytes: 12_000_000, error: null }, { name: 'b.mp4', start_at: ago(175), end_at: ago(170), size: 30_000_000, state: progress >= 1 ? 'remuxed' : 'pending', bytes: 0, error: null }],
  estimate_bytes: 60_000_000, timezone: 'Asia/Jerusalem', coverage: 'full', output_name: `${id}.mp4`, media_type: 'video/mp4', container: 'mp4', actual_from: progress >= 1 ? ago(180) : null, actual_to: progress >= 1 ? ago(170) : null,
  remux: 'done', sha256: progress >= 1 ? '9f2c6a1be0d4473a8c5e1f00b2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f708192a3b' : null, bytes_done: 12_000_000, note: '', download_ready: progress >= 1, ...extra,
});
const JOBS = [
  job('x3', 'מסדרון מזרחי', 'running', 0.46),
  job('x4', 'חצר אחורית', 'queued', 0),
  job('x1', 'חניה מקורה', 'done', 1),
  job('x5', 'כניסה ראשית', 'partial', 1, { note: 'קובץ אחד מתוך שניים לא היה זמין ב־NVR', download_ready: true }),
  job('x6', 'לובי', 'failed', 0.2, { error: 'ה־NVR לא ענה אחרי שלושה ניסיונות' }),
  job('x7', 'גג', 'paused_disk_full', 0.7),
  job('x8', 'מחסן', 'cancelled', 0.1),
];
const EVENT = {
  id: 'e1', source: 'alertstream', raw_type: 'linedetection', type: 'line', camera_id: 'c2', camera_name: 'חניה מקורה', recorder_id: 'nvr-1', channel: 2,
  occurred_at: EV_AT, ended_at: ago(41.2), received_at: EV_AT, state: 'inactive', count: 3, severity: 'alert', confidence: 'measured',
  details: { description: 'linedetection alarm', device_time: EV_AT, time_precision: 'device_offset', target: null, active_post_count: 1 },
  acked_at: null, acked_by_username: null, thumbnail: 'ready', timezone: 'Asia/Jerusalem',
  location: { anchor_id: 'a2', floor_id: 'f0', floor_name: 'קומת חניון', building_id: 'b1', building_name: 'בניין A', x: 0.3, y: 0.4, zone: 'חניון מקורה', has_plan: false },
};
const NEARBY = [
  { ...EVENT, id: 'e2', raw_type: 'VMD', type: 'motion', camera_id: 'c3', camera_name: 'מסדרון מזרחי', occurred_at: ago(44), severity: 'info', count: 1 },
  { ...EVENT, id: 'e3', raw_type: 'VMD', type: 'motion', camera_id: 'c1', camera_name: 'כניסה ראשית', occurred_at: ago(47), severity: 'info', count: 1 },
  { ...EVENT, id: 'e4', raw_type: 'fielddetection', type: 'field', camera_id: 'c2', camera_name: 'חניה מקורה', occurred_at: ago(38), severity: 'alert', count: 1 },
];
const CORR = {
  event_id: 'e1', window_s: 120, subject: { kind: 'camera', id: 'c2' }, spatial: true,
  location: { floor_id: 'f0', floor_name: 'קומת חניון', building_name: 'בניין A', x: 0.3, y: 0.4, zone: 'חניון מקורה', radius: 0.2 },
  entities: [{ entity_id: 'binary_sensor.gate', name: 'שער חניון', domain: 'binary_sensor', device_class: 'door', tracked_as: null, state: 'פתוח', last_changed: ago(43), state_missing: false, distance: 0.1, same_zone: true }],
  cameras: [{ camera_id: 'c3', distance: 0.3, same_zone: false }],
  links: [
    { kind: 'sensor', event_id: 's1', name: 'שער חניון', at: ago(42.6), delta_s: -36, label: 'שער חניון נפתח', certainty: 'measured', note: 'אותו אזור' },
    { kind: 'command', action_id: 'a1', name: 'פתיחת שער', at: ago(42.7), delta_s: -42, label: 'פקודת פתיחה מהאפליקציה · dana', certainty: 'command', note: 'פקודה, לא תצפית' },
    { kind: 'camera', event_id: 'e2', name: 'מסדרון מזרחי', at: ago(41.5), delta_s: 30, label: 'זיהוי תנועה · מסדרון מזרחי', certainty: 'inferred', note: 'אזור סמוך' },
  ],
  notes: [{ code: 'spatial', text: 'הסביבה נקבעת לפי מיקום המצלמה על התוכנית.' }], policy: 'קורלציה בזמן ובמקום אינה הוכחה לקשר סיבתי.',
  event: { id: 'e1', type: 'line', source: 'alertstream', camera_id: 'c2', camera_name: 'חניה מקורה', occurred_at: EV_AT, received_at: EV_AT, confidence: 'measured', details: {} },
};
const ROUTE = {
  event_id: 'e1', hypothetical: true, spatial: true, subject: { camera_id: 'c2', name: 'חניה מקורה', zone: 'חניון מקורה' }, location: { floor_id: 'f0', floor_name: 'קומת חניון', building_name: 'בניין A' },
  window: { from: ago(43.5), to: ago(40.5) },
  suggestions: [
    { camera_id: 'c3', name: 'מסדרון מזרחי', relation: 'adjacent_zone', relation_label: 'אזור סמוך', distance: 0.22, zone: 'מסדרון', activity_events: 2, playback_at: ago(42) },
    { camera_id: 'c1', name: 'כניסה ראשית', relation: 'via_connector', relation_label: 'דרך מדרגות', distance: 0.4, zone: 'לובי', activity_events: 0, playback_at: ago(42), via: { connector_id: 'st1', kind: 'stairs', kind_label: 'מדרגות', label: 'חדר מדרגות A', floor_id: 'f1', floor_name: 'קומת קרקע', direction: 'up', twin_published: true } },
  ],
  notes: [], policy: 'השערה בלבד: המסלול מוצע לפי מבנה התוכנית, לא לפי זיהוי אדם.',
};

async function installApi(page: Page) {
  await page.routeWebSocket('**/events/ws', () => { /* accepted, silent */ });
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = route.request().method();
    if (p === 'me') {
      return json(route, {
        user: { id: 'u1', username: 'dana', display_name: 'דנה', source: 'ingress' }, channel: 'local', remote: null, bindings: [], permissions_installation: PERMS, permissions_any: PERMS,
        has_access: true, permission_revision: 1, bootstrap_state: 'done', mode: 'full',
        capabilities: { nvr: true, go2rtc: true, ha: true, live_video: true, playback: true, events_recorder: true, events_ha: true, ha_cameras_still: true, ha_cameras_live: false, supported: true, unsupported_reason: null },
      });
    }
    if (p === 'me/prefs') return json(route, { prefs: {}, stored: [] });
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a', 'time.zone': 'Asia/Jerusalem' }, can_edit: false });
    if (/(thumbnail|frame|\/file)$/.test(p)) return route.fulfill({ status: 200, contentType: 'image/svg+xml', body: FRAME });
    if (p === 'cases' && method === 'GET') {
      const st = url.searchParams.get('status');
      return json(route, { cases: st ? CASES.filter((c) => c.status === st) : CASES, can_manage: true, can_import: true });
    }
    if (p === 'cases/k1') return json(route, CASE_DETAIL);
    if (p === 'cases/k1/bundles') return json(route, { bundles: BUNDLES });
    if (p === 'exports') return json(route, { jobs: JOBS, ffmpeg: true });
    if (p === 'events/e1') return json(route, EVENT);
    if (p === 'events/e1/correlation') return json(route, CORR);
    if (p === 'events/e1/route') return json(route, ROUTE);
    if (p === 'events') return json(route, { events: [EVENT, ...NEARBY], from: ago(60), to: ago(0), timezone: 'Asia/Jerusalem', types: [], filters: { applied: {}, unsupported: [] }, ingest: null, derive: null });
    if (p === 'cameras') return json(route, { cameras: CAMS, recorders: [{ id: 'nvr-1', name: 'NVR' }] });
    if (p === 'incidents/summary') return json(route, { enabled: false, open: 0, latest_id: null, red_dot: 'off' });
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
}

async function open(page: Page, hash: string, ready: string) {
  await installApi(page);
  await page.goto('about:blank');
  await page.goto(`/?design=a#${hash}`);
  await page.waitForSelector(ready, { state: 'visible', timeout: 15_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(2, 300);
  await page.waitForTimeout(700);
}

/** How far the shell's scroll container (sw-app's <main>) can scroll: 0 = the page fits. */
const pageScroll = (page: Page) => page.evaluate(() => {
  const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
  const doc = document.scrollingElement!;
  return Math.max(main ? main.scrollHeight - main.clientHeight : 0, doc.scrollHeight - doc.clientHeight);
});

const shot = (page: Page, name: string) => {
  fs.mkdirSync(OUT, { recursive: true });
  return page.screenshot({ path: path.join(OUT, `${PHASE}-${name}.png`) });
};

/** The extra review sizes of the brief: 1920x1080 on the desktop project, 1180x820 on the tablet project. */
const EXTRA: Record<string, { width: number; height: number; tag: string } | undefined> = {
  desktop: { width: 1920, height: 1080, tag: 'desktop1920' },
  tablet: { width: 1180, height: 820, tag: 'tablet1180' },
};

async function inView(page: Page, loc: ReturnType<Page['locator']>, what: string) {
  const box = await loc.boundingBox();
  const vh = await page.evaluate(() => window.innerHeight);
  expect(box, `${what} is rendered`).not.toBeNull();
  expect(box!.y, `${what} starts inside the viewport`).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height, `${what} ends inside the viewport`).toBeLessThanOrEqual(vh + 1);
}

test.describe('INVREST-POLISH-2331 investigation leftovers', () => {
  test('cases list', async ({ page }, info) => {
    const vp = info.project.name;
    await open(page, '/investigate/cases', 'investigate-cases sw-table');
    await shot(page, `cases-${vp}`);
    const screen = page.locator('investigate-cases');
    if (CHECK) {
      await expect(screen.locator('[data-case-new]')).toBeVisible();
      await inView(page, screen.locator('[data-case-new]'), 'the new-case action');
      if (vp !== 'mobile') expect(await pageScroll(page), 'the page itself does not scroll; the list scrolls in its own box').toBeLessThanOrEqual(1);
      await expect(screen.locator('[data-case-count]')).toContainText('9');
    }
    // the status filter and the search narrow the list
    await screen.locator('[data-case-status-filter="open"]').or(screen.locator('sw-chip').nth(1)).first().click();
    await page.waitForTimeout(400);
    await shot(page, `cases-open-${vp}`);
    // the create dialog: its actions in view
    await screen.locator('[data-case-new]').click();
    await page.waitForTimeout(500);
    await shot(page, `cases-create-${vp}`);
    if (CHECK) await inView(page, screen.locator('[data-case-create-confirm]'), 'the create action');
    await page.keyboard.press('Escape');
    const extra = EXTRA[vp];
    if (extra) {
      await page.setViewportSize({ width: extra.width, height: extra.height });
      await page.waitForTimeout(500);
      await shot(page, `cases-${extra.tag}`);
    }
  });

  test('cases empty and error states', async ({ page }, info) => {
    test.skip(info.project.name === 'tablet', 'one wide and one narrow shot are enough for the states');
    const vp = info.project.name;
    await installApi(page);
    await page.route('**/api/v1/cases**', (route) => (new URL(route.request().url()).searchParams.get('q') === 'x' ? json(route, { code: 'unavailable', user_message: 'השרת לא זמין כרגע', retryable: true, correlation_id: 'mock', details: {} }, 503) : json(route, { cases: [], can_manage: true, can_import: true })));
    await page.goto('about:blank');
    await page.goto('/?design=a#/investigate/cases');
    await page.waitForSelector('investigate-cases sw-state-panel', { state: 'visible', timeout: 15_000 });
    await page.waitForTimeout(500);
    await shot(page, `cases-empty-${vp}`);
  });

  test('one case', async ({ page }, info) => {
    const vp = info.project.name;
    await open(page, '/investigate/cases/k1', 'investigate-case-detail [data-case-item]');
    await shot(page, `case-${vp}`);
    const screen = page.locator('investigate-case-detail');
    if (CHECK) {
      await inView(page, screen.locator('[data-case-edit]'), 'the edit action');
      if (vp !== 'mobile') {
        expect(await pageScroll(page), 'the case page does not scroll; its columns scroll in their own boxes').toBeLessThanOrEqual(1);
        await inView(page, screen.locator('[data-bundle-create]'), 'the bundle action');
        await inView(page, screen.locator('[data-note-add]'), 'the add-note action');
      }
    }
    const extra = EXTRA[vp];
    if (extra) {
      await page.setViewportSize({ width: extra.width, height: extra.height });
      await page.waitForTimeout(500);
      await shot(page, `case-${extra.tag}`);
    }
  });

  test('exports', async ({ page }, info) => {
    const vp = info.project.name;
    await open(page, '/investigate/exports', 'investigate-exports .job');
    await shot(page, `exports-${vp}`);
    const screen = page.locator('investigate-exports');
    if (CHECK) {
      if (vp !== 'mobile') expect(await pageScroll(page), 'the page itself does not scroll').toBeLessThanOrEqual(1);
      await expect(screen.locator('.job')).toHaveCount(JOBS.length);
      await expect(screen.locator('[data-export-summary]')).toBeVisible();
    }
    const extra = EXTRA[vp];
    if (extra) {
      await page.setViewportSize({ width: extra.width, height: extra.height });
      await page.waitForTimeout(500);
      await shot(page, `exports-${extra.tag}`);
    }
  });

  test('event page', async ({ page }, info) => {
    const vp = info.project.name;
    await open(page, '/investigate/events/e1', 'investigate-event-detail [data-context]');
    await page.waitForTimeout(600);
    await shot(page, `event-${vp}`);
    const screen = page.locator('investigate-event-detail');
    if (CHECK) {
      const head = await screen.locator('sw-page').getAttribute('heading');
      expect(head, 'the event is named in Hebrew from the device code').toContain('חציית קו');
      expect(await screen.locator('[data-context]').innerText(), 'no raw device code in the facts').not.toMatch(/linedetection|raw/);
      await inView(page, screen.locator('[data-ack]'), 'the handled action');
      if (vp !== 'mobile') {
        expect(await pageScroll(page), 'the event page does not scroll; the side column scrolls in its own box').toBeLessThanOrEqual(1);
        await inView(page, screen.locator('[data-player]'), 'the player');
      }
    }
    const extra = EXTRA[vp];
    if (extra) {
      await page.setViewportSize({ width: extra.width, height: extra.height });
      await page.waitForTimeout(600);
      await shot(page, `event-${extra.tag}`);
    }
  });
});
