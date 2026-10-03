import type { Page, Route } from '@playwright/test';

// NN1 P2: a mocked backend for the four installations (A no NVR / no media server, B media server only, C NVR without a media
// server = unsupported, D both) and the Home Assistant states (connected, down, not configured). Every name is synthetic: no
// device, no NVR, no media server, no Home Assistant, no real address. `/me` carries the capability block exactly as
// smplwise/capabilities.py serialises it; `/health`, `/health/summary`, `/health/report` and `/setup/state` follow the
// shapes of docs/architecture/CAPABILITIES.md section 3. Everything else answers 404 (a screen that is open shows its own error).

export type Combo = 'A' | 'B' | 'C' | 'D';
export type HaState = 'connected' | 'down' | 'none';
export const COMBOS: Combo[] = ['A', 'B', 'C', 'D'];

const NOT_FOUND = { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: '', details: {} };
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export const ADMIN_PERMS = [
  'system.configure', 'sources.configure', 'devices.read', 'devices.control', 'map.read', 'map.edit', 'events.read', 'video.live', 'video.playback',
  'video.export', 'cases.manage', 'rules.manage', 'media.read', 'access.read', 'audit.read', 'nvr.write',
];

export function capabilities(combo: Combo, ha: HaState = 'connected') {
  const nvr = combo === 'C' || combo === 'D';
  const go2rtc = combo === 'B' || combo === 'D';
  const haOn = ha !== 'none'; // configured, not reachable: a down Home Assistant changes nothing here
  const unsupported = nvr && !go2rtc;
  return {
    nvr, go2rtc, ha: haOn,
    live_video: go2rtc && (nvr || haOn),
    playback: go2rtc && nvr,
    events_recorder: nvr,
    events_ha: haOn,
    ha_cameras_still: haOn,
    ha_cameras_live: haOn && go2rtc,
    supported: !unsupported,
    unsupported_reason: unsupported ? 'nvr_without_go2rtc' : null,
    recorders: nvr ? [{ id: 'nvr-1', vendor: 'hikvision', live: true, playback: true, events: true, write_encodings: true }] : [],
  };
}

const UNSUPPORTED = {
  supported: false,
  reason: 'nvr_without_go2rtc',
  message: 'התקנה עם NVR אינה נתמכת בלי שרת המדיה (go2rtc): בלעדיו אין וידאו חי ואין ניגון הקלטות.',
  action: 'השלימו את כתובת שרת המדיה (go2rtc_url) בהגדרות החיבור של ההתקנה והפעילו את המערכת מחדש.',
};
const installation = (combo: Combo) => (combo === 'C' ? UNSUPPORTED : { supported: true, reason: null, message: null, action: null });

function me(combo: Combo, ha: HaState, legacy: boolean) {
  const base = {
    user: { id: 'u-nn1', username: 'nn1', display_name: 'יוני', source: 'ingress' }, channel: 'local', remote: null, bindings: [],
    permissions_installation: ADMIN_PERMS, permissions_any: ADMIN_PERMS, has_access: true, permission_revision: 1, bootstrap_state: 'done',
    mode: combo === 'A' || combo === 'B' ? 'ha_only' : 'full',
  };
  return legacy ? base : { ...base, capabilities: capabilities(combo, ha) };
}

function steps(combo: Combo, ha: HaState) {
  const at = '2026-10-03T09:00:00Z';
  const nvrLess = combo === 'A' || combo === 'B';
  const mk = (id: string, index: number, title: string, status: string, summary: string, extra: Record<string, unknown> = {}) => ({
    id, index, title, status, summary, facts: [], evidence: {}, problem: null, warnings: [], settings_link: { href: '#/system/setup', label: 'חיבורים' }, source: 'local', checked_at: at, ...extra,
  });
  const skipped = { status_label: 'דילוג - מצב ללא NVR' };
  return [
    mk('install', 1, 'התקנה', 'done', 'המערכת פועלת'),
    nvrLess ? mk('nvr', 2, 'NVR', 'not_applicable', 'דילוג מכוון', skipped) : mk('nvr', 2, 'NVR', 'done', 'מחובר'),
    mk('ha', 3, 'תשתית המערכת', ha === 'connected' ? 'done' : 'failed', ha === 'connected' ? 'מחובר' : 'לא מחובר'),
    combo === 'C'
      ? mk('go2rtc', 4, 'go2rtc', 'failed', 'שרת המדיה לא הוגדר', { problem: { code: 'media_not_configured', message: UNSUPPORTED.message, action: UNSUPPORTED.action, link: { href: '#/system/setup', label: 'חיבורים' } } })
      : combo === 'A'
        ? mk('go2rtc', 4, 'go2rtc', 'not_applicable', 'רשות', { status_label: 'דילוג - רשות' })
        : mk('go2rtc', 4, 'go2rtc', 'done', 'מחובר'),
    mk('floor', 5, 'קומה', 'done', 'יש תוכנית'),
    nvrLess ? mk('camera', 6, 'מצלמה', 'not_applicable', 'דילוג מכוון', skipped) : mk('camera', 6, 'מצלמה', 'done', 'מצלמה מוצבת'),
  ];
}

function setupState(combo: Combo, ha: HaState) {
  const st = steps(combo, ha);
  const required = st.filter((s) => s.status !== 'not_applicable');
  const done = required.filter((s) => s.status === 'done').length;
  const supported = combo !== 'C';
  return {
    version: '0.0.0-fixture', mode: combo === 'A' || combo === 'B' ? 'ha_only' : 'full', checked_at: '2026-10-03T09:00:00Z', steps: st, done, total: required.length,
    ready: done === required.length && supported, next: required.find((s) => s.status !== 'done')?.id ?? null,
    thresholds: { drift_ok_s: 5, drift_fail_s: 60 }, check_every_s: 10, live_ttl_s: 300,
    capabilities: capabilities(combo, ha), installation: installation(combo),
  };
}

function rawHealth(combo: Combo, ha: HaState) {
  const nvr = combo === 'C' || combo === 'D';
  const go2rtc = combo === 'B' || combo === 'D';
  return {
    status: 'ok', version: '0.0.0-fixture', db: { ok: true, permission_revision: 1 }, data_dir_writable: true, nvr_configured: nvr, go2rtc_configured: go2rtc,
    discovery: { cameras_last_ok: null, cameras_last_error: null, cameras_last_run: null, streams_last_ok: null, streams_last_error: null, last_reason: null, cameras: 0, interval_s: 300 },
    events: { ingest: { connected: false, last_heartbeat_at: null, last_event_at: null, last_error: null, reconnects: 0, events_stored: 0, started_at: null }, derive: { derived: 0, last_ok: null, last_error: null } },
    home_assistant: { configured: ha !== 'none', connected: ha === 'connected', last_snapshot_at: null, last_event_at: null, last_registry_at: null, last_error: null, reconnects: 0, entities: 0, ha_version: null },
    identity_source: 'ingress', renderer: null, mode: nvr ? 'full' : 'ha_only', capabilities: capabilities(combo, ha), installation: installation(combo),
  };
}

function summary(combo: Combo, ha: HaState) {
  const items: { id: string; status: string; label: string }[] = [];
  if (combo === 'C') items.push({ id: 'go2rtc', status: 'error', label: 'שרת המדיה לא הוגדר — התקנה עם NVR דורשת אותו' });
  if (ha === 'down') items.push({ id: 'ha', status: 'error', label: 'תשתית המערכת לא מגיבה' });
  return { status: items.length ? 'error' : 'ok', items, checked_at: '2026-10-03T09:00:00Z', version: '0.0.0-fixture' };
}

function report(combo: Combo, ha: HaState) {
  const checks = [
    { id: 'ha', label: 'תשתית המערכת', status: ha === 'connected' ? 'ok' : ha === 'down' ? 'error' : 'off', detail: ha === 'connected' ? 'מחובר' : ha === 'down' ? 'לא מגיב' : 'לא מוגדר', meta: {} },
    { id: 'nvr', label: 'NVR', status: combo === 'A' || combo === 'B' ? 'off' : 'ok', detail: combo === 'A' || combo === 'B' ? 'לא מוגדר' : 'מחובר', meta: {} },
    { id: 'go2rtc', label: 'שרת המדיה', status: combo === 'A' ? 'off' : combo === 'C' ? 'error' : 'ok', detail: combo === 'A' ? 'לא מוגדר' : combo === 'C' ? 'לא הוגדר' : 'תקין', meta: combo === 'C' ? { required: true } : {} },
  ];
  const bad = checks.some((c) => c.status === 'error');
  return {
    status: bad ? 'error' : 'ok', version: '0.0.0-fixture', uptime_s: 7200, checked_at: '2026-10-03T09:00:00Z', probe_ttl_s: 60, checks,
    mode: combo === 'C' || combo === 'D' ? 'full' : 'ha_only', capabilities: capabilities(combo, ha), installation: installation(combo),
  };
}

export interface InstallationMockOptions {
  ha?: HaState;
  /** An older backend that sends no capability block (the shell then reads `mode`). */
  legacy?: boolean;
  /** Paths (after /api/v1/) the page asked for, in order: tests assert no request reaches a gated route. */
  log?: string[];
}

/** Installs the mocked API of installation `combo` on `page`. */
export async function installInstallationMock(page: Page, combo: Combo, opts: InstallationMockOptions = {}): Promise<string[]> {
  const ha = opts.ha ?? 'connected';
  const log = opts.log ?? [];
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    log.push(`${req.method()} ${p}`);
    if (p === 'me') return json(route, me(combo, ha, !!opts.legacy));
    if (p === 'me/prefs') {
      if (req.method() === 'PUT') return json(route, { prefs: req.postDataJSON() ?? {}, stored: Object.keys(req.postDataJSON() ?? {}) });
      return json(route, { prefs: {}, stored: [] });
    }
    if (p === 'settings') return json(route, { settings: { 'ui.design': 'a' }, can_edit: true });
    if (p === 'health') return json(route, rawHealth(combo, ha));
    if (p === 'health/summary') return json(route, summary(combo, ha));
    if (p.startsWith('health/report')) return json(route, report(combo, ha));
    if (p === 'setup/state') return json(route, setupState(combo, ha));
    if (p === 'alarm/panels' || p === 'alarm/config') return json(route, { panels: [] }); // no panel: the alarm pages are not offered either
    if (p.startsWith('notifications')) return json(route, { unread: 0, open_critical: 0, items: [] });
    if (p === 'devices/tree') return json(route, { floors: [], areas: [], unplaced: [], counts: {} });
    // the camera picker and the camera card: the server does NOT filter leftover NVR rows (D5) - the shell hides them without an NVR
    if (p === 'devices/camera-card/sources') {
      return json(route, {
        recorders: [{ recorder_id: 'nvr-1', name: 'מקליט ראשי', cameras: [{ recorder_id: 'nvr-1', channel: 1, camera_id: 'cam-1', name: 'כניסה ראשית', status: 'online', entity_id: null }] }],
        ha_cameras: [{ entity_id: 'camera.garden', name: 'גינה', area_id: null, area_name: 'חצר', mode: 'still_only', recorder_id: null, channel: null, live_enabled: false, live_issue: null }],
        ha_live: { ready: capabilities(combo, ha).ha_cameras_live, can_configure: true },
      });
    }
    if (p === 'devices/camera-card/resolve') {
      const q = new URL(req.url()).searchParams;
      return json(route, q.get('kind') === 'nvr' ? { state: 'live', kind: 'nvr', camera_id: 'cam-1', recorder_id: 'nvr-1', channel: 1, name: 'כניסה ראשית', status: 'online' } : { state: 'still_only', kind: 'ha', entity_id: q.get('entity_id') ?? 'camera.garden', name: 'גינה', status: 'online' });
    }
    return json(route, NOT_FOUND, 404);
  });
  return log;
}
